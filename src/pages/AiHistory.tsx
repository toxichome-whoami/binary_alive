import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { aiApi, AiHistoryData } from '../api/ai';
import { Bot, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const safeUrl = (url: string) => {
  const u = (url || '').trim().toLowerCase();
  if (u.startsWith('javascript:') || u.startsWith('vbscript:') || u.startsWith('data:')) return '#';
  return url;
};
import { DataTable, type Column } from '../components/shared/DataTable';
import { format } from 'date-fns';
import { DateRangePicker } from '../components/shared/DateRangePicker';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useToastStore } from '../store/toastStore';

export const AiHistory: React.FC = () => {
  const { isOwner } = useAuthStore();
  const pushToast = useToastStore((s) => s.push);
  const [history, setHistory] = useState<AiHistoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('aiHistoryPageSize');
    return saved ? Number(saved) : 10;
  });
  const [totalCount, setTotalCount] = useState(0);

  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('Live (60s)');
  const [minDate, setMinDate] = useState<Date | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AiHistoryData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await aiApi.deleteHistory(deleteTarget.id);
      if (res.success) {
        pushToast('success', 'History record deleted');
        setDeleteTarget(null);
        // Table will auto-refresh via websocket
      } else {
        pushToast('error', res.error || 'Failed to delete record');
      }
    } catch (e) {
      pushToast('error', 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (isOwner()) {
      aiApi.getBounds().then(res => {
        if (res.success && res.data && res.data.min_time) {
          setMinDate(new Date(res.data.min_time + 'Z'));
        }
      }).catch(console.error);
    }
  }, [isOwner]);

  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const displayOptionsRef = useRef<HTMLDivElement | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('aiHistoryColumns');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      user: true,
      email: true,
      message: true,
      response: true,
      time: true,
      actions: true,
    };
  });

  const handleToggleColumn = (id: string) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [id]: prev[id] === false ? true : false };
      localStorage.setItem('aiHistoryColumns', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (displayOptionsRef.current && !displayOptionsRef.current.contains(e.target as Node)) {
        setShowDisplayOptions(false);
      }
    };
    if (showDisplayOptions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDisplayOptions]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await aiApi.getHistory(page, pageSize, startDate, endDate);
      if (res.success) {
        setHistory(res.data.data);
        setTotalCount(res.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, startDate, endDate]);

  useEffect(() => {
    if (isOwner()) {
      fetchHistory();
    } else {
      setIsLoading(false);
    }
  }, [isOwner, fetchHistory]);

  useEffect(() => {
    const handleUpdate = () => {
      if (isOwner()) fetchHistory();
    };
    window.addEventListener('ai-history-updated', handleUpdate);
    return () => window.removeEventListener('ai-history-updated', handleUpdate);
  }, [isOwner, fetchHistory]);

  const columns: Column<AiHistoryData>[] = useMemo(() => [
    {
      id: 'user',
      header: 'User',
      width: 140,
      className: 'px-4',
      cell: (log) => (
        <div className="flex items-start h-full pt-[9px] pb-2">
          <span className="text-[13px] font-medium text-white truncate leading-relaxed">
            {log.username || `User #${log.user_id}`}
          </span>
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      width: 180,
      className: 'px-4',
      cell: (log) => (
        <div className="flex items-start h-full pt-[9px] pb-2">
          <span className="text-[13px] text-[#8c8c8c] truncate leading-relaxed">
            {log.email}
          </span>
        </div>
      ),
    },
    {
      id: 'prompt',
      header: 'Prompt',
      isSortable: false,
      isFlex: true,
      className: 'px-4',
      cell: (log) => (
        <div className="w-full pt-[9px] pb-2 flex flex-col justify-start h-full">
          <div className="text-[13px] text-[#a0a0a0] leading-relaxed whitespace-pre-wrap break-words max-h-[22px] group-hover/row:max-h-[300px] group-hover/row:overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded-full transition-[max-height] duration-[400ms] ease-in-out overflow-hidden">
            <div className="line-clamp-1 group-hover/row:line-clamp-none">
              {log.message}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'response',
      header: 'AI Response',
      isSortable: false,
      isFlex: true,
      className: 'px-4',
      cell: (log) => (
        <div className="w-full pt-[9px] pb-2 flex flex-col justify-start h-full">
          <div className="text-[13px] text-white leading-relaxed markdown-body selection:bg-[#2f80ed] selection:text-white max-h-[22px] group-hover/row:max-h-[400px] group-hover/row:overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded-full transition-[max-height] duration-[400ms] ease-in-out overflow-hidden">
            <div className="line-clamp-1 group-hover/row:line-clamp-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrl}>
                {(log.response || '').slice(0, 20000)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      width: 140,
      className: 'px-4',
      cell: (log) => (
        <div className="flex items-start h-full pt-[9px] pb-2">
          <span className="text-[13px] text-[#8c8c8c] whitespace-nowrap leading-relaxed">
            {format(new Date(log.created_at.replace(' ', 'T') + 'Z'), 'MMM d, yyyy HH:mm:ss')}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: <div className="w-full text-right">Action</div>,
      width: 80,
      className: 'px-4',
      cell: (log) => (
        <div className="flex justify-end items-start h-full w-full pt-[7px] pb-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(log);
            }}
            className="p-1.5 text-[#8c8c8c] hover:text-[#ef4444] rounded-md transition-colors opacity-0 group-hover/row:opacity-100 hover:bg-[#ef4444]/10"
            title="Delete record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], []);

  if (!isOwner()) {
    return (
      <div className="w-full h-[80vh] flex items-center justify-center font-sans bg-[#050505]">
        <div className="text-center space-y-3">
          <Bot className="w-12 h-12 text-[#383838] mx-auto" />
          <h2 className="text-[18px] font-medium text-white">Access Denied</h2>
          <p className="text-[14px] text-[#8c8c8c]">Only owners can view AI History.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily:
          '"Inter Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      }}
      className="flex flex-col gap-4 w-full max-w-[1600px] mx-auto pb-12 select-none font-sans"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div className="flex flex-col">
          <h1 className="text-[16px] font-semibold text-white tracking-tight font-sans">
            AI History
          </h1>
          <p className="text-[13px] text-[#8c8c8c] font-sans mt-0.5">
            Live feed of platform interactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker 
            selectedRangeLabel={selectedRangeLabel}
            minDate={minDate}
            onRangeChange={(label, start, end) => {
              setSelectedRangeLabel(label);
              setStartDate(start ? start.toISOString() : undefined);
              setEndDate(end ? end.toISOString() : undefined);
              setPage(1);
            }}
          />

          <div className="relative" ref={displayOptionsRef}>
            <button
              type="button"
              onClick={() => setShowDisplayOptions(!showDisplayOptions)}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-transparent border text-[14px] font-medium transition-colors cursor-pointer shrink-0 font-sans ${showDisplayOptions ? 'border-[#444444] text-white bg-[#141414]' : 'border-[#262626] text-white hover:bg-[#141414] hover:border-[#383838]'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
                <path d="M222.87,74.56,134.87,23.75a16,16,0,0,0-15.74,0L31.13,74.56A16,16,0,0,0,23.26,88.4v101.6a16,16,0,0,0,7.87,13.84l88,50.81a16,16,0,0,0,15.74,0l88-50.81a16,16,0,0,0,7.87-13.84V88.4A16,16,0,0,0,222.87,74.56ZM127,160a32,32,0,1,1,32-32A32,32,0,0,1,127,160Z" />
              </svg>
              <span>Display options</span>
            </button>
            {showDisplayOptions && (
              <div className="absolute right-0 top-10 w-52 rounded-md bg-[#0c0c0c] border border-[#262626] shadow-xl p-1 z-40 select-none font-sans">
                {[
                  { id: 'user', label: 'User' },
                  { id: 'email', label: 'Email' },
                  { id: 'message', label: 'Prompt' },
                  { id: 'response', label: 'Response' },
                  { id: 'time', label: 'Time' },
                  { id: 'actions', label: 'Action' }
                ].map((col) => {
                  const isVisible = visibleColumns[col.id] !== false;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleToggleColumn(col.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[14px] text-[#cccccc] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                    >
                      <span className={isVisible ? 'text-white' : 'text-[#777777]'}>
                        {col.label}
                      </span>
                      {isVisible && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" className="text-white shrink-0">
                          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            className="flex items-center justify-center h-9 w-9 text-[#8c8c8c] hover:text-white rounded-lg bg-transparent hover:bg-[#141414] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0"
            title="Reload history"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>

      <DataTable
        columns={columns.filter(c => visibleColumns[c.id] !== false)}
        data={history}
        isLoading={isLoading}
        pagination={{
          page,
          pageSize,
          totalCount,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            localStorage.setItem('aiHistoryPageSize', String(newSize));
            setPage(1);
          },
          pageSizeOptions: [10, 20, 50, 100]
        }}
        emptyMessage="No AI history found."
        className="border-[#262626]"
        allowRowExpansion={true}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete AI History"
        message="Are you sure you want to delete this AI conversation history? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
