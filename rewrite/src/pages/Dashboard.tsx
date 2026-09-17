import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProcesses } from '../hooks/useProcesses';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { processesApi, type CreateProcessPayload } from '../api/processes';
import type { Process } from '../types';
import { Button } from '../components/ui/Button';
import { SlideOver } from '../components/ui/SlideOver';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { CloudflareAnalytics } from '../components/dashboard/CloudflareAnalytics';
import { Plus } from 'lucide-react';

const PlayIcon: React.FC<{ className?: string }> = ({ className = "w-[15px] h-[15px]" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M7 4.77a1.5 1.5 0 0 1 2.27-1.29l10.5 6.23a1.5 1.5 0 0 1 0 2.58l-10.5 6.23A1.5 1.5 0 0 1 7 17.23V4.77Z" />
  </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className = "w-[15px] h-[15px]" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="5.5" y="5.5" width="13" height="13" rx="3" />
  </svg>
);

const RestartIcon: React.FC<{ className?: string }> = ({ className = "w-[15px] h-[15px]" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = "w-[15px] h-[15px]" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className={className}>
    <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
  </svg>
);

const CaretUpDownIcon: React.FC<{ active: boolean; direction: 'asc' | 'desc' }> = ({ active, direction }) => {
  if (active) {
    return direction === 'asc' ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256" className="text-[#2f80ed]">
        <path d="M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256" className="text-[#2f80ed]">
        <path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555] group-hover:text-[#8c8c8c] transition-colors">
      <path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z" />
    </svg>
  );
};

const COLUMN_LABELS: Record<string, string> = {
  pid: 'PID',
  cpu: 'CPU Usage',
  memory: 'Memory',
  uptime: 'Uptime',
  restarts: 'Restarts',
  command: 'Command',
};

export type FilterField = 'name' | 'status' | 'group' | 'pid' | 'restarts' | 'command';

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'does_not_contain'
  | 'starts_with'
  | 'is'
  | 'is_not'
  | 'greater_than'
  | 'less_than';

export interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

const FILTER_FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'group', label: 'Group' },
  { value: 'pid', label: 'PID' },
  { value: 'restarts', label: 'Restarts' },
  { value: 'command', label: 'Command' },
];

const getFilterOperatorOptions = (field: FilterField): { value: FilterOperator; label: string }[] => {
  if (field === 'status') {
    return [
      { value: 'is', label: 'is' },
      { value: 'is_not', label: 'is not' },
    ];
  }
  if (field === 'restarts' || field === 'pid') {
    return [
      { value: 'greater_than', label: 'is greater than' },
      { value: 'equals', label: 'equals' },
      { value: 'less_than', label: 'is less than' },
    ];
  }
  if (field === 'group') {
    return [
      { value: 'is', label: 'is' },
      { value: 'is_not', label: 'is not' },
      { value: 'contains', label: 'contains' },
    ];
  }
  return [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' },
    { value: 'does_not_contain', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
  ];
};

const FILTER_STATUS_OPTIONS = [
  { value: 'running', label: 'running' },
  { value: 'stopped', label: 'stopped' },
  { value: 'crashed', label: 'crashed' },
];

const CustomSelect = <T extends string>({
  value,
  options,
  onChange,
  className = '',
  menuWidth = 'w-full min-w-[140px]',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  className?: string;
  menuWidth?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-9 px-3 rounded-lg bg-[#141414] border text-[14px] text-white flex items-center justify-between cursor-pointer transition-colors ${
          isOpen ? 'border-[#2f80ed]' : 'border-[#262626] hover:border-[#383838]'
        }`}
      >
        <span className="truncate">{currentOption?.label || value}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          fill="currentColor"
          viewBox="0 0 256 256"
          className={`text-[#777777] shrink-0 ml-1.5 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        >
          <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 top-10 rounded-md bg-[#0c0c0c] border border-[#262626] shadow-2xl p-1 z-50 select-none ${menuWidth}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[14px] transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'text-white bg-[#1a1a1a]'
                    : 'text-[#cccccc] hover:text-white hover:bg-[#161616]'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 256 256"
                    fill="currentColor"
                    className="text-white shrink-0 ml-2"
                  >
                    <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { processes, sysLoad, isLoading, refresh } = useProcesses();
  const { canControl, isAdmin } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const liveEditingProcess = useMemo(() => {
    if (!editingProcess) return null;
    return processes.find((p) => p.id === editingProcess.id) || editingProcess;
  }, [editingProcess, processes]);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Adjustable column widths (Cloudflare DNS table draggable resizers)
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    status: 125,
    name: 220,
    restarts: 125,
  });
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  const handleResizeStart = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const defaultW = col === 'status' ? 125 : col === 'name' ? 220 : 125;
    const startWidth = columnWidths[col] || defaultW;
    const minWidth = col === 'status' ? 120 : col === 'name' ? 180 : 120;
    const maxWidth = col === 'status' ? 240 : col === 'name' ? 550 : 200;

    let hasMoved = false;

    setResizingCol(col);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (Math.abs(delta) > 2) {
        hasMoved = true;
      }
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [col]: newWidth }));
    };

    const onMouseUp = () => {
      setResizingCol(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (hasMoved) {
        // Prevent any click event resulting from dragging from triggering column sort
        const preventClickCapture = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          clickEvent.stopImmediatePropagation();
          window.removeEventListener('click', preventClickCapture, true);
        };
        window.addEventListener('click', preventClickCapture, true);
        setTimeout(() => {
          window.removeEventListener('click', preventClickCapture, true);
        }, 100);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Available groups for autocomplete / select
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    processes.forEach((p) => {
      if (p.group_name && p.group_name.trim()) {
        set.add(p.group_name.trim());
      }
    });
    if (set.size === 0) {
      set.add('Default');
    }
    return Array.from(set).sort();
  }, [processes]);

  // Cloudflare Filter Rules State
  const isMac = useMemo(() => {
    return typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || '');
  }, []);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([
    { id: '1', field: 'name', operator: 'contains', value: '' }
  ]);
  const [appliedFilterRules, setAppliedFilterRules] = useState<FilterRule[]>([]);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');

  const addFilterRule = () => {
    setFilterRules((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), field: 'name', operator: 'contains', value: '' }
    ]);
  };

  const removeFilterRule = (id: string) => {
    setFilterRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [{ id: String(Date.now()), field: 'name', operator: 'contains', value: '' }];
    });
  };

  const updateFilterRule = (id: string, updates: Partial<FilterRule>) => {
    setFilterRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handleFieldChange = (ruleId: string, newField: FilterField) => {
    let defaultOperator: FilterOperator = 'contains';
    let defaultValue = '';

    if (newField === 'status') {
      defaultOperator = 'is';
      defaultValue = 'running';
    } else if (newField === 'restarts') {
      defaultOperator = 'greater_than';
      defaultValue = '0';
    } else if (newField === 'pid') {
      defaultOperator = 'equals';
      defaultValue = '';
    } else if (newField === 'group') {
      defaultOperator = 'is';
      defaultValue = availableGroups[0] || 'Default';
    } else {
      defaultOperator = 'contains';
      defaultValue = '';
    }

    updateFilterRule(ruleId, {
      field: newField,
      operator: defaultOperator,
      value: defaultValue,
    });
  };

  const handleApplyFilters = () => {
    const valid = filterRules.filter((r) => r.value.trim().length > 0);
    setAppliedFilterRules(valid);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilterRules([{ id: String(Date.now()), field: 'name', operator: 'contains', value: '' }]);
    setAppliedFilterRules([]);
    setShowFilters(false);
  };

  const [visibleColumns, setVisibleColumns] = useState({
    pid: true,
    cpu: true,
    memory: true,
    uptime: true,
    restarts: true,
    command: true,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const displayOptionsRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  // Sorting state
  type SortField = 'name' | 'status' | 'pid' | 'cpu' | 'memory' | 'uptime' | 'restarts';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Keyboard shortcuts: Ctrl+K / Cmd+K or '/' to focus search, Esc to clear/blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Close display options and filters dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        displayOptionsRef.current &&
        !displayOptionsRef.current.contains(target)
      ) {
        setShowDisplayOptions(false);
      }
      if (
        filtersRef.current &&
        !filtersRef.current.contains(target)
      ) {
        setShowFilters(false);
      }
    };
    if (showDisplayOptions || showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDisplayOptions, showFilters]);

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
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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
  const activeFiltersCount = appliedFilterRules.length;

  // Filter & sort processes (NO grouping, clean flat list)
  const filteredProcesses = useMemo(() => {
    const filtered = processes.filter((p) => {
      // 1. Text search query
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q) ||
        (p.group_name || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Applied Filter Rules
      if (appliedFilterRules.length === 0) return true;

      const evalRule = (rule: FilterRule) => {
        const val = rule.value.trim().toLowerCase();
        if (!val && rule.field !== 'status') return true;

        if (rule.field === 'name') {
          const target = p.name.toLowerCase();
          if (rule.operator === 'contains') return target.includes(val);
          if (rule.operator === 'equals') return target === val;
          if (rule.operator === 'does_not_contain') return !target.includes(val);
          if (rule.operator === 'starts_with') return target.startsWith(val);
        } else if (rule.field === 'status') {
          const target = p.status.toLowerCase();
          if (rule.operator === 'is' || rule.operator === 'equals') return target === val;
          if (rule.operator === 'is_not' || rule.operator === 'does_not_contain') return target !== val;
        } else if (rule.field === 'group') {
          const target = (p.group_name || 'Default').toLowerCase();
          if (rule.operator === 'is' || rule.operator === 'equals') return target === val;
          if (rule.operator === 'is_not' || rule.operator === 'does_not_contain') return target !== val;
          if (rule.operator === 'contains') return target.includes(val);
          if (rule.operator === 'starts_with') return target.startsWith(val);
        } else if (rule.field === 'pid') {
          const numVal = parseInt(val, 10);
          if (isNaN(numVal)) return true;
          const pid = p.pid ?? -1;
          if (rule.operator === 'equals' || rule.operator === 'is') return pid === numVal;
          if (rule.operator === 'greater_than') return pid > numVal;
          if (rule.operator === 'less_than') return pid !== -1 && pid < numVal;
        } else if (rule.field === 'restarts') {
          const numVal = parseInt(val, 10);
          if (isNaN(numVal)) return true;
          const restarts = p.restart_count ?? 0;
          if (rule.operator === 'equals' || rule.operator === 'is') return restarts === numVal;
          if (rule.operator === 'greater_than') return restarts > numVal;
          if (rule.operator === 'less_than') return restarts < numVal;
        } else if (rule.field === 'command') {
          const target = p.command.toLowerCase();
          if (rule.operator === 'contains') return target.includes(val);
          if (rule.operator === 'equals') return target === val;
          if (rule.operator === 'does_not_contain') return !target.includes(val);
          if (rule.operator === 'starts_with') return target.startsWith(val);
        }
        return true;
      };

      return matchMode === 'any'
        ? appliedFilterRules.some(evalRule)
        : appliedFilterRules.every(evalRule);
    });

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];
      if (sortField === 'cpu') {
        valA = typeof a.cpu === 'number' ? a.cpu : parseFloat(String(a.cpu || 0));
        valB = typeof b.cpu === 'number' ? b.cpu : parseFloat(String(b.cpu || 0));
      } else if (sortField === 'memory') {
        valA = parseFloat(String(a.mem || 0));
        valB = parseFloat(String(b.mem || 0));
      } else if (sortField === 'pid') {
        valA = a.pid || 0;
        valB = b.pid || 0;
      } else if (sortField === 'restarts') {
        valA = a.restart_count || 0;
        valB = b.restart_count || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processes, searchQuery, appliedFilterRules, matchMode, sortField, sortDirection]);

  // Pagination calculations
  const totalItems = filteredProcesses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(totalItems, startIndex + pageSize);
  const paginatedProcesses = useMemo(() => {
    return filteredProcesses.slice(startIndex, endIndex);
  }, [filteredProcesses, startIndex, endIndex]);

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, appliedFilterRules, matchMode]);

  // Clamp current page if totalPages shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const isAllPageSelected =
    paginatedProcesses.length > 0 && paginatedProcesses.every((p) => selectedIds.includes(p.id));
  const isSomePageSelected =
    paginatedProcesses.some((p) => selectedIds.includes(p.id));

  const handleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedProcesses.some((p) => p.id === id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...paginatedProcesses.map((p) => p.id)])));
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
    if (isBulkDeleting) {
      if (selectedIds.length === 0) return;
      setDeleteLoading(true);
      try {
        for (const id of selectedIds) {
          await processesApi.delete(id);
        }
        pushToast('success', `${selectedIds.length} processes deleted`);
        setSelectedIds([]);
        setIsBulkDeleting(false);
        refresh();
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to delete processes');
      } finally {
        setDeleteLoading(false);
      }
    } else {
      if (!deletingId) return;
      setDeleteLoading(true);
      try {
        const res = await processesApi.delete(deletingId);
        if (res.success) {
          pushToast('success', 'Process deleted');
          setSelectedIds((prev) => prev.filter((id) => id !== deletingId));
          setDeletingId(null);
          refresh();
        }
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to delete process');
      } finally {
        setDeleteLoading(false);
      }
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
        <label
          title={`Search processes (${isMac ? '⌘K' : 'Ctrl+K'} or /)`}
          className="relative flex items-center h-9 rounded-lg bg-transparent border border-[#262626] focus-within:border-[#2f80ed] transition-colors px-3 gap-2 w-full sm:w-[280px] md:w-[320px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search processes..."
            className="w-full bg-transparent border-0 text-[14px] text-white placeholder-[#8c8c8c] outline-none font-normal"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#222222] text-[#8c8c8c] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Clear search"
              aria-label="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono font-medium text-[#737373] bg-[#141414] border border-[#2a2a2a] rounded select-none pointer-events-none shrink-0 tracking-tight leading-none">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          )}
        </label>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Filters dropdown */}
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => {
                setShowFilters((prev) => {
                  const next = !prev;
                  if (next) {
                    setShowDisplayOptions(false);
                    if (appliedFilterRules.length > 0) {
                      setFilterRules(appliedFilterRules.map((r) => ({ ...r })));
                    } else if (filterRules.length === 0) {
                      setFilterRules([{ id: '1', field: 'name', operator: 'contains', value: '' }]);
                    }
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg bg-transparent border text-[14px] font-medium transition-colors cursor-pointer shrink-0 ${
                showFilters || activeFiltersCount > 0
                  ? 'border-[#444444] text-white bg-[#141414]'
                  : 'border-[#262626] text-white hover:bg-[#141414] hover:border-[#383838]'
              }`}
              title="Filter processes"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="currentColor"
                viewBox="0 0 256 256"
                className="text-[#8c8c8c] shrink-0"
              >
                <path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm106.18,74.58A8,8,0,0,0,144,136v58.66L112,216V136a8,8,0,0,0-2.16-5.47L40,56H216Z" />
              </svg>
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="text-[12px] text-[#8c8c8c] font-normal">({activeFiltersCount})</span>
              )}
            </button>

            {showFilters && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-10 w-[560px] max-w-[calc(100vw-32px)] rounded-xl bg-[#0c0c0c] border border-[#262626] shadow-2xl p-4 z-50 select-none animate-in fade-in">
                {/* Header */}
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-white">Filters</span>
                    {filterRules.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setMatchMode((prev) => (prev === 'any' ? 'all' : 'any'))}
                        className="px-2.5 py-0.5 rounded text-[13px] text-[#cccccc] hover:text-white bg-[#141414] border border-[#2e2e2e] hover:border-[#444444] transition-colors cursor-pointer"
                      >
                        Match {matchMode === 'any' ? 'any (OR)' : 'all (AND)'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="text-[#888888] hover:text-white transition-colors cursor-pointer text-[14px] p-1 leading-none"
                    title="Close filters"
                  >
                    ✕
                  </button>
                </div>

                {/* Rules List */}
                <div className={`space-y-2.5 ${filterRules.length > 3 ? 'max-h-[320px] overflow-y-auto pr-0.5' : ''}`}>
                  {filterRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2">
                      {/* Field */}
                      <CustomSelect
                        value={rule.field}
                        options={FILTER_FIELD_OPTIONS}
                        onChange={(val) => handleFieldChange(rule.id, val as FilterField)}
                        className="w-28 sm:w-32 shrink-0"
                        menuWidth="w-40"
                      />

                      {/* Operator */}
                      <CustomSelect
                        value={rule.operator}
                        options={getFilterOperatorOptions(rule.field)}
                        onChange={(val) => updateFilterRule(rule.id, { operator: val as FilterOperator })}
                        className="w-32 sm:w-36 shrink-0"
                        menuWidth="w-44"
                      />

                      {/* Value Input */}
                      {rule.field === 'status' ? (
                        <CustomSelect
                          value={rule.value}
                          options={FILTER_STATUS_OPTIONS}
                          onChange={(val) => updateFilterRule(rule.id, { value: val })}
                          className="flex-1 min-w-0"
                          menuWidth="w-full"
                        />
                      ) : rule.field === 'group' ? (
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="text"
                            list={`group-options-${rule.id}`}
                            value={rule.value}
                            onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleApplyFilters();
                            }}
                            placeholder="e.g. Default"
                            className="w-full h-9 px-3 rounded-lg bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors"
                          />
                          <datalist id={`group-options-${rule.id}`}>
                            {availableGroups.map((g) => (
                              <option key={g} value={g} />
                            ))}
                          </datalist>
                        </div>
                      ) : rule.field === 'restarts' || rule.field === 'pid' ? (
                        <input
                          type="number"
                          min="0"
                          value={rule.value}
                          onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyFilters();
                          }}
                          placeholder={rule.field === 'pid' ? 'e.g. 1234' : '0'}
                          className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors"
                        />
                      ) : (
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyFilters();
                          }}
                          placeholder={rule.field === 'name' ? 'process name' : 'command string'}
                          className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors"
                        />
                      )}

                      {/* Trash / Delete button */}
                      <button
                        type="button"
                        onClick={() => removeFilterRule(rule.id)}
                        className="w-8 h-8 flex items-center justify-center text-[#777777] hover:text-white cursor-pointer transition-colors shrink-0"
                        title="Delete filter rule"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2.5 mt-1">
                  <button
                    type="button"
                    onClick={addFilterRule}
                    className="text-[14px] text-white hover:text-[#2f80ed] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>+ Add filter</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#666666]">Press Enter to apply</span>
                    {appliedFilterRules.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="text-[14px] text-[#888888] hover:text-white transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="h-8 px-3.5 rounded-lg bg-[#2f80ed] hover:bg-[#2563eb] text-white text-[14px] font-medium transition-colors cursor-pointer shadow-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Display options dropdown */}
          <div className="relative" ref={displayOptionsRef}>
            <button
              type="button"
              onClick={() => {
                setShowDisplayOptions((prev) => !prev);
                setShowFilters(false);
              }}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg bg-transparent border text-[14px] font-medium transition-colors cursor-pointer shrink-0 ${
                showDisplayOptions
                  ? 'border-[#444444] text-white bg-[#141414]'
                  : 'border-[#262626] text-white hover:bg-[#141414] hover:border-[#383838]'
              }`}
              title="Toggle visible table columns"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
                <path d="M222.87,74.56,134.87,23.75a16,16,0,0,0-15.74,0L31.13,74.56A16,16,0,0,0,23.26,88.4v101.6a16,16,0,0,0,7.87,13.84l88,50.81a16,16,0,0,0,15.74,0l88-50.81a16,16,0,0,0,7.87-13.84V88.4A16,16,0,0,0,222.87,74.56ZM127,160a32,32,0,1,1,32-32A32,32,0,0,1,127,160Z" />
              </svg>
              <span>Display options</span>
            </button>

            {showDisplayOptions && (
              <div className="absolute right-0 top-10 w-52 rounded-md bg-[#0c0c0c] border border-[#262626] shadow-xl p-1 z-40 select-none">
                {(['pid', 'cpu', 'memory', 'uptime', 'restarts', 'command'] as const).map((col) => {
                  const isVisible = visibleColumns[col];
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() =>
                        setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }))
                      }
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[14px] text-[#cccccc] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                    >
                      <span className={isVisible ? 'text-white' : 'text-[#777777]'}>
                        {COLUMN_LABELS[col] || col}
                      </span>
                      {isVisible && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 256 256"
                          fill="currentColor"
                          className="text-white shrink-0"
                        >
                          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
                <div className="border-t border-[#1e1e1e] my-1" />
                <button
                  type="button"
                  onClick={() =>
                    setVisibleColumns({
                      pid: true,
                      cpu: true,
                      memory: true,
                      uptime: true,
                      restarts: true,
                      command: true,
                    })
                  }
                  className="w-full text-left px-2.5 py-1.5 rounded text-[14px] text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                >
                  Reset columns
                </button>
              </div>
            )}
          </div>

          {/* Import */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-transparent border border-[#262626] hover:bg-[#141414] hover:border-[#383838] text-[14px] font-medium text-white transition-colors cursor-pointer shrink-0"
            title="Import process configurations from JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM120,40v92.69L93.66,106.34a8,8,0,0,0-11.32,11.32l40,40a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,132.69V40a8,8,0,0,0-16,0Z" />
            </svg>
            <span>Import</span>
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExportProcesses}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-transparent border border-[#262626] hover:bg-[#141414] hover:border-[#383838] text-[14px] font-medium text-white transition-colors cursor-pointer shrink-0"
            title="Export process configurations as JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
            </svg>
            <span>Export</span>
          </button>

          {/* + Add process (Signature Cloudflare blue button) */}
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#2f80ed] hover:bg-[#2563eb] text-white text-[14px] font-medium transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add process</span>
          </button>
        </div>
      </div>

      {/* Processes Table — Cloudflare DNS table (native table + ARIA) */}
      <div id="processes-table-card" className="w-full flex flex-col rounded-xl border border-[#222222] bg-black shadow-sm select-none">
        {/* Status bar */}
        <div className="flex w-full flex-col gap-2 px-4 py-3 bg-black">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-[#8c8c8c] font-normal select-none">
              {filteredProcesses.length === processes.length ? (
                <>
                  You have <strong className="font-semibold text-white">{processes.length}</strong> {processes.length === 1 ? 'process' : 'processes'} configured.
                </>
              ) : (
                <>
                  Showing <strong className="font-semibold text-white">{filteredProcesses.length}</strong> of <strong className="font-semibold text-white">{processes.length}</strong> processes.
                </>
              )}
            </p>
            {appliedFilterRules.length > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[13px] text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
          {appliedFilterRules.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {appliedFilterRules.map((rule) => {
                const fieldLabel =
                  rule.field === 'name'
                    ? 'Name'
                    : rule.field === 'status'
                    ? 'Status'
                    : rule.field === 'group'
                    ? 'Group'
                    : rule.field === 'pid'
                    ? 'PID'
                    : rule.field === 'restarts'
                    ? 'Restarts'
                    : 'Command';

                const operatorLabel =
                  rule.operator === 'contains'
                    ? 'contains'
                    : rule.operator === 'equals'
                    ? 'is'
                    : rule.operator === 'does_not_contain'
                    ? 'excludes'
                    : rule.operator === 'starts_with'
                    ? 'starts with'
                    : rule.operator === 'is'
                    ? 'is'
                    : rule.operator === 'is_not'
                    ? 'is not'
                    : rule.operator === 'greater_than'
                    ? '>'
                    : rule.operator === 'less_than'
                    ? '<'
                    : rule.operator;

                return (
                  <span
                    key={rule.id}
                    className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-[#161616] border border-[#262626] text-[12px] text-[#cccccc]"
                  >
                    <span className="text-[#888888]">{fieldLabel}</span>
                    <span className="text-[#666666]">{operatorLabel}</span>
                    <span className="text-white font-medium">{rule.value}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = appliedFilterRules.filter((r) => r.id !== rule.id);
                        setAppliedFilterRules(next);
                        if (next.length === 0) {
                          setFilterRules([{ id: String(Date.now()), field: 'name', operator: 'contains', value: '' }]);
                        } else {
                          setFilterRules(next);
                        }
                      }}
                      className="text-[#777777] hover:text-white ml-0.5 cursor-pointer leading-none"
                      title="Remove filter"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {canControl() && selectedIds.length > 0 && (
            <div className="flex min-h-9 w-full flex-wrap items-center justify-between gap-3 pt-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <p className="text-[14px] font-normal text-white">
                  <span className="font-medium">{selectedIds.length} of {filteredProcesses.length} selected</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="inline-flex items-center h-8 px-2.5 rounded-lg text-[14px] font-medium text-white bg-transparent hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="inline-flex items-center h-8 px-2.5 rounded-lg text-[14px] font-medium text-white bg-transparent hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                >
                  Select all {filteredProcesses.length} eligible processes
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleBulkControl('start')}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium text-[#d4d4d4] hover:text-white bg-transparent ring-1 ring-[#262626] hover:ring-[#383838] hover:bg-[#161616] transition-colors cursor-pointer"
                >
                  <PlayIcon className="w-4 h-4 shrink-0 text-[#8c8c8c]" />
                  <span>Start</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkControl('stop')}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium text-[#d4d4d4] hover:text-white bg-transparent ring-1 ring-[#262626] hover:ring-[#383838] hover:bg-[#161616] transition-colors cursor-pointer"
                >
                  <StopIcon className="w-4 h-4 shrink-0 text-[#8c8c8c]" />
                  <span>Stop</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkControl('restart')}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium text-[#d4d4d4] hover:text-white bg-transparent ring-1 ring-[#262626] hover:ring-[#383838] hover:bg-[#161616] transition-colors cursor-pointer"
                >
                  <RestartIcon className="w-4 h-4 shrink-0 text-[#8c8c8c]" />
                  <span>Restart</span>
                </button>
                {selectedIds.length === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = processes.find((x) => x.id === selectedIds[0]);
                      if (p) openEditModal(p);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[14px] font-medium text-white bg-transparent ring-1 ring-[#333333] hover:ring-[#555555] hover:bg-[#161616] transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z" />
                    </svg>
                    <span>Edit 1 process</span>
                  </button>
                )}
                {isAdmin() && (
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleting(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[14px] font-medium text-white bg-[#e5484d] hover:bg-[#d03d42] ring-1 ring-[#f87171]/40 shadow-xs transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
                    </svg>
                    <span>Delete {selectedIds.length} process{selectedIds.length !== 1 ? 'es' : ''}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inset Table Card with rounded corners matching media_1789681293575.png */}
        <div className="mx-3.5 mb-3.5 border border-[#262626] rounded-lg overflow-hidden bg-[#0e0e0e]">
          {/* Table surface — native table, sticky header */}
          <div className="overflow-x-auto overflow-y-hidden">
            <table
              role="table"
              aria-label="Monitored processes"
              aria-rowcount={filteredProcesses.length + 1}
              className="w-full min-w-[1100px] text-left border-collapse"
            >
              {/* Table Head — sticky, 40px, border-b */}
              <thead className="sticky top-0 z-10">
                <tr
                  role="row"
                  aria-rowindex={1}
                  className="flex w-full items-center border-b border-[#222222] bg-[#141414] h-[40px] min-h-[40px] max-h-[40px]"
                >
                {canControl() && (
                  <th
                    role="columnheader"
                    aria-colindex={1}
                    className="flex items-center justify-center shrink-0 w-[44px] min-w-[44px] h-[40px] rounded-tl-lg"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isAllPageSelected ? 'true' : isSomePageSelected ? 'mixed' : 'false'}
                      aria-label="Select all on this page"
                      onClick={handleSelectAll}
                      className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-[#141414] ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2f80ed] transition-all cursor-pointer data-[checked]:bg-[#2f80ed] data-[checked]:ring-[#2f80ed] data-[indeterminate]:bg-[#2f80ed] data-[indeterminate]:ring-[#2f80ed]"
                      data-checked={isAllPageSelected ? '' : undefined}
                      data-indeterminate={!isAllPageSelected && isSomePageSelected ? '' : undefined}
                    >
                      {isAllPageSelected ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                        </svg>
                      ) : selectedIds.length > 0 ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                          <path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z" />
                        </svg>
                      ) : null}
                    </button>
                  </th>
                )}

                {/* Status */}
                <th
                  role="columnheader"
                  aria-colindex={canControl() ? 2 : 1}
                  aria-sort={sortField === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => handleSort('status')}
                  style={{ width: `${columnWidths.status}px` }}
                  className={`group relative flex items-center shrink-0 h-[40px] pl-3 pr-4 cursor-pointer select-none ${!canControl() ? 'rounded-tl-lg' : ''}`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                    <span>Status</span>
                    <CaretUpDownIcon active={sortField === 'status'} direction={sortDirection} />
                  </span>
                  {/* Draggable Column Resizer (Cloudflare standard) */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Status column"
                    onMouseDown={(e) => handleResizeStart('status', e)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColumnWidths((prev) => ({ ...prev, status: 125 }));
                    }}
                    className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
                    title="Drag to resize column (double-click to reset)"
                  >
                    <span
                      className={`w-px h-4 transition-colors ${
                        resizingCol === 'status' ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
                      }`}
                    />
                  </div>
                </th>

                {/* Name */}
                <th
                  role="columnheader"
                  aria-colindex={canControl() ? 3 : 2}
                  aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => handleSort('name')}
                  style={{ width: `${columnWidths.name}px` }}
                  className="group relative flex items-center shrink-0 h-[40px] pl-3 pr-4 cursor-pointer select-none"
                >
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                    <span>Name</span>
                    <CaretUpDownIcon active={sortField === 'name'} direction={sortDirection} />
                  </span>
                  {/* Draggable Column Resizer (Cloudflare standard) */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Name column"
                    onMouseDown={(e) => handleResizeStart('name', e)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColumnWidths((prev) => ({ ...prev, name: 220 }));
                    }}
                    className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
                    title="Drag to resize column (double-click to reset)"
                  >
                    <span
                      className={`w-px h-4 transition-colors ${
                        resizingCol === 'name' ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
                      }`}
                    />
                  </div>
                </th>

                {visibleColumns.pid && (
                  <th
                    role="columnheader"
                    aria-sort={sortField === 'pid' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('pid')}
                    className="group relative flex items-center shrink-0 w-[84px] h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                      <span>PID</span>
                      <CaretUpDownIcon active={sortField === 'pid'} direction={sortDirection} />
                    </span>
                  </th>
                )}
                {visibleColumns.cpu && (
                  <th
                    role="columnheader"
                    aria-sort={sortField === 'cpu' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('cpu')}
                    className="group relative flex items-center shrink-0 w-[84px] h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                      <span>CPU</span>
                      <CaretUpDownIcon active={sortField === 'cpu'} direction={sortDirection} />
                    </span>
                  </th>
                )}
                {visibleColumns.memory && (
                  <th
                    role="columnheader"
                    aria-sort={sortField === 'memory' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('memory')}
                    className="group relative flex items-center shrink-0 w-[96px] h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                      <span>Memory</span>
                      <CaretUpDownIcon active={sortField === 'memory'} direction={sortDirection} />
                    </span>
                  </th>
                )}
                {visibleColumns.uptime && (
                  <th
                    role="columnheader"
                    aria-sort={sortField === 'uptime' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('uptime')}
                    className="group relative flex items-center shrink-0 w-[120px] h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                      <span>Uptime</span>
                      <CaretUpDownIcon active={sortField === 'uptime'} direction={sortDirection} />
                    </span>
                  </th>
                )}
                {visibleColumns.restarts && (
                  <th
                    role="columnheader"
                    aria-sort={sortField === 'restarts' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('restarts')}
                    style={{ width: `${columnWidths.restarts}px` }}
                    className="group relative flex items-center shrink-0 h-[40px] pl-3 pr-4 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                      <span>Restarts</span>
                      <CaretUpDownIcon active={sortField === 'restarts'} direction={sortDirection} />
                    </span>
                    {/* Draggable Column Resizer after Restarts */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize Restarts column"
                      onMouseDown={(e) => handleResizeStart('restarts', e)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setColumnWidths((prev) => ({ ...prev, restarts: 125 }));
                      }}
                      className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
                      title="Drag to resize column (double-click to reset)"
                    >
                      <span
                        className={`w-px h-4 transition-colors ${
                          resizingCol === 'restarts' ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
                        }`}
                      />
                    </div>
                  </th>
                )}
                {visibleColumns.command && (
                  <th
                    role="columnheader"
                    className="relative flex items-center flex-1 min-w-[260px] h-[40px] pl-4 pr-3 select-none"
                  >
                    <span className="text-[14px] font-medium text-white leading-none">Command</span>
                  </th>
                )}

                {/* Actions header — sticky */}
                <th
                  role="columnheader"
                  className="flex items-center justify-end shrink-0 w-[80px] h-[40px] px-3 sticky right-0 bg-[#141414] z-10"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody role="rowgroup" className="divide-y divide-[#1e1e1e]">
              {filteredProcesses.length === 0 ? (
                <tr role="row">
                  <td
                    role="cell"
                    colSpan={12}
                    className="px-4 py-12 text-center border-b border-[#1e1e1e] bg-[#0e0e0e]"
                  >
                    <p className="text-[14px] leading-relaxed text-[#6b6b6b] font-normal">
                      No processes match your search or filter.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedProcesses.map((p, rowIndex) => {
                  const isRunning = p.status === 'running';
                  const isChecked = selectedIds.includes(p.id);
                  const ariaRowIndex = startIndex + rowIndex + 2;
                  return (
                    <tr
                      key={p.id}
                      role="row"
                      aria-rowindex={ariaRowIndex}
                      aria-selected={isChecked}
                      className={`group/row flex w-full items-center h-[40px] min-h-[40px] max-h-[40px] border-b border-[#1e1e1e] transition-colors ${
                        isChecked ? 'bg-[#181818] hover:bg-[#181818]' : 'bg-[#0e0e0e] hover:bg-[#161616]'
                      }`}
                    >
                      {canControl() && (
                        <td
                          role="cell"
                          className="flex items-center justify-center shrink-0 w-[44px] min-w-[44px] h-[40px]"
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-label={`Select ${p.name}`}
                            onClick={() => handleSelectOne(p.id)}
                            className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-black ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2f80ed] transition-all cursor-pointer data-[checked]:bg-[#2f80ed] data-[checked]:ring-[#2f80ed]"
                            data-checked={isChecked ? '' : undefined}
                          >
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                                <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                              </svg>
                            )}
                          </button>
                        </td>
                      )}

                      {/* Status */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.status}px` }}
                        className="flex items-center shrink-0 h-[40px] pl-3 pr-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isRunning ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#30a46c] shrink-0" />
                              <span className="text-[14px] font-normal text-white leading-none">Running</span>
                            </>
                          ) : p.status === 'crashed' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#e5484d] shrink-0" />
                              <span className="text-[14px] font-normal text-[#e5484d] leading-none">Crashed</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#3a3a3a] shrink-0 ring-1 ring-[#555555]" />
                              <span className="text-[14px] font-normal text-[#8c8c8c] leading-none">Stopped</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.name}px` }}
                        className="flex items-center shrink-0 h-[40px] pl-3 pr-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="text-left truncate text-[14px] font-normal text-white hover:text-[#2f80ed] hover:underline underline-offset-2 decoration-[#2f80ed]/40 transition-colors cursor-pointer"
                            title={p.name}
                          >
                            {p.name}
                          </button>
                          {p.group_name && p.group_name !== 'Default' && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] leading-none font-normal text-[#8c8c8c] bg-[#141414] border border-[#232323]">
                              {p.group_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {visibleColumns.pid && (
                        <td role="cell" className="flex items-center shrink-0 w-[84px] h-[40px] px-3 overflow-hidden">
                          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                            {p.pid ? String(p.pid) : '—'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.cpu && (
                        <td role="cell" className="flex items-center shrink-0 w-[84px] h-[40px] px-3 overflow-hidden">
                          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                            {typeof p.cpu === 'number' ? (p.cpu > 0 ? `${p.cpu}%` : '0%') : p.cpu || '0%'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.memory && (
                        <td role="cell" className="flex items-center shrink-0 w-[96px] h-[40px] px-3 overflow-hidden">
                          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                            {p.mem || '0 MB'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.uptime && (
                        <td role="cell" className="flex items-center shrink-0 w-[120px] h-[40px] px-3 overflow-hidden">
                          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                            {isRunning ? p.uptime : '—'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.restarts && (
                        <td
                          role="cell"
                          style={{ width: `${columnWidths.restarts}px` }}
                          className="flex items-center shrink-0 h-[40px] pl-3 pr-4 overflow-hidden"
                        >
                          {p.restart_count > 0 ? (
                            <span
                              title={`${p.restart_count} restart${p.restart_count !== 1 ? 's' : ''}`}
                              className="inline-flex items-center gap-1.5 text-[14px] font-normal text-[#d4d4d4] tabular-nums"
                            >
                              <RestartIcon className="w-3.5 h-3.5 text-[#8c8c8c] shrink-0" />
                              <span>{p.restart_count}</span>
                            </span>
                          ) : (
                            <span className="text-[14px] font-normal text-[#666666] tabular-nums">0</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.command && (
                        <td role="cell" className="flex items-center flex-1 min-w-[260px] h-[40px] pl-4 pr-3 overflow-hidden">
                          <span className="truncate font-mono text-[13px] leading-none text-[#8c8c8c] block w-full" title={p.command}>
                            {p.command}
                          </span>
                        </td>
                      )}

                      {/* Actions — sticky with fade gradient, compact Edit button */}
                      <td
                        role="cell"
                        className={`flex items-center justify-end shrink-0 w-[80px] h-[40px] px-3 sticky right-0 transition-colors z-[1] ${
                          isChecked ? 'bg-[#181818]' : 'bg-[#0e0e0e] group-hover/row:bg-[#161616]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-y-0 -left-4 w-4 bg-gradient-to-r from-transparent ${
                            isChecked ? 'to-[#181818]' : 'to-[#0e0e0e] group-hover/row:to-[#161616]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center justify-center h-7 px-3 rounded-md text-[14px] font-medium leading-none text-white hover:text-white bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer — pagination controls */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#222222] bg-[#0e0e0e] rounded-b-lg">
          <span className="text-[13px] text-[#8c8c8c] font-normal select-none">
            Showing <span className="text-[#cccccc] font-medium tabular-nums">{totalItems === 0 ? 0 : `${startIndex + 1}–${endIndex}`}</span> of <span className="text-[#cccccc] font-medium tabular-nums">{totalItems}</span>
          </span>
          <div className="flex items-center gap-2 select-none">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-normal text-[#8c8c8c] hover:text-white hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:hover:text-[#8c8c8c] disabled:cursor-not-allowed transition-all cursor-pointer"
              aria-label="Previous page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
              </svg>
              <span>Previous</span>
            </button>

            <span className="text-[13px] text-[#8c8c8c] px-1 font-normal">
              Page <span className="text-[#cccccc] font-medium tabular-nums">{currentPage}</span> of <span className="text-[#cccccc] font-medium tabular-nums">{totalPages}</span>
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-normal text-[#8c8c8c] hover:text-white hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:hover:text-[#8c8c8c] disabled:cursor-not-allowed transition-all cursor-pointer"
              aria-label="Next page"
            >
              <span>Next</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Add / Edit Process Drawer */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={editingProcess ? 'Edit process' : 'Add process'}
        subtitle={
          liveEditingProcess ? (
            <div className="flex items-center gap-2 text-[14px] text-[#8c8c8c] mt-0.5">
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                  liveEditingProcess.status === 'running'
                    ? 'bg-[#10b981]'
                    : liveEditingProcess.status === 'crashed'
                    ? 'bg-[#f59e0b]'
                    : 'bg-[#ef4444]'
                }`}
              />
              <span className="capitalize font-medium text-[#d4d4d4]">{liveEditingProcess.status}</span>
              {liveEditingProcess.pid && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span>PID {liveEditingProcess.pid}</span>
                </>
              )}
            </div>
          ) : undefined
        }
      >
        <form onSubmit={handleSaveProcess} className="flex flex-col h-full min-h-0">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {/* Action buttons (Clean Cloudflare toolbar style) */}
            {liveEditingProcess && canControl() && (
              <div className="flex items-center gap-2 pb-2.5 mb-0.5">
                <button
                  type="button"
                  disabled={liveEditingProcess.status === 'running' || !!actionLoadingMap[`${liveEditingProcess.id}-start`]}
                  onClick={() => handleControl(liveEditingProcess.id, 'start')}
                  className="h-8 px-3 rounded-lg text-[14px] font-medium text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {actionLoadingMap[`${liveEditingProcess.id}-start`] ? 'Starting...' : 'Start'}
                </button>
                <button
                  type="button"
                  disabled={liveEditingProcess.status !== 'running' || !!actionLoadingMap[`${liveEditingProcess.id}-stop`]}
                  onClick={() => handleControl(liveEditingProcess.id, 'stop')}
                  className="h-8 px-3 rounded-lg text-[14px] font-medium text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {actionLoadingMap[`${liveEditingProcess.id}-stop`] ? 'Stopping...' : 'Stop'}
                </button>
                <button
                  type="button"
                  disabled={!!actionLoadingMap[`${liveEditingProcess.id}-restart`]}
                  onClick={() => handleControl(liveEditingProcess.id, 'restart')}
                  className="h-8 px-3 rounded-lg text-[14px] font-medium text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {actionLoadingMap[`${liveEditingProcess.id}-restart`] ? 'Restarting...' : 'Restart'}
                </button>
                {isAdmin() && (
                  <button
                    type="button"
                    onClick={() => setDeletingId(liveEditingProcess.id)}
                    className="h-8 px-3 rounded-lg text-[14px] font-medium text-[#8c8c8c] hover:text-[#ef4444] bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#ef4444]/40 transition-colors cursor-pointer ml-auto"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}

            {/* Form fields */}
            <div>
              <label className="block text-[14px] font-medium text-[#a1a1a1] mb-1.5">
                Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Process name"
                className="w-full h-9 px-3 rounded-lg bg-[#080808] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#a1a1a1] mb-1.5">
                Group
              </label>
              <input
                type="text"
                list="drawer-available-groups"
                value={formData.group_name}
                onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                placeholder="Default"
                className="w-full h-9 px-3 rounded-lg bg-[#080808] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors"
              />
              <datalist id="drawer-available-groups">
                {availableGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#a1a1a1] mb-1.5">
                Command
              </label>
              <input
                type="text"
                required
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                placeholder="./run.sh"
                className="w-full h-9 px-3 font-mono text-[14px] rounded-lg bg-[#080808] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[#e0e0e0] placeholder-[#555555] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#a1a1a1] mb-1.5">
                Working directory <span className="text-[13px] font-normal text-[#666666] ml-1">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.working_dir}
                onChange={(e) => setFormData({ ...formData, working_dir: e.target.value })}
                placeholder="/path/to/directory"
                className="w-full h-9 px-3 font-mono text-[14px] rounded-lg bg-[#080808] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[#e0e0e0] placeholder-[#555555] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#a1a1a1] mb-1.5">
                Log file <span className="text-[13px] font-normal text-[#666666] ml-1">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.log_file}
                onChange={(e) => setFormData({ ...formData, log_file: e.target.value })}
                placeholder="output.log"
                className="w-full h-9 px-3 font-mono text-[14px] rounded-lg bg-[#080808] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[#e0e0e0] placeholder-[#555555] outline-none transition-colors"
              />
            </div>
          </div>

          {/* Pinned Bottom Footer Bar */}
          <div className="shrink-0 px-4 py-3 bg-[#0e0e0e] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSlideOverOpen(false)}
              className="h-9 px-4 rounded-lg text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="h-9 px-5 rounded-lg text-[14px] font-medium text-white bg-[#2f80ed] hover:bg-[#2563eb] disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
            >
              {formLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingId !== null || isBulkDeleting}
        onClose={() => {
          setDeletingId(null);
          setIsBulkDeleting(false);
        }}
        onConfirm={confirmDelete}
        title={isBulkDeleting ? `Delete ${selectedIds.length} Monitored Processes` : "Delete Monitored Process"}
        message={
          isBulkDeleting
            ? `Are you sure you want to delete ${selectedIds.length} processes? Any running processes will be forcefully terminated.`
            : "Are you sure you want to delete this process? If it is running, it will be forcefully terminated."
        }
        confirmLabel={isBulkDeleting ? `Delete ${selectedIds.length} Processes` : "Delete Process"}
        variant="danger"
        isLoading={deleteLoading}
      />
    </div>
  );
};
