import React, { useState, useMemo, useRef } from 'react';
import { useProcesses } from '../hooks/useProcesses';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { processesApi, type CreateProcessPayload } from '../api/processes';
import type { Process } from '../types';
import { Button } from '../components/ui/Button';
import { SlideOver } from '../components/ui/SlideOver';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { CloudflareAnalytics } from '../components/dashboard/CloudflareAnalytics';
import {
  Play,
  Square,
  RotateCw,
  Plus,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { processes, sysLoad, isLoading, refresh } = useProcesses();
  const { canControl, isAdmin } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    pid: true,
    cpu: true,
    memory: true,
    uptime: true,
    restarts: true,
    command: true,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateProcessPayload>({
    name: '',
    group_name: 'Default',
    command: '',
    working_dir: '',
    log_file: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Delete dialog
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action loading states
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

  // Calculations
  const stats = useMemo(() => {
    let running = 0;
    let stopped = 0;
    let crashed = 0;
    let restarts = 0;
    processes.forEach((p) => {
      restarts += p.restart_count || 0;
      if (p.status === 'running') running++;
      else if (p.status === 'crashed') crashed++;
      else stopped++;
    });
    return {
      total: processes.length,
      running,
      stopped: stopped + crashed,
      restarts,
    };
  }, [processes]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');

  // Filter processes by search query and status (NO grouping, clean flat list)
  const filteredProcesses = useMemo(() => {
    return processes.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q) ||
        (p.group_name || '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'running' && p.status === 'running') ||
        (statusFilter === 'stopped' && p.status !== 'running');
      return matchesSearch && matchesStatus;
    });
  }, [processes, searchQuery, statusFilter]);

  // Handle JSON Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items: any[] = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;

      for (const item of items) {
        if (item.name && item.command) {
          await processesApi.create({
            name: item.name,
            group_name: item.group_name || 'Default',
            command: item.command,
            working_dir: item.working_dir || '',
            log_file: item.log_file || '',
          });
          count++;
        }
      }

      if (count > 0) {
        pushToast('success', `Successfully imported ${count} processes`);
        refresh();
      } else {
        pushToast('error', 'No valid process configurations found in JSON file');
      }
    } catch (err: any) {
      pushToast('error', 'Failed to import JSON: ' + (err.message || 'Invalid format'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle JSON Export
  const handleExportProcesses = () => {
    const exportData = filteredProcesses.map((p) => ({
      name: p.name,
      group_name: p.group_name || 'Default',
      command: p.command,
      working_dir: p.working_dir,
      log_file: p.log_file,
      auto_restart: p.auto_restart,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'binary-alive-processes.json';
    a.click();
    URL.revokeObjectURL(url);
    pushToast('info', `Exported ${exportData.length} process configurations`);
  };

  const handleSelectAll = () => {
    if (filteredProcesses.length > 0 && selectedIds.length === filteredProcesses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProcesses.map((p) => p.id));
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleControl = async (id: number, cmd: 'start' | 'stop' | 'restart') => {
    const key = `${id}-${cmd}`;
    setActionLoadingMap((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await processesApi.control(id, cmd);
      if (res.success) {
        pushToast('success', `Process ${cmd}ed successfully!`);
        refresh();
      } else {
        pushToast('error', res.message || `Failed to ${cmd} process`);
      }
    } catch (err: any) {
      pushToast('error', err.message || `Failed to ${cmd} process`);
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleBulkControl = async (cmd: 'start' | 'stop' | 'restart') => {
    if (selectedIds.length === 0) return;
    try {
      const res = await processesApi.bulkControl(selectedIds, cmd);
      if (res.success) {
        pushToast('success', `Bulk ${cmd} executed for ${selectedIds.length} processes.`);
        refresh();
      }
    } catch (err: any) {
      pushToast('error', err.message || `Bulk ${cmd} failed`);
    }
  };

  const openAddModal = () => {
    setEditingProcess(null);
    setFormData({
      name: '',
      group_name: 'Default',
      command: '',
      working_dir: '',
      log_file: '',
    });
    setIsSlideOverOpen(true);
  };

  const openEditModal = (p: Process) => {
    setEditingProcess(p);
    setFormData({
      name: p.name,
      group_name: p.group_name || 'Default',
      command: p.command,
      working_dir: p.working_dir || '',
      log_file: p.log_file || '',
    });
    setIsSlideOverOpen(true);
  };

  const handleSaveProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingProcess) {
        const res = await processesApi.update(editingProcess.id, formData);
        if (res.success) {
          pushToast('success', 'Process updated successfully!');
          setIsSlideOverOpen(false);
          refresh();
        }
      } else {
        const res = await processesApi.create(formData);
        if (res.success) {
          pushToast('success', 'Process added successfully!');
          setIsSlideOverOpen(false);
          refresh();
        }
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to save process');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setDeleteLoading(true);

    try {
      const res = await processesApi.delete(deletingId);
      if (res.success) {
        pushToast('success', 'Process deleted');
        setDeletingId(null);
        refresh();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to delete process');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-12 select-none">
      {/* Cloudflare Exact Analytics Container */}
      <CloudflareAnalytics
        runningCount={stats.running}
        stoppedCount={stats.stopped}
        totalCount={stats.total}
        sysLoad={sysLoad}
        restartsCount={stats.restarts}
        processes={processes}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {/* Hidden File Input for JSON Process Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Cloudflare Table Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 select-none">
        {/* Search Input Group */}
        <label className="relative flex items-center h-9 rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626] focus-within:ring-[#2f80ed] focus-within:ring-[1.5px] transition-all px-3 gap-2 w-full sm:w-[320px] md:w-[460px] lg:w-[500px]">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search processes by name, command, or group..."
            className="w-full bg-transparent border-0 text-[13px] text-white placeholder-[#8c8c8c] outline-none font-normal"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-[#8c8c8c] hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </label>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          {/* Filters */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'all' ? 'running' : prev === 'running' ? 'stopped' : 'all'))}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0e0e0e] ring-1 hover:bg-[#161616] text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter !== 'all' ? 'ring-[#2f80ed] text-white' : 'ring-[#262626] text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
              <path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm106.18,74.58A8,8,0,0,0,144,136v58.66L112,216V136a8,8,0,0,0-2.16-5.47L40,56H216Z" />
            </svg>
            <span>Filters{statusFilter !== 'all' ? ` (${statusFilter})` : ''}</span>
          </button>

          {/* Display options dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDisplayOptions((prev) => !prev)}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0e0e0e] ring-1 hover:bg-[#161616] text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${
                showDisplayOptions ? 'ring-[#2f80ed] text-white' : 'ring-[#262626] text-white'
              }`}
              title="Toggle visible table columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8c8c8c]" />
              <span>Display options</span>
            </button>

            {showDisplayOptions && (
              <div className="absolute right-0 top-11 w-48 rounded-lg bg-[#0e0e0e] border border-[#262626] shadow-2xl py-2 z-30 text-xs animate-in fade-in">
                <div className="px-3 py-1 text-[#8c8c8c] font-semibold uppercase tracking-wider text-[10px]">
                  Visible Columns
                </div>
                {(['pid', 'cpu', 'memory', 'uptime', 'restarts', 'command'] as const).map((col) => (
                  <label
                    key={col}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-[#161616] cursor-pointer text-gray-200"
                  >
                    <span className="capitalize">{col}</span>
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))
                      }
                      className="rounded border-[#333333] bg-[#1a1a1a] text-[#2f80ed] focus:ring-0"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Import */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626] hover:bg-[#161616] text-[13px] font-medium text-white transition-colors cursor-pointer shrink-0"
            title="Import process configurations from JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM120,40v92.69L93.66,106.34a8,8,0,0,0-11.32,11.32l40,40a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,132.69V40a8,8,0,0,0-16,0Z" />
            </svg>
            <span>Import</span>
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExportProcesses}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626] hover:bg-[#161616] text-[13px] font-medium text-white transition-colors cursor-pointer shrink-0"
            title="Export process configurations as JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
            </svg>
            <span>Export</span>
          </button>

          {/* + Add process (Signature Cloudflare blue button) */}
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#2f80ed] hover:bg-[#2563eb] text-white text-[13px] font-medium transition-colors cursor-pointer shrink-0 shadow-sm ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add process</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {canControl() && selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#141414] ring-1 ring-[#262626] text-xs animate-in fade-in">
          <span className="font-medium text-white">{selectedIds.length} processes selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkControl('start')} className="border-[#333333] text-emerald-400 hover:bg-[#1a1a1a]">
              <Play className="w-3 h-3 mr-1" /> Start
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkControl('stop')} className="border-[#333333] text-rose-400 hover:bg-[#1a1a1a]">
              <Square className="w-3 h-3 mr-1" /> Stop
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkControl('restart')} className="border-[#333333] text-amber-400 hover:bg-[#1a1a1a]">
              <RotateCw className="w-3 h-3 mr-1" /> Restart
            </Button>
          </div>
        </div>
      )}

      {/* Cloudflare Processes Table Card */}
      <div id="processes-table-card" className="w-full rounded-lg border border-[#222222] bg-[#000000] overflow-hidden select-none">
        {/* Quota / Process Summary Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a] text-[13px] text-[#8c8c8c] bg-[#000000]">
          <p>
            Managing <strong className="font-semibold text-white">{filteredProcesses.length} monitored processes</strong> ({stats.running} active, {stats.stopped} stopped) on this host.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            {/* Table Head */}
            <thead className="bg-[#000000] border-b border-[#1a1a1a] text-[13px] font-medium text-white select-none">
              <tr className="h-10">
                {canControl() && (
                  <th className="w-[44px] min-w-[44px] max-w-[44px] px-0 text-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={filteredProcesses.length > 0 && selectedIds.length === filteredProcesses.length}
                      onClick={handleSelectAll}
                      className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] transition-all cursor-pointer mx-auto ${
                        filteredProcesses.length > 0 && selectedIds.length === filteredProcesses.length
                          ? 'bg-[#2f80ed] ring-1 ring-[#2f80ed] text-white'
                          : 'bg-transparent ring-1 ring-[#3a3a3a] hover:ring-[#555555]'
                      }`}
                    >
                      {filteredProcesses.length > 0 && selectedIds.length === filteredProcesses.length && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                        </svg>
                      )}
                    </button>
                  </th>
                )}
                {/* Status Column */}
                <th className="px-3 font-normal text-white w-[120px] min-w-[110px] relative">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <span>Status</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c]">
                      <path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z" />
                    </svg>
                  </div>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                </th>
                {/* Name Column */}
                <th className="px-3 font-normal text-white min-w-[180px] relative">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <span>Name</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c]">
                      <path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z" />
                    </svg>
                  </div>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                </th>
                {/* PID Column */}
                {visibleColumns.pid && (
                  <th className="px-3 font-normal text-white w-[85px] min-w-[80px] relative">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                      <span>PID</span>
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                  </th>
                )}
                {/* CPU Column */}
                {visibleColumns.cpu && (
                  <th className="px-3 font-normal text-white w-[85px] min-w-[80px] relative">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                      <span>CPU</span>
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                  </th>
                )}
                {/* Memory Column */}
                {visibleColumns.memory && (
                  <th className="px-3 font-normal text-white w-[95px] min-w-[90px] relative">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                      <span>Memory</span>
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                  </th>
                )}
                {/* Uptime Column */}
                {visibleColumns.uptime && (
                  <th className="px-3 font-normal text-white w-[130px] min-w-[110px] relative">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                      <span>Uptime</span>
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                  </th>
                )}
                {/* Restarts Column */}
                {visibleColumns.restarts && (
                  <th className="px-3 font-normal text-white w-[85px] min-w-[80px] relative">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                      <span>Restarts</span>
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                  </th>
                )}
                {/* Command Column */}
                {visibleColumns.command && (
                  <th className="px-3 font-normal text-white min-w-[280px] relative">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                      <span>Command</span>
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[1px] bg-[#2e2e2e]"></span>
                  </th>
                )}
                {/* Actions Column */}
                <th className="w-[130px] min-w-[130px] px-3 text-right sticky right-0 bg-[#000000] z-10 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            {/* Table Body (NO Grouping Rows - Flat Clean Process List) */}
            <tbody className="divide-y divide-[#171717]">
              {filteredProcesses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-[#666666] text-[13px]">
                    No processes match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => {
                  const isRunning = p.status === 'running';
                  const isChecked = selectedIds.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className="h-10 hover:bg-[#111111] transition-colors group/row border-b border-[#161616]"
                    >
                      {/* Checkbox */}
                      {canControl() && (
                        <td className="w-[44px] min-w-[44px] px-0 text-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            onClick={() => handleSelectOne(p.id)}
                            className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] transition-all cursor-pointer mx-auto ${
                              isChecked
                                ? 'bg-[#2f80ed] ring-1 ring-[#2f80ed] text-white'
                                : 'bg-transparent ring-1 ring-[#3a3a3a] hover:ring-[#555555]'
                            }`}
                          >
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                                <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                              </svg>
                            )}
                          </button>
                        </td>
                      )}

                      {/* Status Column */}
                      <td className="px-3 h-10 w-[120px] min-w-[110px] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isRunning ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#30a46c] shrink-0"></span>
                              <span className="text-[12px] font-medium text-white tracking-wide">RUNNING</span>
                            </>
                          ) : p.status === 'crashed' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#e5484d] shrink-0"></span>
                              <span className="text-[12px] font-medium text-[#e5484d] tracking-wide">CRASHED</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full border border-[#666666] bg-[#141414] shrink-0"></span>
                              <span className="text-[12px] font-normal text-[#8c8c8c] tracking-wide">STOPPED</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Name Column */}
                      <td className="px-3 h-10 min-w-[180px]">
                        <div className="flex items-center gap-1.5 overflow-hidden truncate">
                          <span
                            onClick={() => openEditModal(p)}
                            className="text-white text-[13px] font-medium hover:underline cursor-pointer truncate"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          {p.group_name && p.group_name !== 'Default' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-normal text-[#8c8c8c] bg-[#141414] border border-[#242424] shrink-0">
                              {p.group_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PID Column */}
                      {visibleColumns.pid && (
                        <td className="px-3 h-10 w-[85px] min-w-[80px] whitespace-nowrap">
                          <span className="text-[13px] text-white font-mono tabular-nums">
                            {p.pid || '—'}
                          </span>
                        </td>
                      )}

                      {/* CPU Column */}
                      {visibleColumns.cpu && (
                        <td className="px-3 h-10 w-[85px] min-w-[80px] whitespace-nowrap">
                          <span className="text-[13px] text-white tabular-nums">
                            {typeof p.cpu === 'number' ? (p.cpu > 0 ? `${p.cpu}%` : '0%') : p.cpu || '0%'}
                          </span>
                        </td>
                      )}

                      {/* Memory Column */}
                      {visibleColumns.memory && (
                        <td className="px-3 h-10 w-[95px] min-w-[90px] whitespace-nowrap">
                          <span className="text-[13px] text-white tabular-nums">
                            {p.mem || '0 MB'}
                          </span>
                        </td>
                      )}

                      {/* Uptime Column */}
                      {visibleColumns.uptime && (
                        <td className="px-3 h-10 w-[130px] min-w-[110px] whitespace-nowrap">
                          <span className="text-[13px] text-white tabular-nums">
                            {isRunning ? p.uptime : '—'}
                          </span>
                        </td>
                      )}

                      {/* Restarts Column */}
                      {visibleColumns.restarts && (
                        <td className="px-3 h-10 w-[85px] min-w-[80px] whitespace-nowrap">
                          {p.restart_count > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono border border-[#3a2512] bg-[#1f1308] text-[#f6821f]">
                              <RotateCw className="w-2.5 h-2.5 text-[#f6821f]" />
                              {p.restart_count}
                            </span>
                          ) : (
                            <span className="text-[13px] text-[#666666] tabular-nums">0</span>
                          )}
                        </td>
                      )}

                      {/* Command Column */}
                      {visibleColumns.command && (
                        <td className="px-3 h-10 min-w-[280px] truncate">
                          <span
                            className="truncate text-[12px] text-[#cccccc] font-mono block"
                            title={p.command}
                          >
                            {p.command}
                          </span>
                        </td>
                      )}

                      {/* Actions Column */}
                      <td className="px-3 h-10 w-[130px] min-w-[130px] text-right sticky right-0 bg-[#000000] group-hover:bg-[#111111] transition-colors z-10 whitespace-nowrap">
                        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-5 w-5 bg-gradient-to-r from-transparent to-[#000000] group-hover:to-[#111111]"></span>
                        <div className="flex items-center justify-end gap-1.5">
                          {canControl() && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <button
                                type="button"
                                title="Start"
                                disabled={isRunning || actionLoadingMap[`${p.id}-start`]}
                                onClick={() => handleControl(p.id, 'start')}
                                className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-30 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Stop"
                                disabled={!isRunning || actionLoadingMap[`${p.id}-stop`]}
                                onClick={() => handleControl(p.id, 'stop')}
                                className="p-1 text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-30 cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Restart"
                                disabled={actionLoadingMap[`${p.id}-restart`]}
                                onClick={() => handleControl(p.id, 'restart')}
                                className="p-1 text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30 cursor-pointer"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                              {isAdmin() && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => setDeletingId(p.id)}
                                  className="p-1 text-rose-500 hover:text-rose-400 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="text-[13px] font-normal text-white hover:underline transition-colors cursor-pointer px-1"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-[#1a1a1a] px-4 py-2 flex items-center justify-between text-[13px] text-[#8c8c8c] bg-[#000000]">
          <div className="text-[13px] text-[#8c8c8c]">
            Showing <span className="tabular-nums font-normal text-[#8c8c8c]">1-{filteredProcesses.length}</span> of <span className="tabular-nums font-normal text-[#8c8c8c]">{filteredProcesses.length}</span>
          </div>
        </div>
      </div>

      {/* Add / Edit Process Drawer */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={editingProcess ? `Edit Process: ${editingProcess.name}` : 'Add New Process'}
      >
        <form onSubmit={handleSaveProcess} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-300 mb-1.5">
              Process Name (Unique)
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my_bot"
              className="w-full px-3 py-2 rounded-lg border border-[#2a2a2a] bg-[#141414] text-white placeholder-gray-500 focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-300 mb-1.5">Group Name</label>
            <input
              type="text"
              value={formData.group_name}
              onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              placeholder="Default"
              className="w-full px-3 py-2 rounded-lg border border-[#2a2a2a] bg-[#141414] text-white placeholder-gray-500 focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-300 mb-1.5">Command to Execute</label>
            <input
              type="text"
              required
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              placeholder="./start_bot.sh"
              className="w-full px-3 py-2 font-mono rounded-lg border border-[#2a2a2a] bg-[#141414] text-white placeholder-gray-500 focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-300 mb-1.5">Working Directory</label>
            <input
              type="text"
              value={formData.working_dir}
              onChange={(e) => setFormData({ ...formData, working_dir: e.target.value })}
              placeholder="/home/username/bot_folder"
              className="w-full px-3 py-2 font-mono rounded-lg border border-[#2a2a2a] bg-[#141414] text-white placeholder-gray-500 focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-300 mb-1.5">Log File Output (Optional)</label>
            <input
              type="text"
              value={formData.log_file}
              onChange={(e) => setFormData({ ...formData, log_file: e.target.value })}
              placeholder="output.log"
              className="w-full px-3 py-2 font-mono rounded-lg border border-[#2a2a2a] bg-[#141414] text-white placeholder-gray-500 focus:outline-none focus:border-brand"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#222222]">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSlideOverOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={formLoading}>
              {editingProcess ? 'Save Changes' : 'Create Process'}
            </Button>
          </div>
        </form>
      </SlideOver>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Delete Monitored Process"
        message="Are you sure you want to delete this process? If it is running, it will be forcefully terminated."
        confirmLabel="Delete Process"
        variant="danger"
        isLoading={deleteLoading}
      />
    </div>
  );
};
