import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logsApi } from '../api/logs';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import type { AuditLog, LoginAttemptLog } from '../types';
import { SlideOver } from '../components/ui/SlideOver';
import { format } from 'date-fns';
import {
  FileText,
  KeyRound,
  Terminal as TerminalIcon,
  Copy,
  Check,
} from 'lucide-react';
import { DateRangePicker } from '../components/shared/DateRangePicker';
import { TelemetryCard, cubicBezierY, formatTimeFromPct } from '../components/shared/TelemetryCard';
import { DataTable, type Column } from '../components/shared/DataTable';







// ============================================================================
// Rich, Realistic Data Sets (30+ entries each for deep table pagination)
// ============================================================================

// ============================================================================
// Real Data Fetching
// ============================================================================

// ============================================================================
// Filter and Display Types and Configurations
// ============================================================================

export type LogFilterField = 'username' | 'email' | 'action' | 'details' | 'ip_address' | 'status';
export type LogFilterOperator = 'contains' | 'equals' | 'starts_with' | 'is' | 'is_not';

export interface LogFilterRule {
  id: string;
  field: LogFilterField;
  operator: LogFilterOperator;
  value: string;
}

const AUDIT_FILTER_FIELD_OPTIONS: { value: LogFilterField; label: string }[] = [
  { value: 'username', label: 'User' },
  { value: 'email', label: 'Email' },
  { value: 'action', label: 'Action' },
  { value: 'details', label: 'Details' },
  { value: 'ip_address', label: 'IP Address' },
];

const LOGIN_FILTER_FIELD_OPTIONS: { value: LogFilterField; label: string }[] = [
  { value: 'username', label: 'User' },
  { value: 'email', label: 'Email' },
  { value: 'status', label: 'Auth Result' },
  { value: 'details', label: 'Details' },
  { value: 'ip_address', label: 'IP Address' },
];

const TERMINAL_FILTER_FIELD_OPTIONS: { value: LogFilterField; label: string }[] = [
  { value: 'username', label: 'User' },
  { value: 'email', label: 'Email' },
  { value: 'details', label: 'Command' },
  { value: 'ip_address', label: 'IP Address' },
];

const LOGIN_STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
];

const getLogFilterOperatorOptions = (field: LogFilterField): { value: LogFilterOperator; label: string }[] => {
  if (field === 'status') {
    return [
      { value: 'is', label: 'is' },
      { value: 'is_not', label: 'is not' },
    ];
  }
  return [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' },
    { value: 'starts_with', label: 'starts with' },
  ];
};

const AUDIT_COLUMNS_CONFIG = [
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'username', label: 'User' },
  { id: 'email', label: 'Email' },
  { id: 'action', label: 'Action' },
  { id: 'details', label: 'Details' },
  { id: 'ip_address', label: 'IP Address' },
];

const LOGIN_COLUMNS_CONFIG = [
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'username', label: 'User' },
  { id: 'email', label: 'Email' },
  { id: 'action', label: 'Auth Result' },
  { id: 'details', label: 'Details' },
  { id: 'ip_address', label: 'IP Address' },
];

const TERMINAL_COLUMNS_CONFIG = [
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'username', label: 'User' },
  { id: 'email', label: 'Email' },
  { id: 'action', label: 'Status' },
  { id: 'details', label: 'Command' },
  { id: 'ip_address', label: 'IP Address' },
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
        className={`w-full h-9 px-3 rounded-[8px] bg-[#141414] border text-[14px] text-white flex items-center justify-between cursor-pointer transition-colors ${
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
                    ? 'bg-[#181818] text-white font-medium'
                    : 'text-[#cccccc] hover:bg-[#141414] hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    fill="currentColor"
                    viewBox="0 0 256 256"
                    className="text-[#2f80ed] shrink-0"
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

export const Logs: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'audit' | 'login' | 'terminal'>('audit');

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginAttemptLog[]>([]);
  const [termLogs, setTermLogs] = useState<AuditLog[]>([]);

  // Total counts from API
  const [totalAuditItems, setTotalAuditItems] = useState(0);
  const [totalLoginItems, setTotalLoginItems] = useState(0);
  const [totalTermItems, setTotalTermItems] = useState(0);

  // Table controls
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('Live (60s)');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [minDate, setMinDate] = useState<Date | null>(null);

  useEffect(() => {
    logsApi.getBounds().then(res => {
      if (res.success && res.data && res.data.min_time) {
        setMinDate(new Date(res.data.min_time + "Z"));
      }
    }).catch(console.error);
  }, []);

  // Filter and display options state
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const displayOptionsRef = useRef<HTMLDivElement | null>(null);

  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');

  // Filter rules per tab
  const [auditFilterRules, setAuditFilterRules] = useState<LogFilterRule[]>([
    { id: '1', field: 'username', operator: 'contains', value: '' },
  ]);
  const [appliedAuditFilterRules, setAppliedAuditFilterRules] = useState<LogFilterRule[]>([]);

  const [loginFilterRules, setLoginFilterRules] = useState<LogFilterRule[]>([
    { id: '1', field: 'username', operator: 'contains', value: '' },
  ]);
  const [appliedLoginFilterRules, setAppliedLoginFilterRules] = useState<LogFilterRule[]>([]);

  const [termFilterRules, setTermFilterRules] = useState<LogFilterRule[]>([
    { id: '1', field: 'username', operator: 'contains', value: '' },
  ]);
  const [appliedTermFilterRules, setAppliedTermFilterRules] = useState<LogFilterRule[]>([]);

  // Visible columns per tab
  const [auditVisibleColumns, setAuditVisibleColumns] = useState<Record<string, boolean>>({
    timestamp: true,
    username: true,
    email: true,
    action: true,
    details: true,
    ip_address: true,
  });

  const [loginVisibleColumns, setLoginVisibleColumns] = useState<Record<string, boolean>>({
    timestamp: true,
    username: true,
    email: true,
    action: true,
    details: true,
    ip_address: true,
  });

  const [termVisibleColumns, setTermVisibleColumns] = useState<Record<string, boolean>>({
    timestamp: true,
    username: true,
    email: true,
    action: true,
    details: true,
    ip_address: true,
  });

  const currentFilterRules =
    activeTab === 'audit'
      ? auditFilterRules
      : activeTab === 'login'
      ? loginFilterRules
      : termFilterRules;

  const setCurrentFilterRules = (updater: React.SetStateAction<LogFilterRule[]>) => {
    if (activeTab === 'audit') setAuditFilterRules(updater);
    else if (activeTab === 'login') setLoginFilterRules(updater);
    else setTermFilterRules(updater);
  };

  const currentAppliedFilterRules =
    activeTab === 'audit'
      ? appliedAuditFilterRules
      : activeTab === 'login'
      ? appliedLoginFilterRules
      : appliedTermFilterRules;

  const setCurrentAppliedFilterRules = (updater: React.SetStateAction<LogFilterRule[]>) => {
    if (activeTab === 'audit') setAppliedAuditFilterRules(updater);
    else if (activeTab === 'login') setAppliedLoginFilterRules(updater);
    else setAppliedTermFilterRules(updater);
  };

  const currentFilterFieldOptions =
    activeTab === 'audit'
      ? AUDIT_FILTER_FIELD_OPTIONS
      : activeTab === 'login'
      ? LOGIN_FILTER_FIELD_OPTIONS
      : TERMINAL_FILTER_FIELD_OPTIONS;

  const currentColumnsConfig =
    activeTab === 'audit'
      ? AUDIT_COLUMNS_CONFIG
      : activeTab === 'login'
      ? LOGIN_COLUMNS_CONFIG
      : TERMINAL_COLUMNS_CONFIG;

  const currentVisibleColumns =
    activeTab === 'audit'
      ? auditVisibleColumns
      : activeTab === 'login'
      ? loginVisibleColumns
      : termVisibleColumns;

  const setCurrentVisibleColumns = (colId: string) => {
    if (activeTab === 'audit') {
      setAuditVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
    } else if (activeTab === 'login') {
      setLoginVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
    } else {
      setTermVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
    }
  };

  const resetCurrentVisibleColumns = () => {
    const allTrue = {
      timestamp: true,
      username: true,
      email: true,
      action: true,
      details: true,
      ip_address: true,
    };
    if (activeTab === 'audit') setAuditVisibleColumns(allTrue);
    else if (activeTab === 'login') setLoginVisibleColumns(allTrue);
    else setTermVisibleColumns(allTrue);
  };

  const addFilterRule = () => {
    setCurrentFilterRules((prev) => [
      ...prev,
      { id: String(Date.now()), field: currentFilterFieldOptions[0].value, operator: 'contains', value: '' },
    ]);
  };

  const removeFilterRule = (id: string) => {
    setCurrentFilterRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateFilterRule = (id: string, patch: Partial<LogFilterRule>) => {
    setCurrentFilterRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const handleFieldChange = (id: string, newField: LogFilterField) => {
    const ops = getLogFilterOperatorOptions(newField);
    let initialValue = '';
    if (newField === 'status') initialValue = 'success';

    setCurrentFilterRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              field: newField,
              operator: ops[0].value,
              value: initialValue,
            }
          : r
      )
    );
  };

  const handleApplyFilters = () => {
    const valid = currentFilterRules.filter((r) => r.value.trim() !== '');
    setCurrentAppliedFilterRules(valid);
    setShowFilters(false);
    setPage(1);
  };

  const handleClearFilters = () => {
    setCurrentAppliedFilterRules([]);
    setCurrentFilterRules([
      { id: '1', field: currentFilterFieldOptions[0].value, operator: 'contains', value: '' },
    ]);
    setShowFilters(false);
    setPage(1);
  };

  const removeSingleAppliedFilter = (id: string) => {
    setCurrentAppliedFilterRules((prev) => prev.filter((r) => r.id !== id));
    setPage(1);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (displayOptionsRef.current && !displayOptionsRef.current.contains(target)) {
        setShowDisplayOptions(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(target)) {
        setShowFilters(false);
      }
    };
    if (showDisplayOptions || showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDisplayOptions, showFilters]);



  // SlideOver event inspector state
  const [selectedLog, setSelectedLog] = useState<AuditLog | LoginAttemptLog | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Computed email for currently selected log in SlideOver inspector
  const selectedLogEmail = useMemo(() => {
    if (!selectedLog) return null;
    if ('email' in selectedLog && (selectedLog as AuditLog).email) {
      return (selectedLog as AuditLog).email;
    }
    if (selectedLog.username && selectedLog.username === currentUser?.username) {
      return currentUser?.email || null;
    }
    return null;
  }, [selectedLog, currentUser]);

  const handleCopyField = (val: string, fieldName: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(fieldName);
    pushToast('success', `${fieldName} copied`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // VS Code Dark+ JSON Syntax Highlighter
  const renderHighlightedJson = (jsonString: string): React.ReactNode => {
    const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(jsonString)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        elements.push(jsonString.substring(lastIndex, matchIndex));
      }

      const token = match[0];

      if (/^"/.test(token)) {
        if (/:$/.test(token)) {
          // Property key: VS Code light blue (#9cdcfe)
          const colonIdx = token.lastIndexOf(':');
          const keyPart = token.slice(0, colonIdx);
          const colonPart = token.slice(colonIdx);
          elements.push(
            <span key={matchIndex} className="text-[#9cdcfe]">
              {keyPart}
            </span>
          );
          elements.push(
            <span key={`${matchIndex}-c`} className="text-[#d4d4d4]">
              {colonPart}
            </span>
          );
        } else {
          // String value: VS Code orange/salmon (#ce9178)
          elements.push(
            <span key={matchIndex} className="text-[#ce9178]">
              {token}
            </span>
          );
        }
      } else if (/^(true|false|null)$/.test(token)) {
        // Boolean or Null: VS Code blue (#569cd6)
        elements.push(
          <span key={matchIndex} className="text-[#569cd6]">
            {token}
          </span>
        );
      } else if (/^-?\d/.test(token)) {
        // Number: VS Code light green (#b5cea8)
        elements.push(
          <span key={matchIndex} className="text-[#b5cea8]">
            {token}
          </span>
        );
      } else if (token === '{' || token === '}' || token === '[' || token === ']') {
        // Brackets: VS Code gold (#ffd700)
        elements.push(
          <span key={matchIndex} className="text-[#ffd700]">
            {token}
          </span>
        );
      } else {
        // Punctuation: VS Code foreground grey (#d4d4d4)
        elements.push(
          <span key={matchIndex} className="text-[#d4d4d4]">
            {token}
          </span>
        );
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < jsonString.length) {
      elements.push(jsonString.substring(lastIndex));
    }

    return elements;
  };

  // Search input ref for Ctrl+K
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: '/' to search, 'Escape' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
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

  // Fetch real data from server
  const loadLogs = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setIsLoading(true);
      try {
        if (activeTab === 'audit') {
          const res = await logsApi.getAuditLogs(page, pageSize, searchQuery, sortField, sortDirection, startDate, endDate);
          if (res.success && res.data && res.data.data) {
            setAuditLogs(res.data.data);
            setTotalAuditItems(res.data.total);
          }
        } else if (activeTab === 'login') {
          const res = await logsApi.getLoginLogs(page, pageSize, searchQuery, sortField, sortDirection, startDate, endDate);
          if (res.success && res.data && res.data.data) {
            setLoginLogs(res.data.data);
            setTotalLoginItems(res.data.total);
          }
        } else if (activeTab === 'terminal') {
          const res = await logsApi.getTerminalLogs(page, pageSize, searchQuery, sortField, sortDirection, startDate, endDate);
          if (res.success && res.data && res.data.data) {
            setTermLogs(res.data.data);
            setTotalTermItems(res.data.total);
          }
        }
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to load logs');
      } finally {
        if (showSpinner) setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, page, pageSize, searchQuery, sortField, sortDirection, startDate, endDate, pushToast]
  );

  useEffect(() => {
    loadLogs(false);
  }, [loadLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadLogs(false);
    pushToast('info', 'Telemetry and audit events refreshed');
  };

  const handleTabChange = (tab: 'audit' | 'login' | 'terminal') => {
    setActiveTab(tab);
    setPage(1);
    setSearchQuery('');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter & sort audit logs
  const filteredAuditLogs = useMemo(() => {
    let list = [...auditLogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          l.ip_address.includes(q)
      );
    }

    if (appliedAuditFilterRules.length > 0) {
      list = list.filter((l) => {
        const evalAuditRule = (rule: LogFilterRule) => {
          const val = rule.value.trim().toLowerCase();
          if (!val) return true;

          if (rule.field === 'username') {
            const target = (l.username || 'system').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'email') {
            const target = (l.email || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'action') {
            const target = (l.action || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'details') {
            const target = (l.details || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'ip_address') {
            const target = (l.ip_address || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          }
          return true;
        };

        return matchMode === 'any'
          ? appliedAuditFilterRules.some(evalAuditRule)
          : appliedAuditFilterRules.every(evalAuditRule);
      });
    }

    list.sort((a, b) => {
      if (sortField === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = String(a[sortField as keyof AuditLog] ?? '');
      const valB = String(b[sortField as keyof AuditLog] ?? '');
      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [auditLogs, searchQuery, appliedAuditFilterRules, matchMode, sortField, sortDirection]);

  // Filter & sort login logs
  const filteredLoginLogs = useMemo(() => {
    let list = [...loginLogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          l.ip_address.includes(q) ||
          (l.is_successful ? 'success' : 'failed').includes(q)
      );
    }

    if (appliedLoginFilterRules.length > 0) {
      list = list.filter((l) => {
        const evalLoginRule = (rule: LogFilterRule) => {
          const val = rule.value.trim().toLowerCase();
          if (!val) return true;

          if (rule.field === 'status') {
            const isSuccess = Boolean(l.is_successful);
            const statusStr = isSuccess ? 'success' : 'failed';
            if (rule.operator === 'is') return statusStr === val;
            if (rule.operator === 'is_not') return statusStr !== val;
          } else if (rule.field === 'username') {
            const target = (l.username || 'unknown').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'email') {
            const target = (l.email || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'details') {
            const target = (l.is_successful ? 'session token issued (mfa verified)' : 'invalid password credentials (ip challenge)').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'ip_address') {
            const target = (l.ip_address || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          }
          return true;
        };

        return matchMode === 'any'
          ? appliedLoginFilterRules.some(evalLoginRule)
          : appliedLoginFilterRules.every(evalLoginRule);
      });
    }

    list.sort((a, b) => {
      if (sortField === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = String(a[sortField as keyof LoginAttemptLog] ?? '');
      const valB = String(b[sortField as keyof LoginAttemptLog] ?? '');
      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [loginLogs, searchQuery, appliedLoginFilterRules, matchMode, sortField, sortDirection]);

  // Filter & sort terminal logs
  const filteredTermLogs = useMemo(() => {
    let list = [...termLogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          l.ip_address.includes(q)
      );
    }

    if (appliedTermFilterRules.length > 0) {
      list = list.filter((l) => {
        const evalTermRule = (rule: LogFilterRule) => {
          const val = rule.value.trim().toLowerCase();
          if (!val) return true;

          if (rule.field === 'username') {
            const target = (l.username || 'system').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'email') {
            const target = (l.email || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'details') {
            const target = (l.details || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'ip_address') {
            const target = (l.ip_address || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          }
          return true;
        };

        return matchMode === 'any'
          ? appliedTermFilterRules.some(evalTermRule)
          : appliedTermFilterRules.every(evalTermRule);
      });
    }

    list.sort((a, b) => {
      if (sortField === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = String(a[sortField as keyof AuditLog] ?? '');
      const valB = String(b[sortField as keyof AuditLog] ?? '');
      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [termLogs, searchQuery, appliedTermFilterRules, matchMode, sortField, sortDirection]);

  // Pagination slicing
  const activeCount =
    activeTab === 'audit'
      ? totalAuditItems
      : activeTab === 'login'
      ? totalLoginItems
      : totalTermItems;

  const paginatedAuditLogs = auditLogs;
  const paginatedLoginLogs = loginLogs;
  const paginatedTermLogs = termLogs;

  // Telemetry metrics
    const [realMetrics, setRealMetrics] = useState({
    totalEvents: 0,
    authRate: 100,
    failedLogins: 0,
    mutations: 0,
    uniqueUsers: 0,
    auditDays: [] as any[],
    authDays: [] as any[],
    mutationDays: [] as any[],
    userDays: [] as any[]
  });
  
  useEffect(() => {
    logsApi.getMetrics(startDate, endDate).then(res => {
      if (res.success && res.data) setRealMetrics(res.data);
    }).catch(e => console.error(e));
  }, [startDate, endDate]);

  // Utility for dynamic badges based on daily series
  const getBadgeFromSeries = (series: any[], inverted = false) => {
    if (!series || series.length < 2) return { text: '0%', icon: 'none' as const, color: '#8c8c8c' };
    const current = series[0].c || 0;
    const prev = series[1].c || 0;
    const diff = current - prev;
    if (diff === 0) return { text: '0%', icon: 'none' as const, color: '#8c8c8c' };
    const pct = prev === 0 ? 100 : (diff / prev) * 100;
    
    let isGood = diff > 0;
    if (inverted) isGood = diff < 0;
    
    return {
      text: `${diff > 0 ? '+' : ''}${pct.toFixed(1)}%`,
      icon: (diff > 0 ? 'up' : 'down') as 'up' | 'down',
      color: isGood ? '#30a46c' : '#e5484d',
    };
  };

  // Convert daily counts to a smooth SVG path
  const generateTrendPath = (series: any[], width = 1000, height = 90, yOffset = 30) => {
    if (!series || series.length === 0) {
      return {
        pathD: `M 0,${height + yOffset} L ${width},${height + yOffset}`,
        fillD: `M 0,${height + yOffset} L ${width},${height + yOffset} L ${width},130 L 0,130 Z`,
        maxVal: 1,
        data: [],
        labels: []
      };
    }
    
    // Reverse because query returns DESC (newest first), but graph is left-to-right (oldest to newest)
    const reversed = [...series].reverse();
    const data = reversed.map(d => d.c);
    const labels = reversed.map(d => d.day);
    
    const maxVal = Math.max(...data, 10);
    const stepX = width / Math.max(data.length - 1, 1);
    
    let line = '';
    reversed.forEach((d, i) => {
      const x = i * stepX;
      let rawY = (height + yOffset) - ((d.c / maxVal) * height);
      if (d.c === 0) rawY = height + yOffset;
      
      if (i === 0) line += `M ${x.toFixed(1)},${rawY.toFixed(1)}`;
      else line += ` L ${x.toFixed(1)},${rawY.toFixed(1)}`;
    });
    
    let fill = line;
    fill += ` L ${width.toFixed(1)},130 L 0,130 Z`;
    
    return { pathD: line, fillD: fill, maxVal, data, labels };
  };

  const auditTrend = useMemo(() => generateTrendPath(realMetrics.auditDays || []), [realMetrics.auditDays]);
  const authTrend = useMemo(() => generateTrendPath(realMetrics.authDays || []), [realMetrics.authDays]);
  const mutationTrend = useMemo(() => generateTrendPath(realMetrics.mutationDays || []), [realMetrics.mutationDays]);
  const userTrend = useMemo(() => generateTrendPath(realMetrics.userDays || []), [realMetrics.userDays]);



  // --------------------------------------------------------------------------
  // Telemetry Hover Compute Resolvers (exact polynomial Bezier / spike curves)
  // --------------------------------------------------------------------------
  const getHoverData = (pct: number, trendData: any) => {
    if (!trendData || trendData.data.length === 0) return { pct, yPct: 1, time: 'No data', value: '0' };
    
    const len = trendData.data.length;
    if (len === 1) {
      const val = trendData.data[0];
      const rawY = 120 - ((val / trendData.maxVal) * 90);
      return { pct, yPct: val === 0 ? 120 / 130 : rawY / 130, time: 'Today', value: `${val}` };
    }
    
    // The SVG points are at exactly i / (len - 1)
    const exactIdx = pct * (len - 1);
    const idx1 = Math.floor(exactIdx);
    const idx2 = Math.min(idx1 + 1, len - 1);
    const remainder = exactIdx - idx1;
    
    // Interpolate value visually to keep dot glued to the line
    const val1 = trendData.data[idx1];
    const val2 = trendData.data[idx2];
    const visualVal = val1 + (val2 - val1) * remainder;
    
    // For tooltip text, use the closest data point
    const closestIdx = remainder > 0.5 ? idx2 : idx1;
    const tooltipVal = trendData.data[closestIdx];
    
    const rawY = 120 - ((visualVal / trendData.maxVal) * 90);
    const yPct = visualVal === 0 ? 120 / 130 : rawY / 130;
    
    const daysAgo = (len - 1) - closestIdx;
    
    let timeStr = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;
    if (trendData.labels && trendData.labels[closestIdx]) {
      const lbl = trendData.labels[closestIdx];
      // Try to format nice if it has time
      if (lbl.includes(' ')) {
        const timePart = lbl.split(' ')[1];
        timeStr = timePart; // e.g. "14:30"
      } else {
        timeStr = lbl; // e.g. "2023-10-01"
      }
    }
    
    return { pct, yPct, time: timeStr, value: `${tooltipVal}` };
  };

  const computeTotalEventsHover = (pct: number) => {
    const d = getHoverData(pct, auditTrend);
    return { ...d, value: `${d.value} events` };
  };

  const computeAuthRateHover = (pct: number) => {
    const d = getHoverData(pct, authTrend);
    return { ...d, value: `${Number(d.value).toFixed(1)}%` };
  };

  const computeMutationsHover = (pct: number) => {
    const d = getHoverData(pct, mutationTrend);
    return { ...d, value: `${d.value} mutations` };
  };

  const computePrincipalsHover = (pct: number) => {
    const d = getHoverData(pct, userTrend);
    return { ...d, value: `${d.value} active` };
  };

  // Copy JSON payload
  const handleCopyJson = (log: AuditLog | LoginAttemptLog) => {
    const dataToCopy = {
      ...log,
      ...(selectedLogEmail ? { email: selectedLogEmail } : {}),
    };
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
    setCopiedId(log.id);
    pushToast('success', 'Event payload copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export logs to JSON file
  const handleExport = (formatType: 'json' | 'csv') => {
    let dataToExport: any[] = [];
    if (activeTab === 'audit') dataToExport = filteredAuditLogs;
    else if (activeTab === 'login') dataToExport = filteredLoginLogs;
    else if (activeTab === 'terminal') dataToExport = filteredTermLogs;

    if (dataToExport.length === 0) {
      pushToast('warn', 'No logs available to export');
      return;
    }

    if (formatType === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `binary_alive_${activeTab}_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    pushToast('success', `Exported ${dataToExport.length} ${activeTab} log events`);
  };

  // Timestamp formatting
  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts.replace(' ', 'T') + 'Z');
      return format(d, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return ts;
    }
  };

  // Action status matching Dashboard.tsx standard text row styling
  const renderActionBadge = (action: string) => {
    return (
      <span className="text-[14px] font-normal text-white truncate leading-none">
        {action}
      </span>
    );
  };

  // DataTable column definitions
  const auditColumns: Column<AuditLog>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        isSortable: true,
        isResizable: true,
        width: 180,
        className: 'pl-4 pr-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
            {formatTimestamp(log.timestamp)}
          </span>
        ),
      },
      {
        id: 'username',
        header: 'User',
        isSortable: true,
        isResizable: true,
        width: 160,
        className: 'px-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-white truncate group-hover/row:text-[#2f80ed] transition-colors">
            {log.username || 'System'}
          </span>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        isSortable: true,
        isResizable: true,
        width: 190,
        className: 'px-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#cccccc] truncate">
            {log.email || '—'}
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        isSortable: true,
        isResizable: true,
        width: 180,
        className: 'px-3',
        cell: (log) => renderActionBadge(log.action),
      },
      {
        id: 'details',
        header: 'Details',
        isFlex: true,
        className: 'px-3 min-w-[280px]',
        cell: (log) => (
          <span
            className="truncate text-[14px] font-normal leading-none text-[#d4d4d4] block w-full"
            title={log.details || undefined}
          >
            {log.details || '—'}
          </span>
        ),
      },
      {
        id: 'ip_address',
        header: 'IP Address',
        isSortable: true,
        isResizable: true,
        resizerPosition: 'before',
        width: 140,
        className: 'pl-3 pr-4',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
            {log.ip_address}
          </span>
        ),
      },
    ],
    []
  );

  const loginColumns: Column<LoginAttemptLog>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        isSortable: true,
        isResizable: true,
        width: 180,
        className: 'pl-4 pr-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
            {formatTimestamp(log.timestamp)}
          </span>
        ),
      },
      {
        id: 'username',
        header: 'User',
        isSortable: true,
        isResizable: true,
        width: 160,
        className: 'px-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-white truncate group-hover/row:text-[#2f80ed] transition-colors">
            {log.username || 'unknown'}
          </span>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        isSortable: true,
        isResizable: true,
        width: 190,
        className: 'px-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#cccccc] truncate">
            {log.email || '—'}
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Auth Result',
        isSortable: true,
        isResizable: true,
        width: 180,
        className: 'px-3',
        cell: (log) => (
          <span
            className={`text-[14px] font-normal leading-none ${
              log.is_successful ? 'text-white' : 'text-[#e5484d]'
            }`}
          >
            {log.is_successful ? 'Success' : 'Failed'}
          </span>
        ),
      },
      {
        id: 'details',
        header: 'Details',
        isFlex: true,
        className: 'px-3 min-w-[280px]',
        cell: (log) => (
          <span className="truncate text-[14px] font-normal leading-none text-[#d4d4d4] block w-full">
            {log.is_successful
              ? 'Session token issued (MFA verified)'
              : 'Invalid password credentials (IP challenge)'}
          </span>
        ),
      },
      {
        id: 'ip_address',
        header: 'IP Address',
        isSortable: true,
        isResizable: true,
        resizerPosition: 'before',
        width: 140,
        className: 'pl-3 pr-4',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
            {log.ip_address}
          </span>
        ),
      },
    ],
    []
  );

  const terminalColumns: Column<AuditLog>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        isSortable: true,
        isResizable: true,
        width: 180,
        className: 'pl-4 pr-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
            {formatTimestamp(log.timestamp)}
          </span>
        ),
      },
      {
        id: 'username',
        header: 'User',
        isSortable: true,
        isResizable: true,
        width: 160,
        className: 'px-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-white truncate group-hover/row:text-[#2f80ed] transition-colors">
            {log.username || 'System'}
          </span>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        isSortable: true,
        isResizable: true,
        width: 190,
        className: 'px-3',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#cccccc] truncate">
            {log.email || '—'}
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Status',
        isSortable: true,
        isResizable: true,
        width: 180,
        className: 'px-3',
        cell: () => (
          <span className="text-[14px] font-normal text-white leading-none">
            Success
          </span>
        ),
      },
      {
        id: 'details',
        header: 'Command',
        isFlex: true,
        className: 'px-3 min-w-[280px]',
        cell: (log) => (
          <span
            className="truncate text-[14px] font-normal leading-none text-[#d4d4d4] block w-full"
            title={log.details || undefined}
          >
            $ {log.details || '—'}
          </span>
        ),
      },
      {
        id: 'ip_address',
        header: 'IP Address',
        isSortable: true,
        isResizable: true,
        resizerPosition: 'before',
        width: 140,
        className: 'pl-3 pr-4',
        cell: (log) => (
          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
            {log.ip_address}
          </span>
        ),
      },
    ],
    []
  );

  const visibleAuditColumns = useMemo(
    () => auditColumns.filter((col) => auditVisibleColumns[col.id] !== false),
    [auditColumns, auditVisibleColumns]
  );

  const visibleLoginColumns = useMemo(
    () => loginColumns.filter((col) => loginVisibleColumns[col.id] !== false),
    [loginColumns, loginVisibleColumns]
  );

  const visibleTerminalColumns = useMemo(
    () => terminalColumns.filter((col) => termVisibleColumns[col.id] !== false),
    [terminalColumns, termVisibleColumns]
  );

  return (
    <div
      style={{
        fontFamily:
          '"Inter Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      }}
      className="flex flex-col gap-4 w-full max-w-[1600px] mx-auto pb-12 select-none font-sans"
    >
      {/* 1. Page Header & Date Range Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div className="flex flex-col">
          <h1 className="text-[16px] font-semibold text-white tracking-tight font-sans">
            Audit logs
          </h1>
        </div>

        {/* Date Range Picker Popover trigger + Reload Button */}
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

          {/* Reload button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center h-9 w-9 text-[#8c8c8c] hover:text-white rounded-lg bg-transparent hover:bg-[#141414] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Reload telemetry"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Four Cloudflare Telemetry Cards (Height: 241px, 155px graph, 4 grid lines, corner notch) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        {/* Card 1: Total Events */}
        <TelemetryCard
          title="Total Events"
          value={realMetrics.totalEvents.toLocaleString()}
          badge={getBadgeFromSeries(realMetrics.auditDays, true)}
            strokeColor="#3E8EFF"
            gradientId="total-events-grad"
            pathD={auditTrend.pathD}
            fillD={auditTrend.fillD}
          yAxisLabels={['250', '150', '50', '0']}
          tooltipMetricName="Total events"
          onHoverCompute={computeTotalEventsHover}
        />

        {/* Card 2: Auth Success Rate */}
        <TelemetryCard
          title="Auth Success Rate"
          value={realMetrics.authRate !== 100 ? `${realMetrics.authRate}%` : '100%'}
          subLabel={`/ ${realMetrics.failedLogins} blocked`}
          badge={{ ...getBadgeFromSeries(realMetrics.authDays), mlAuto: true }}
            strokeColor="#3E8EFF"
            gradientId="auth-rate-grad"
            pathD={authTrend.pathD}
            fillD={authTrend.fillD}
          yAxisLabels={['100%', '75%', '50%', '0%']}
          tooltipMetricName="Auth rate"
          onHoverCompute={computeAuthRateHover}
        />

        {/* Card 3: Mutations & Ops */}
        <TelemetryCard
          title="Mutations & Ops"
          value={realMetrics.mutations}
          badge={getBadgeFromSeries(realMetrics.mutationDays, true)}
            strokeColor="#3E8EFF"
            gradientId="mut-ops-grad"
            pathD={mutationTrend.pathD}
            fillD={mutationTrend.fillD}
          yAxisLabels={['60', '40', '20', '0']}
          tooltipMetricName="Mutations"
          onHoverCompute={computeMutationsHover}
        />

        {/* Card 4: Active Principals */}
        <TelemetryCard
          title="Active Principals"
          value={realMetrics.uniqueUsers}
          badge={getBadgeFromSeries(realMetrics.userDays)}
            strokeColor="#3E8EFF"
            gradientId="principals-grad"
            pathD={userTrend.pathD}
            fillD={userTrend.fillD}
          yAxisLabels={['60', '40', '20', '0']}
          tooltipMetricName="Active principals"
          onHoverCompute={computePrincipalsHover}
        />
      </div>

      {/* 3. DevTool Search & Tab Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 select-none font-sans">
        {/* Search Input Group (Left side with dark background and crisp border) */}
        <label
          title="Search logs (/ or Ctrl+K)"
          className="relative flex items-center h-9 rounded-[8px] bg-transparent border border-[#262626] focus-within:border-[#2f80ed] transition-colors px-3 gap-2 w-full sm:w-[280px] md:w-[320px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search logs..."
            className="w-full bg-transparent border-0 text-[14px] text-white placeholder-[#8c8c8c] outline-none font-normal font-sans"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#222222] text-[#8c8c8c] hover:text-white transition-colors cursor-pointer shrink-0 font-sans"
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
            <kbd className="hidden sm:inline-flex items-center ml-auto font-sans text-xs font-semibold text-[#d4d4d4] whitespace-nowrap select-none pointer-events-none shrink-0">
              /
            </kbd>
          )}
        </label>

        {/* Right cluster: Filters, Display options, Tab Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2 font-sans">
          {/* Filters dropdown */}
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => {
                setShowFilters((prev) => {
                  const next = !prev;
                  if (next) {
                    setShowDisplayOptions(false);
                    if (currentAppliedFilterRules.length > 0) {
                      setCurrentFilterRules(currentAppliedFilterRules.map((r) => ({ ...r })));
                    } else if (currentFilterRules.length === 0) {
                      setCurrentFilterRules([
                        { id: '1', field: currentFilterFieldOptions[0].value, operator: 'contains', value: '' },
                      ]);
                    }
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-transparent border text-[14px] font-medium transition-colors cursor-pointer shrink-0 font-sans ${
                showFilters || currentAppliedFilterRules.length > 0
                  ? 'border-[#444444] text-white bg-[#141414]'
                  : 'border-[#262626] text-white hover:bg-[#141414] hover:border-[#383838]'
              }`}
              title="Filter logs"
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
              {currentAppliedFilterRules.length > 0 && (
                <span className="text-[12px] text-[#8c8c8c] font-normal font-mono">
                  ({currentAppliedFilterRules.length})
                </span>
              )}
            </button>

            {showFilters && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-10 w-[560px] max-w-[calc(100vw-32px)] rounded-[8px] bg-[#0c0c0c] border border-[#262626] shadow-2xl p-4 z-50 select-none animate-in fade-in font-sans">
                {/* Header */}
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-white font-sans">
                      {activeTab === 'audit' ? 'Audit Filters' : activeTab === 'login' ? 'Login Filters' : 'Terminal Filters'}
                    </span>
                    {currentFilterRules.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setMatchMode((prev) => (prev === 'any' ? 'all' : 'any'))}
                        className="px-2.5 py-0.5 rounded text-[13px] text-[#cccccc] hover:text-white bg-[#141414] border border-[#2e2e2e] hover:border-[#444444] transition-colors cursor-pointer font-sans"
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
                <div className={`space-y-2.5 ${currentFilterRules.length > 3 ? 'max-h-[320px] overflow-y-auto pr-0.5' : ''}`}>
                  {currentFilterRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2">
                      <CustomSelect
                        value={rule.field}
                        options={currentFilterFieldOptions}
                        onChange={(val) => handleFieldChange(rule.id, val as LogFilterField)}
                        className="w-28 sm:w-32 shrink-0"
                        menuWidth="w-40"
                      />

                      <CustomSelect
                        value={rule.operator}
                        options={getLogFilterOperatorOptions(rule.field)}
                        onChange={(val) => updateFilterRule(rule.id, { operator: val as LogFilterOperator })}
                        className="w-32 sm:w-36 shrink-0"
                        menuWidth="w-44"
                      />

                      {rule.field === 'status' ? (
                        <CustomSelect
                          value={rule.value || 'success'}
                          options={LOGIN_STATUS_OPTIONS}
                          onChange={(val) => updateFilterRule(rule.id, { value: val })}
                          className="flex-1 min-w-0"
                          menuWidth="w-full"
                        />
                      ) : (
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyFilters();
                          }}
                          placeholder="e.g. restart or 192.168"
                          className="flex-1 min-w-0 h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
                        />
                      )}

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
                <div className="flex items-center justify-between pt-2.5 mt-1 font-sans">
                  <button
                    type="button"
                    onClick={addFilterRule}
                    className="text-[14px] text-white hover:text-[#2f80ed] font-medium flex items-center gap-1.5 transition-colors cursor-pointer font-sans"
                  >
                    <span>+ Add filter</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#666666] font-sans">Press Enter to apply</span>
                    {currentAppliedFilterRules.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="text-[14px] text-[#888888] hover:text-white transition-colors cursor-pointer font-sans"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="group relative flex shrink-0 items-center justify-center h-8 px-3.5 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                      <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
                        Apply filters
                      </span>
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
              className={`flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-transparent border text-[14px] font-medium transition-colors cursor-pointer shrink-0 font-sans ${
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
              <div className="absolute right-0 top-10 w-52 rounded-md bg-[#0c0c0c] border border-[#262626] shadow-xl p-1 z-40 select-none font-sans">
                {currentColumnsConfig.map((col) => {
                  const isVisible = currentVisibleColumns[col.id] !== false;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setCurrentVisibleColumns(col.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[14px] text-[#cccccc] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                    >
                      <span className={isVisible ? 'text-white' : 'text-[#777777]'}>
                        {col.label}
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
                <div className="-mx-1 my-1 border-t border-[#222222]" />
                <button
                  type="button"
                  onClick={resetCurrentVisibleColumns}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[14px] text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                >
                  Reset columns
                </button>
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-transparent border border-[#262626] hover:bg-[#141414] hover:border-[#383838] text-[14px] font-medium text-white transition-colors cursor-pointer font-sans shrink-0"
            title="Export filtered logs to JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
            </svg>
            <span>Export</span>
          </button>

          {/* Tab Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-[8px] bg-transparent border border-[#262626]">
            <button
              type="button"
              onClick={() => handleTabChange('audit')}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[14px] font-medium transition-colors duration-75 cursor-pointer font-sans outline-none focus:outline-none border ${
                activeTab === 'audit'
                  ? 'bg-[#161616] text-white border-[#333333]'
                  : 'text-[#8c8c8c] hover:text-white hover:bg-[#141414] border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[14px] font-medium transition-colors duration-75 cursor-pointer font-sans outline-none focus:outline-none border ${
                activeTab === 'login'
                  ? 'bg-[#161616] text-white border-[#333333]'
                  : 'text-[#8c8c8c] hover:text-white hover:bg-[#141414] border-transparent'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Login</span>
            </button>

            {hasPermission('terminal_access') && (
              <button
                type="button"
                onClick={() => handleTabChange('terminal')}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[14px] font-medium transition-colors duration-75 cursor-pointer font-sans outline-none focus:outline-none border ${
                  activeTab === 'terminal'
                    ? 'bg-[#161616] text-white border-[#333333]'
                    : 'text-[#8c8c8c] hover:text-white hover:bg-[#141414] border-transparent'
                }`}
              >
                <TerminalIcon className="w-4 h-4" />
                <span>Terminal</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Applied Filters Chips */}
      {currentAppliedFilterRules.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 font-sans">
          {currentAppliedFilterRules.map((rule) => {
            const fieldLabel =
              currentFilterFieldOptions.find((f) => f.value === rule.field)?.label || rule.field;
            return (
              <span
                key={rule.id}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] bg-[#161616] border border-[#262626] text-[13px] text-white font-sans"
              >
                <span className="text-[#8c8c8c]">{fieldLabel}</span>
                <span className="text-[#555555] font-mono">{rule.operator}</span>
                <span className="font-medium text-white max-w-[150px] truncate">
                  "{rule.value}"
                </span>
                <button
                  type="button"
                  onClick={() => removeSingleAppliedFilter(rule.id)}
                  className="text-[#777777] hover:text-white ml-0.5 cursor-pointer"
                  title="Remove filter"
                >
                  ✕
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-[13px] text-[#888888] hover:text-white transition-colors cursor-pointer ml-1 font-sans"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* 4. Telemetry Log Stream Table */}
      {activeTab === 'audit' ? (
        <DataTable
          columns={visibleAuditColumns}
          data={paginatedAuditLogs}
          isLoading={isLoading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(log) => setSelectedLog(log)}
          emptyMessage="No audit events matching current search criteria."
          pagination={{
            page,
            pageSize,
            totalCount: activeCount,
            onPageChange: setPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setPage(1);
            },
          }}
        />
      ) : activeTab === 'login' ? (
        <DataTable
          columns={visibleLoginColumns}
          data={paginatedLoginLogs}
          isLoading={isLoading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(log) => setSelectedLog(log)}
          emptyMessage="No login attempts matching current search criteria."
          pagination={{
            page,
            pageSize,
            totalCount: activeCount,
            onPageChange: setPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setPage(1);
            },
          }}
        />
      ) : (
        <DataTable
          columns={visibleTerminalColumns}
          data={paginatedTermLogs}
          isLoading={isLoading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(log) => setSelectedLog(log)}
          emptyMessage="No terminal commands matching current search criteria."
          pagination={{
            page,
            pageSize,
            totalCount: activeCount,
            onPageChange: setPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setPage(1);
            },
          }}
        />
      )}

      {/* 5. SlideOver Event Inspector Drawer */}
      <SlideOver
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title={
          selectedLog ? (
            <span className="flex items-center gap-2">
              <span>
                {'action' in selectedLog
                  ? selectedLog.action === 'terminal_command'
                    ? 'Terminal'
                    : 'Audit event'
                  : 'Authentication'}
              </span>
              <span className="text-[#555555] font-normal">/</span>
              <span className="text-[#e6e6e6] font-medium">
                {'action' in selectedLog
                  ? selectedLog.action === 'terminal_command'
                    ? 'Command execution'
                    : selectedLog.action
                  : selectedLog.username || 'Login'}
              </span>
            </span>
          ) : (
            'Event Inspector'
          )
        }
        subtitle={
          selectedLog && (
            <div className="flex items-center gap-2 text-[13px] text-[#8c8c8c] mt-0.5 font-sans">
              <span className="text-[#8c8c8c] font-sans text-[13px]">Event</span>
              <span className="text-[#555555]">•</span>
              <span className="text-[13px] text-[#8c8c8c] font-sans">#{selectedLog.id}</span>
              {selectedLog.username && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[#8c8c8c] font-sans text-[13px]">{selectedLog.username}</span>
                </>
              )}
              {selectedLogEmail && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[#8c8c8c] font-sans text-[13px]">{selectedLogEmail}</span>
                </>
              )}
            </div>
          )
        }
        width="w-[520px] sm:w-[560px] max-w-full"
      >
        {selectedLog && (
          <div className="flex flex-col flex-1 w-full h-full min-h-0 overflow-y-auto p-4 gap-4 bg-[#0e0e0e] font-sans">
                
            {/* Card 1: Event Attributes */}
            <div className="relative flex flex-col overflow-hidden shrink-0 rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626]">
              <div className="flex items-start gap-3 px-4 pt-3 pb-0.5 border-b border-[#262626]">
                <div className="min-w-0 flex-1 pb-2.5">
                  <div className="min-w-0 truncate text-[14px] font-semibold text-white">
                    Attributes
                  </div>
                </div>
              </div>
              
              <div className="w-full py-1">
                <ol className="ml-0 m-0 p-0">
                  {/* Timestamp */}
                  <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                    <span className="text-[13px] text-[#8c8c8c]">Timestamp</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-white tabular-nums">
                        {format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </span>
                      <button
                        onClick={() =>
                          handleCopyField(
                            format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                            'Timestamp'
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                        title="Copy"
                      >
                        {copiedField === 'Timestamp' ? (
                          <Check className="w-3.5 h-3.5 text-[#30a46c]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </li>

                  {/* Action / Result */}
                  <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                    <span className="text-[13px] text-[#8c8c8c]">Status</span>
                    <div className="flex items-center gap-2">
                      {'is_successful' in selectedLog ? (
                        <span className={`text-[14px] font-medium ${selectedLog.is_successful ? 'text-[#30a46c]' : 'text-[#e5484d]'}`}>
                          {selectedLog.is_successful ? 'Success' : 'Failed'}
                        </span>
                      ) : (
                        <span className="text-[14px] font-medium text-white">
                          {selectedLog.action === 'terminal_command' ? 'Success' : selectedLog.action}
                        </span>
                      )}
                      <button
                        onClick={() =>
                          handleCopyField(
                            'is_successful' in selectedLog
                              ? selectedLog.is_successful
                                ? 'Success'
                                : 'Failed'
                              : selectedLog.action === 'terminal_command'
                              ? 'Success'
                              : selectedLog.action,
                            'Status'
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                        title="Copy"
                      >
                        {copiedField === 'Status' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </li>

                      {/* Principal Actor -> User */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">User</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white">{selectedLog.username || 'System'}</span>
                          <button
                            onClick={() => handleCopyField(selectedLog.username || 'System', 'User')}
                            className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                            title="Copy"
                          >
                            {copiedField === 'User' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>

                      {/* Email (placed immediately after User) */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">Email</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white">{selectedLogEmail || '—'}</span>
                          {selectedLogEmail && (
                            <button
                              onClick={() => handleCopyField(selectedLogEmail, 'Email')}
                              className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                              title="Copy"
                            >
                              {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </li>

                      {/* Subject ID -> ID */}
                      {'user_id' in selectedLog && (
                        <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                          <span className="text-[13px] text-[#8c8c8c]">ID</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium text-white">{selectedLog.user_id ? `#${selectedLog.user_id}` : 'Internal'}</span>
                            <button
                              onClick={() => handleCopyField(String(selectedLog.user_id || 'Internal'), 'ID')}
                              className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                              title="Copy"
                            >
                              {copiedField === 'ID' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </li>
                      )}

                      {/* Client IP -> IP Address */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">IP Address</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white tabular-nums">{selectedLog.ip_address}</span>
                          <button
                            onClick={() => handleCopyField(selectedLog.ip_address, 'IP Address')}
                            className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                            title="Copy"
                          >
                            {copiedField === 'IP Address' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>

                      {/* Network Origin -> Network */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">Network</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white">
                            {selectedLog.ip_address.startsWith('127.')
                              ? 'Loopback'
                              : selectedLog.ip_address.startsWith('192.168.') ||
                                selectedLog.ip_address.startsWith('10.')
                              ? 'Internal'
                              : 'Public'}
                          </span>
                          <button
                            onClick={() =>
                              handleCopyField(
                                selectedLog.ip_address.startsWith('127.')
                                  ? 'Loopback'
                                  : selectedLog.ip_address.startsWith('192.168.') ||
                                    selectedLog.ip_address.startsWith('10.')
                                  ? 'Internal'
                                  : 'Public',
                                'Network'
                              )
                            }
                            className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                            title="Copy"
                          >
                            {copiedField === 'Network' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>

                      {/* Details / Command */}
                      {'details' in selectedLog && selectedLog.details && (
                        <li className="relative flex flex-col justify-center px-4 py-3 border-t border-[#262626] transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-semibold text-white">
                              {selectedLog.action === 'terminal_command' ? 'Command Line' : 'Details'}
                            </span>
                            <button
                              onClick={() => handleCopyField(selectedLog.details as string, 'Details')}
                              className="text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                              title="Copy"
                            >
                              {copiedField === 'Details' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="p-3 rounded-md bg-[#0e0e0e] border border-[#262626] text-[13px] font-normal text-[#ededed] break-words leading-relaxed select-text">
                            {selectedLog.action === 'terminal_command' ? (
                              <span className="font-mono text-[#e5e5e5]">$ {selectedLog.details}</span>
                            ) : (
                              selectedLog.details
                            )}
                          </div>
                        </li>
                      )}
                    </ol>
                  </div>
                </div>

                {/* Card 2: JSON Payload */}
                <div className="relative flex flex-col overflow-hidden rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626]">
                  <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-[14px] font-semibold text-white">JSON Payload</span>
                    </div>
                    <button
                      onClick={() => handleCopyJson(selectedLog)}
                      className="flex items-center gap-1 text-[11px] font-medium text-[#8c8c8c] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedId === selectedLog.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#30a46c]" />
                          <span className="text-[#30a46c]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="p-3 bg-[#0e0e0e] overflow-x-auto m-1.5 rounded border border-[#262626]">
                    <pre className="text-[12px] font-mono leading-relaxed m-0 select-text selection:bg-[#264f78]">
                      {renderHighlightedJson(
                        JSON.stringify(
                          {
                            ...selectedLog,
                            ...(selectedLogEmail ? { email: selectedLogEmail } : {}),
                          },
                          null,
                          2
                        )
                      )}
                    </pre>
                  </div>
                </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
};
