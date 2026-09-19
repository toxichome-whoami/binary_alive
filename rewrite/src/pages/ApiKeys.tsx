import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiTokensApi } from '../api/apiTokens';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import type { ApiToken, Permissions } from '../types';
import { SlideOver } from '../components/ui/SlideOver';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { PermissionTable } from '../components/shared/PermissionTable';
import {
  Key,
  KeyRound,
  Copy,
  Check,
  Plus,
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Shield,
  Lock,
  Ban,
  CheckCircle2,
} from 'lucide-react';

const DEFAULT_PERMISSIONS: Permissions = {
  users_view: false, users_create: false, users_edit: false, users_disable: false, users_delete: false, users_reset_2fa: false,
  api_keys_view: false, api_keys_create: false, api_keys_edit: false, api_keys_disable: false, api_keys_delete: false,
  processes_view: false, processes_start: false, processes_stop: false, processes_restart: false, processes_create: false, processes_edit: false, processes_delete: false,
  logs_view_audit: false, logs_view_login: false, logs_view_terminal: false,
  settings_view: false, settings_edit: false, settings_security: false,
  terminal_access: false, terminal_unrestricted: false,
  ai_access: false, ai_data_read: false, ai_data_write: false,
};

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

export type ApiKeyFilterField = 'name' | 'status' | 'user' | 'email';

export type ApiKeyFilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'is'
  | 'is_not';

export interface ApiKeyFilterRule {
  id: string;
  field: ApiKeyFilterField;
  operator: ApiKeyFilterOperator;
  value: string;
}

const API_KEY_FILTER_FIELD_OPTIONS: { value: ApiKeyFilterField; label: string }[] = [
  { value: 'name', label: 'Token Name' },
  { value: 'status', label: 'Status' },
  { value: 'user', label: 'Member' },
  { value: 'email', label: 'Email' },
];

const getApiKeyFilterOperatorOptions = (field: ApiKeyFilterField): { value: ApiKeyFilterOperator; label: string }[] => {
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

const API_KEY_FILTER_STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'disabled', label: 'disabled' },
  { value: 'expired', label: 'expired' },
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

export const ApiKeys: React.FC = () => {
  const [searchParams] = useSearchParams();
  const userIdFilter = searchParams.get('user');
  const navigate = useNavigate();

  const { user: currentUser, isOwner } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sorting
  const [sortField, setSortField] = useState<'id' | 'name' | 'status' | 'scopes' | 'last_used' | 'created_at' | 'email' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Determine what permissions the current user CAN grant
  const disabledPermissions = useMemo(() => {
    if (isOwner()) return {}; // Owner can grant anything
    const disabled: Partial<Record<keyof Permissions, boolean>> = {};
    for (const key of Object.keys(DEFAULT_PERMISSIONS)) {
      if (!(currentUser?.permissions as any)?.[key]) {
        disabled[key as keyof Permissions] = true;
      }
    }
    return disabled;
  }, [currentUser, isOwner]);

  // Create form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpiration, setNewExpiration] = useState<string>('never');
  const [newPermissions, setNewPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [createLoading, setCreateLoading] = useState(false);

  // Edit form state
  const [editingToken, setEditingToken] = useState<ApiToken | null>(null);
  const [editName, setEditName] = useState('');
  const [editPermissions, setEditPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [editLoading, setEditLoading] = useState(false);

  // New token reveal modal
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ApiToken | null>(null);
  const [disableTarget, setDisableTarget] = useState<{ token: ApiToken; disable: boolean } | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Display options
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const displayOptionsRef = useRef<HTMLDivElement | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    email: true,
    scopes: true,
    last_used: true,
    created_at: true,
    expires_at: false,
  });

  const COLUMN_LABELS: Record<string, string> = {
    user: 'Member',
    email: 'Email',
    scopes: 'Permissions',
    last_used: 'Last Used',
    created_at: 'Created Date',
    expires_at: 'Expiration',
  };

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [filterRules, setFilterRules] = useState<ApiKeyFilterRule[]>([
    { id: '1', field: 'name', operator: 'contains', value: '' },
  ]);
  const [appliedFilterRules, setAppliedFilterRules] = useState<ApiKeyFilterRule[]>([]);

  const activeFiltersCount = appliedFilterRules.length;

  const addFilterRule = () => {
    setFilterRules((prev) => [
      ...prev,
      { id: String(Date.now()), field: 'name', operator: 'contains', value: '' },
    ]);
  };

  const removeFilterRule = (id: string) => {
    setFilterRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateFilterRule = (id: string, patch: Partial<ApiKeyFilterRule>) => {
    setFilterRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const handleFieldChange = (id: string, newField: ApiKeyFilterField) => {
    const ops = getApiKeyFilterOperatorOptions(newField);
    let initialValue = '';
    if (newField === 'status') initialValue = 'active';

    setFilterRules((prev) =>
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
    const valid = filterRules.filter((r) => r.value.trim() !== '');
    setAppliedFilterRules(valid);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setAppliedFilterRules([]);
    setFilterRules([{ id: '1', field: 'name', operator: 'contains', value: '' }]);
    setShowFilters(false);
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

  // Handle keyboard shortcut for search (/ key)
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      let res;
      if (isOwner() && userIdFilter) {
        res = await apiTokensApi.listAll();
      } else if (isOwner()) {
        res = await apiTokensApi.listAll();
      } else {
        res = await apiTokensApi.list();
      }
      
      if (res.success && res.data) {
        let finalTokens = res.data;
        if (userIdFilter) {
          finalTokens = finalTokens.filter((t) => t.user_id === parseInt(userIdFilter, 10));
        }
        setTokens(finalTokens);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, [isOwner, userIdFilter, pushToast]);

  useEffect(() => {
    if (!currentUser?.permissions?.api_keys_view && !isOwner()) {
      navigate('/dashboard');
      return;
    }
    fetchTokens();
  }, [fetchTokens, currentUser, isOwner, navigate]);

  const countGrantedPermissions = (perms?: Permissions) => {
    if (!perms) return 0;
    return Object.values(perms).filter(Boolean).length;
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() <= Date.now();
  };

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    let active = 0;
    let disabled = 0;
    let expiring = 0;
    
    tokens.forEach((t) => {
      const isDisabled = Boolean(t.is_disabled);
      const isExpired = isTokenExpired(t.expires_at);

      if (isDisabled) {
        disabled++;
      } else if (!isExpired) {
        active++;
        if (t.expires_at) {
          const daysLeft = (new Date(t.expires_at).getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (daysLeft <= 7) expiring++;
        }
      }
    });
    
    const lastUsed = tokens
      .filter((t) => t.last_used)
      .map((t) => new Date(t.last_used!).getTime())
      .sort((a, b) => b - a)[0];

    return {
      total: tokens.length,
      active,
      disabled,
      expiring,
      lastUsed: lastUsed ? new Date(lastUsed).toLocaleDateString() : 'Never',
    };
  }, [tokens]);

  // Filtering & Sorting
  const filteredTokens = useMemo(() => {
    let list = [...tokens];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          String(t.id).includes(q) ||
          String(t.user_id).includes(q) ||
          (t.username && t.username.toLowerCase().includes(q)) ||
          (t.email && t.email.toLowerCase().includes(q))
      );
    }

    if (appliedFilterRules.length > 0) {
      list = list.filter((t) => {
        const evalRule = (rule: ApiKeyFilterRule) => {
          const val = rule.value.trim().toLowerCase();
          if (!val) return true;

          const isExpired = isTokenExpired(t.expires_at);
          const statusStr = t.is_disabled ? 'disabled' : isExpired ? 'expired' : 'active';
          const userStr = (t.username || String(t.user_id)).toLowerCase();

          if (rule.field === 'name') {
            const target = t.name.toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'status') {
            if (rule.operator === 'is') return statusStr === val;
            if (rule.operator === 'is_not') return statusStr !== val;
          } else if (rule.field === 'user') {
            if (rule.operator === 'contains') return userStr.includes(val);
            if (rule.operator === 'equals') return userStr === val;
            if (rule.operator === 'starts_with') return userStr.startsWith(val);
          } else if (rule.field === 'email') {
            const emailStr = (t.email || '').toLowerCase();
            if (rule.operator === 'contains') return emailStr.includes(val);
            if (rule.operator === 'equals') return emailStr === val;
            if (rule.operator === 'starts_with') return emailStr.startsWith(val);
          }
          return true;
        };

        return matchMode === 'any'
          ? appliedFilterRules.some(evalRule)
          : appliedFilterRules.every(evalRule);
      });
    }

    if (!sortField) return list;

    return list.sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];

      if (sortField === 'status') {
        valA = a.is_disabled ? 'disabled' : isTokenExpired(a.expires_at) ? 'expired' : 'active';
        valB = b.is_disabled ? 'disabled' : isTokenExpired(b.expires_at) ? 'expired' : 'active';
      } else if (sortField === 'scopes') {
        valA = countGrantedPermissions(a.permissions);
        valB = countGrantedPermissions(b.permissions);
      } else if (sortField === 'last_used') {
        valA = a.last_used ? new Date(a.last_used).getTime() : 0;
        valB = b.last_used ? new Date(b.last_used).getTime() : 0;
      } else if (sortField === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortField === 'email') {
        valA = (a.email || '').toLowerCase();
        valB = (b.email || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tokens, searchQuery, appliedFilterRules, matchMode, sortField, sortDirection]);

  // Pagination derived slice
  const total = filteredTokens.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedTokens = useMemo(() => {
    return filteredTokens.slice(startIndex, startIndex + pageSize);
  }, [filteredTokens, startIndex, pageSize]);
  const endIndex = Math.min(total, startIndex + paginatedTokens.length);

  const handleSort = (field: 'id' | 'name' | 'status' | 'scopes' | 'last_used' | 'created_at' | 'email') => {
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

  // Selection handlers
  const isAllSelected =
    paginatedTokens.length > 0 && paginatedTokens.every((t) => selectedIds.includes(t.id));
  const isSomeSelected =
    paginatedTokens.some((t) => selectedIds.includes(t.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedTokens.map((t) => t.id));
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true);

    try {
      let expiresAt: string | null = null;
      if (newExpiration !== 'never') {
        const days = parseInt(newExpiration, 10);
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
      }

      const res = await apiTokensApi.create({
        name: newName.trim(),
        permissions: newPermissions,
        expires_at: expiresAt,
      });

      if (res.success && res.data) {
        setGeneratedToken(res.data.token);
        setTokenCopied(false);
        setIsCreateOpen(false);
        setNewName('');
        setNewExpiration('never');
        setNewPermissions({ ...DEFAULT_PERMISSIONS });
        fetchTokens();
        pushToast('success', `API Key "${newName.trim()}" generated`);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to create API key');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const openEditModal = (t: ApiToken) => {
    setEditingToken(t);
    setEditName(t.name);
    setEditPermissions(t.permissions || { ...DEFAULT_PERMISSIONS });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingToken) return;
    setEditLoading(true);

    try {
      const updates: any = {};
      if (editName.trim() && editName !== editingToken.name) updates.name = editName.trim();
      updates.permissions = editPermissions;

      const res = await apiTokensApi.update(editingToken.id, updates);

      if (res.success) {
        pushToast('success', 'API Key updated');
        setEditingToken(null);
        fetchTokens();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update API key');
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDeleteToken = async () => {
    if (isBulkDeleting) {
      if (selectedIds.length === 0) return;
      setDialogLoading(true);
      try {
        for (const id of selectedIds) {
          await apiTokensApi.delete(id);
        }
        pushToast('success', `Revoked ${selectedIds.length} API keys`);
        setSelectedIds([]);
        setIsBulkDeleting(false);
        fetchTokens();
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to revoke selected API keys');
      } finally {
        setDialogLoading(false);
      }
    } else {
      if (!deleteTarget) return;
      setDialogLoading(true);
      try {
        const res = await apiTokensApi.delete(deleteTarget.id);
        if (res.success) {
          pushToast('success', 'API key revoked');
          setDeleteTarget(null);
          fetchTokens();
        }
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to revoke API key');
      } finally {
        setDialogLoading(false);
      }
    }
  };

  const handleToggleTokenStatus = async (token: ApiToken, disable: boolean) => {
    setDialogLoading(true);
    try {
      const res = disable ? await apiTokensApi.disable(token.id) : await apiTokensApi.enable(token.id);
      if (res.success) {
        pushToast('success', res.message || `API Key "${token.name}" ${disable ? 'disabled' : 'enabled'}`);
        setDisableTarget(null);
        if (editingToken?.id === token.id) {
          setEditingToken(null);
        }
        await fetchTokens();
      } else {
        pushToast('error', res.message || 'Operation failed');
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update API key status');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleBulkToggleStatus = async (disable: boolean) => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    try {
      let count = 0;
      for (const id of selectedIds) {
        if (disable) await apiTokensApi.disable(id);
        else await apiTokensApi.enable(id);
        count++;
      }
      pushToast('success', `${count} API key${count !== 1 ? 's' : ''} ${disable ? 'disabled' : 'enabled'}`);
      setSelectedIds([]);
      await fetchTokens();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed bulk status update');
    } finally {
      setIsLoading(false);
    }
  };

  const activeColSpan =
    3 + // Checkbox, Status, Key Name
    (visibleColumns.user ? 1 : 0) +
    (visibleColumns.email ? 1 : 0) +
    (visibleColumns.scopes ? 1 : 0) +
    (visibleColumns.last_used ? 1 : 0) +
    (visibleColumns.created_at ? 1 : 0) +
    (visibleColumns.expires_at ? 1 : 0) +
    2; // Spacer + Actions

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-12 select-none font-sans">
      {/* 4 Clean Black Metric Cards matching Users.tsx */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full font-sans">
        <div className="relative rounded-[8px] border border-[#222222] hover:border-[#383838] transition-colors bg-[#0f0f0f] p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-[#8c8c8c]">Total tokens</span>
            <KeyRound className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <div className="text-[28px] font-semibold text-white tracking-tight tabular-nums leading-tight">{stats.total}</div>
          </div>
        </div>
        <div className="relative rounded-[8px] border border-[#222222] hover:border-[#383838] transition-colors bg-[#0f0f0f] p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-[#8c8c8c]">Active keys</span>
            <Activity className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <div className="text-[28px] font-semibold text-white tracking-tight tabular-nums leading-tight">{stats.active}</div>
          </div>
        </div>
        <div className="relative rounded-[8px] border border-[#222222] hover:border-[#383838] transition-colors bg-[#0f0f0f] p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-[#8c8c8c]">Disabled keys</span>
            <Lock className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <div className={`text-[28px] font-semibold tracking-tight tabular-nums leading-tight ${stats.disabled > 0 ? 'text-[#ef4444]' : 'text-white'}`}>{stats.disabled}</div>
          </div>
        </div>
        <div className="relative rounded-[8px] border border-[#222222] hover:border-[#383838] transition-colors bg-[#0f0f0f] p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-[#8c8c8c]">Expiring soon</span>
            <AlertTriangle className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <div className={`text-[28px] font-semibold tracking-tight tabular-nums leading-tight ${stats.expiring > 0 ? 'text-[#f59e0b]' : 'text-white'}`}>{stats.expiring}</div>
          </div>
        </div>
      </div>

      {/* Toolbar Controls — Exact Users & Dashboard Match */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 select-none font-sans">
        {/* Search Input Group */}
        <label
          title="Search API keys (/ or Ctrl+K)"
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
            placeholder="Search API keys..."
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

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 font-sans">
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
              className={`flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-transparent border text-[14px] font-medium transition-colors cursor-pointer shrink-0 font-sans ${
                showFilters || activeFiltersCount > 0
                  ? 'border-[#444444] text-white bg-[#141414]'
                  : 'border-[#262626] text-white hover:bg-[#141414] hover:border-[#383838]'
              }`}
              title="Filter API keys"
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
                <span className="text-[12px] text-[#8c8c8c] font-normal font-mono">({activeFiltersCount})</span>
              )}
            </button>

            {showFilters && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-10 w-[560px] max-w-[calc(100vw-32px)] rounded-[8px] bg-[#0c0c0c] border border-[#262626] shadow-2xl p-4 z-50 select-none animate-in fade-in font-sans">
                {/* Header */}
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-white font-sans">Filters</span>
                    {filterRules.length >= 2 && (
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
                <div className={`space-y-2.5 ${filterRules.length > 3 ? 'max-h-[320px] overflow-y-auto pr-0.5' : ''}`}>
                  {filterRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2">
                      {/* Field */}
                      <CustomSelect
                        value={rule.field}
                        options={API_KEY_FILTER_FIELD_OPTIONS}
                        onChange={(val) => handleFieldChange(rule.id, val as ApiKeyFilterField)}
                        className="w-32 sm:w-36 shrink-0"
                        menuWidth="w-40"
                      />

                      {/* Operator */}
                      <CustomSelect
                        value={rule.operator}
                        options={getApiKeyFilterOperatorOptions(rule.field)}
                        onChange={(val) => updateFilterRule(rule.id, { operator: val as ApiKeyFilterOperator })}
                        className="w-32 sm:w-36 shrink-0"
                        menuWidth="w-44"
                      />

                      {/* Value Input */}
                      {rule.field === 'status' ? (
                        <CustomSelect
                          value={rule.value || 'active'}
                          options={API_KEY_FILTER_STATUS_OPTIONS}
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
                          placeholder={rule.field === 'user' ? 'e.g. alex' : 'e.g. Deploy Key'}
                          className="flex-1 min-w-0 h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
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
                    {appliedFilterRules.length > 0 && (
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
                {(['user', 'email', 'scopes', 'last_used', 'created_at', 'expires_at'] as const).map((col) => {
                  const isVisible = visibleColumns[col];
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() =>
                        setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }))
                      }
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[14px] text-[#cccccc] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
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
                <div className="-mx-1 my-1 border-t border-[#222222]" />
                <button
                  type="button"
                  onClick={() =>
                    setVisibleColumns({
                      user: true,
                      email: true,
                      scopes: true,
                      last_used: true,
                      created_at: true,
                      expires_at: false,
                    })
                  }
                  className="w-full text-left px-2.5 py-1.5 rounded text-[14px] text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                >
                  Reset columns
                </button>
              </div>
            )}
          </div>

          {/* Create API key button */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="group relative flex shrink-0 items-center justify-center h-9 px-3.5 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
            <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
              <Plus className="w-4 h-4 shrink-0" />
              <span>Create API Key</span>
            </span>
          </button>
        </div>
      </div>

      {/* API Keys Table Card — Exact Cloudflare DNS table structure matching Users */}
      <div id="tokens-table-card" className="w-full flex flex-col rounded-[12px] border border-[#222222] bg-black shadow-sm select-none font-sans">
        {/* Status bar */}
        <div className="flex w-full flex-col gap-2 px-4 py-3 bg-black font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-[#8c8c8c] font-normal select-none font-sans">
              {filteredTokens.length === tokens.length ? (
                <>
                  You have <strong className="font-semibold text-white">{total}</strong> {total === 1 ? 'API key' : 'API keys'} configured.
                </>
              ) : (
                <>
                  Showing <strong className="font-semibold text-white">{filteredTokens.length}</strong> of <strong className="font-semibold text-white">{tokens.length}</strong> API keys.
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              {appliedFilterRules.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[13px] text-[#888888] hover:text-white transition-colors cursor-pointer font-sans"
                >
                  Clear all filters
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[13px] text-[#888888] hover:text-white transition-colors cursor-pointer font-sans"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          {/* Applied Filters Chips */}
          {appliedFilterRules.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 font-sans">
              {appliedFilterRules.map((rule) => {
                const fieldLabel =
                  API_KEY_FILTER_FIELD_OPTIONS.find((f) => f.value === rule.field)?.label || rule.field;
                return (
                  <span
                    key={rule.id}
                    className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-[#161616] border border-[#262626] text-[12px] text-[#cccccc] font-sans"
                  >
                    <span className="text-[#888888]">{fieldLabel}</span>
                    <span className="text-[#666666]">{rule.operator}</span>
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

          {/* Bulk Selection Bar */}
          {selectedIds.length > 0 && (
            <div className="flex min-h-9 w-full flex-wrap items-center justify-between gap-3 pt-0.5 font-sans">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <p className="text-[14px] font-normal text-white font-sans">
                  <span className="font-medium">{selectedIds.length} of {paginatedTokens.length} selected</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="inline-flex items-center h-8 px-2.5 rounded-[8px] text-[14px] font-medium text-white bg-transparent hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="inline-flex items-center h-8 px-2.5 rounded-[8px] text-[14px] font-medium text-white bg-transparent hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                >
                  Select all {paginatedTokens.length} eligible keys
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 font-sans">
                {(currentUser?.permissions?.api_keys_disable || isOwner()) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleStatus(true)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer font-sans"
                    >
                      <Ban className="w-3.5 h-3.5 shrink-0" />
                      <span>Disable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleStatus(false)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer font-sans"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Enable</span>
                    </button>
                  </>
                )}
                {(currentUser?.permissions?.api_keys_delete || isOwner()) && (
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleting(true)}
                    className="group relative flex shrink-0 items-center justify-center h-8 px-3 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#991b1b] bg-[#dc2626] font-sans"
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                    <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Revoke {selectedIds.length} key{selectedIds.length !== 1 ? 's' : ''}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inset Table Card with rounded corners matching Dashboard & Users */}
        <div className="mx-[6px] mb-[6px] border border-[#262626] rounded-[8px] overflow-hidden bg-[#0e0e0e]">
          <div className="overflow-x-auto overflow-y-hidden">
            <table
              role="table"
              aria-label="API Keys"
              className="w-full min-w-[900px] text-left border-collapse font-sans"
            >
              {/* Sticky 40px Header */}
              <thead className="sticky top-0 z-10 font-sans">
                <tr className="flex w-full items-center border-b border-[#222222] bg-[#141414] h-[40px] min-h-[40px] max-h-[40px]">
                  {/* Checkbox */}
                  <th className="flex items-center justify-center shrink-0 w-[44px] min-w-[44px] h-[40px] rounded-tl-lg">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isAllSelected ? 'true' : isSomeSelected ? 'mixed' : 'false'}
                      aria-label="Select all on this page"
                      onClick={handleSelectAll}
                      className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-[#141414] ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2f80ed] transition-all cursor-pointer data-[checked]:bg-[#2f80ed] data-[checked]:ring-[#2f80ed] data-[indeterminate]:bg-[#2f80ed] data-[indeterminate]:ring-[#2f80ed]"
                      data-checked={isAllSelected ? '' : undefined}
                      data-indeterminate={!isAllSelected && isSomeSelected ? '' : undefined}
                    >
                      {isAllSelected ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                        </svg>
                      ) : isSomeSelected ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                          <path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z" />
                        </svg>
                      ) : null}
                    </button>
                  </th>

                  {/* Status Column */}
                  <th
                    onClick={() => handleSort('status')}
                    className="group flex items-center shrink-0 w-[110px] h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                      <span>Status</span>
                      <CaretUpDownIcon active={sortField === 'status'} direction={sortDirection} />
                    </span>
                  </th>

                  {/* Key Identifier Column */}
                  <th
                    onClick={() => handleSort('name')}
                    className="group flex items-center shrink-0 w-[220px] h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                      <span>Key Identifier</span>
                      <CaretUpDownIcon active={sortField === 'name'} direction={sortDirection} />
                    </span>
                  </th>

                  {/* Member Column */}
                  {visibleColumns.user && (
                    <th className="flex items-center shrink-0 w-[140px] h-[40px] px-3">
                      <span className="text-[14px] font-medium text-white leading-none font-sans">Member</span>
                    </th>
                  )}

                  {/* Email Column */}
                  {visibleColumns.email && (
                    <th
                      onClick={() => handleSort('email')}
                      className="group flex items-center shrink-0 w-[180px] h-[40px] px-3 cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                        <span>Email</span>
                        <CaretUpDownIcon active={sortField === 'email'} direction={sortDirection} />
                      </span>
                    </th>
                  )}

                  {/* Scopes Column */}
                  {visibleColumns.scopes && (
                    <th
                      onClick={() => handleSort('scopes')}
                      className="group flex items-center shrink-0 w-[140px] h-[40px] px-3 cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                        <span>Permissions</span>
                        <CaretUpDownIcon active={sortField === 'scopes'} direction={sortDirection} />
                      </span>
                    </th>
                  )}

                  {/* Last Used Column */}
                  {visibleColumns.last_used && (
                    <th
                      onClick={() => handleSort('last_used')}
                      className="group flex items-center shrink-0 w-[180px] h-[40px] px-3 cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                        <span>Last Used</span>
                        <CaretUpDownIcon active={sortField === 'last_used'} direction={sortDirection} />
                      </span>
                    </th>
                  )}

                  {/* Created Column */}
                  {visibleColumns.created_at && (
                    <th
                      onClick={() => handleSort('created_at')}
                      className="group flex items-center shrink-0 w-[130px] h-[40px] px-3 cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                        <span>Created</span>
                        <CaretUpDownIcon active={sortField === 'created_at'} direction={sortDirection} />
                      </span>
                    </th>
                  )}

                  {/* Expiration Column (Optional) */}
                  {visibleColumns.expires_at && (
                    <th className="flex items-center shrink-0 w-[130px] h-[40px] px-3">
                      <span className="text-[14px] font-medium text-white leading-none font-sans">Expires</span>
                    </th>
                  )}

                  {/* Flexible Spacer to ensure all data columns stay left and ONLY Edit is right */}
                  <th className="flex-1 h-[40px]" />

                  {/* Sticky Actions Header */}
                  <th className="flex items-center justify-end shrink-0 w-[80px] h-[40px] px-3 sticky right-0 bg-[#141414] z-10 rounded-tr-lg">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-[#1e1e1e] font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={activeColSpan} className="px-4 py-12 text-center bg-[#0e0e0e]">
                      <p className="text-[14px] text-[#6b6b6b] font-normal font-sans">Loading API keys...</p>
                    </td>
                  </tr>
                ) : paginatedTokens.length === 0 ? (
                  <tr>
                    <td colSpan={activeColSpan} className="px-4 py-12 text-center bg-[#0e0e0e]">
                      <p className="text-[14px] text-[#6b6b6b] font-normal font-sans">
                        No API keys match your search criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedTokens.map((t) => {
                    const isChecked = selectedIds.includes(t.id);
                    const isExpired = isTokenExpired(t.expires_at);
                    const grantedPerms = countGrantedPermissions(t.permissions);

                    return (
                      <tr
                        key={t.id}
                        className={`group/row flex w-full items-center h-[40px] min-h-[40px] max-h-[40px] border-b border-[#1e1e1e] transition-colors font-sans ${
                          isChecked ? 'bg-[#181818]' : 'bg-[#0e0e0e] hover:bg-[#161616]'
                        }`}
                      >
                        {/* Checkbox cell */}
                        <td className="flex items-center justify-center shrink-0 w-[44px] min-w-[44px] h-[40px]">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-label={`Select ${t.name}`}
                            onClick={() => handleSelectOne(t.id)}
                            className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-[#141414] ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2f80ed] transition-all cursor-pointer data-[checked]:bg-[#2f80ed] data-[checked]:ring-[#2f80ed]"
                            data-checked={isChecked ? '' : undefined}
                          >
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                                <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                              </svg>
                            )}
                          </button>
                        </td>

                        {/* Status cell (clean text matching Users.tsx) */}
                        <td className="flex items-center shrink-0 w-[110px] h-[40px] px-3 font-sans">
                          {t.is_disabled ? (
                            <span className="text-[14px] font-normal text-[#ef4444] leading-none font-sans">Disabled</span>
                          ) : isExpired ? (
                            <span className="text-[14px] font-normal text-[#ef4444] leading-none font-sans">Expired</span>
                          ) : (
                            <span className="text-[14px] font-normal text-white leading-none font-sans">Active</span>
                          )}
                        </td>

                        {/* Key Identifier cell */}
                        <td className="flex items-center shrink-0 w-[220px] h-[40px] px-3 text-[14px] font-medium text-white truncate font-sans">
                          <div className="flex items-center gap-2 min-w-0">
                            <Key className="w-3.5 h-3.5 text-[#8c8c8c] shrink-0" />
                            <span className="truncate font-sans">{t.name}</span>
                          </div>
                        </td>

                        {/* Member / User ID cell */}
                        {visibleColumns.user && (
                          <td className="flex items-center shrink-0 w-[140px] h-[40px] px-3 font-sans text-[14px] text-[#cccccc] truncate">
                            {t.username ? (
                              <div className="flex items-center gap-1.5 truncate">
                                <span>{t.username}</span>
                                {t.user_id === 1 && (
                                  <Shield className="w-3 h-3 text-amber-500 shrink-0" />
                                )}
                              </div>
                            ) : (
                              <span className="font-mono text-[#8c8c8c]">#{t.user_id}</span>
                            )}
                          </td>
                        )}

                        {/* Email cell */}
                        {visibleColumns.email && (
                          <td className="flex items-center shrink-0 w-[180px] h-[40px] px-3 font-sans text-[14px] text-[#cccccc] truncate">
                            {t.email ? (
                              <span className="truncate">{t.email}</span>
                            ) : (
                              <span className="text-[#666666]">—</span>
                            )}
                          </td>
                        )}

                        {/* Permissions / Scopes cell */}
                        {visibleColumns.scopes && (
                          <td className="flex items-center shrink-0 w-[140px] h-[40px] px-3 font-sans">
                            {grantedPerms === Object.keys(DEFAULT_PERMISSIONS).length ? (
                              <span className="text-[14px] font-normal text-white font-sans" title={`All ${Object.keys(DEFAULT_PERMISSIONS).length} permissions granted`}>
                                Full access
                              </span>
                            ) : (
                              <span
                                className="text-[14px] font-normal text-[#8c8c8c] font-sans"
                                title={`${grantedPerms} of ${Object.keys(DEFAULT_PERMISSIONS).length} permissions granted`}
                              >
                                <span className="text-white font-medium tabular-nums">{grantedPerms}</span>
                                <span className="text-[#666666]"> / {Object.keys(DEFAULT_PERMISSIONS).length}</span>
                              </span>
                            )}
                          </td>
                        )}

                        {/* Last Used cell */}
                        {visibleColumns.last_used && (
                          <td className="flex items-center shrink-0 w-[180px] h-[40px] px-3 text-[14px] text-[#8c8c8c] font-sans truncate">
                            {t.last_used ? new Date(t.last_used).toLocaleString() : 'Never used'}
                          </td>
                        )}

                        {/* Created cell */}
                        {visibleColumns.created_at && (
                          <td className="flex items-center shrink-0 w-[130px] h-[40px] px-3 text-[14px] text-[#8c8c8c] font-sans tabular-nums">
                            {new Date(t.created_at).toLocaleDateString()}
                          </td>
                        )}

                        {/* Expiration cell */}
                        {visibleColumns.expires_at && (
                          <td className="flex items-center shrink-0 w-[130px] h-[40px] px-3 text-[14px] text-[#8c8c8c] font-sans tabular-nums">
                            {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'Never'}
                          </td>
                        )}

                        {/* Flexible Spacer to keep data packed left */}
                        <td className="flex-1 h-[40px]" />

                        {/* Sticky Action Cell — Exact Cloudflare Edit Button */}
                        <td
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
                            onClick={() => openEditModal(t)}
                            className="inline-flex items-center justify-center h-7 px-3 rounded-md text-[14px] font-medium leading-none text-white hover:text-white bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0 font-sans"
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

          {/* Table Footer — Embedded Pagination matching Users & Dashboard */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#222222] bg-[#0e0e0e] rounded-b-lg font-sans">
            <span className="text-[13px] text-[#8c8c8c] font-normal select-none font-sans">
              Showing <span className="text-[#cccccc] font-medium tabular-nums">{total === 0 ? 0 : `${startIndex + 1}–${endIndex}`}</span> of <span className="text-[#cccccc] font-medium tabular-nums">{total}</span>
            </span>
            <div className="flex items-center gap-2 select-none font-sans">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-normal text-[#8c8c8c] hover:text-white hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:hover:text-[#8c8c8c] disabled:cursor-not-allowed transition-all cursor-pointer font-sans"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Previous</span>
              </button>

              <span className="text-[13px] text-[#8c8c8c] px-1 font-normal font-sans">
                Page <span className="text-[#cccccc] font-medium tabular-nums">{page}</span> of <span className="text-[#cccccc] font-medium tabular-nums">{totalPages}</span>
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-normal text-[#8c8c8c] hover:text-white hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:hover:text-[#8c8c8c] disabled:cursor-not-allowed transition-all cursor-pointer font-sans"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create API Key SlideOver Drawer — Exactly matches Users Create Drawer */}
      <SlideOver
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create API key"
      >
        <form onSubmit={handleCreateToken} className="flex flex-col h-full min-h-0 bg-[#0e0e0e] font-sans">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 font-sans">
            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Token Name <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CI/CD Deploy Key"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Expiration
              </label>
              <CustomSelect
                value={newExpiration}
                options={[
                  { value: 'never', label: 'Never expires' },
                  { value: '30', label: '30 days' },
                  { value: '60', label: '60 days' },
                  { value: '90', label: '90 days' },
                  { value: '365', label: '1 year' },
                ]}
                onChange={setNewExpiration}
                className="w-full"
              />
            </div>

            <div className="pt-2 font-sans">
              <div className="mb-2 font-sans">
                <span className="text-[14px] font-medium text-white block font-sans">Permissions</span>
                <span className="text-[13px] text-[#8c8c8c] font-sans">Fine-grained access rights for this API key</span>
              </div>
              <PermissionTable 
                value={newPermissions} 
                onChange={setNewPermissions} 
                disabled={disabledPermissions} 
              />
            </div>
          </div>

          {/* Pinned Bottom Footer Bar */}
          <div className="shrink-0 px-4 py-3 bg-[#0e0e0e] flex items-center justify-between font-sans">
            <span className="text-[13px] text-[#8c8c8c] font-sans">
              {countGrantedPermissions(newPermissions)} of 21 granted
            </span>
            <div className="flex items-center gap-2 font-sans">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
                  {createLoading ? 'Generating...' : 'Create key'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </SlideOver>

      {/* Edit API Key SlideOver Drawer — Exactly matches Users Edit Drawer */}
      <SlideOver
        isOpen={editingToken !== null}
        onClose={() => setEditingToken(null)}
        title={
          <span className="flex items-center gap-2">
            <span>Edit API key</span>
            <span className="text-[#555555] font-normal">/</span>
            <span className="text-[#e6e6e6] font-medium">{editingToken?.name}</span>
          </span>
        }
        subtitle={
          editingToken && (
            <div className="flex items-center gap-2 text-[13px] text-[#8c8c8c] mt-0.5 font-sans">
              <span className="text-[#8c8c8c] font-sans text-[13px]">Key</span>
              <span className="text-[#555555]">•</span>
              <span className="text-[13px] text-[#8c8c8c] font-sans">#{editingToken.id}</span>
              {editingToken.is_disabled ? (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[#ef4444] font-sans">Disabled</span>
                </>
              ) : null}
              {editingToken.username && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[#8c8c8c] font-sans text-[13px]">{editingToken.username}</span>
                </>
              )}
              {editingToken.email && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[#8c8c8c] font-sans text-[13px]">{editingToken.email}</span>
                </>
              )}
              {editingToken.last_used && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[13px] text-[#8c8c8c] font-sans">Last used {new Date(editingToken.last_used).toLocaleDateString()}</span>
                </>
              )}
            </div>
          )
        }
      >
        <form onSubmit={handleSaveEdit} className="flex flex-col h-full min-h-0 bg-[#0e0e0e] font-sans">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 font-sans">
            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Token Name <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white outline-none transition-colors font-sans"
              />
            </div>

            <div className="pt-2 font-sans">
              <div className="mb-2 font-sans">
                <span className="text-[14px] font-medium text-white block font-sans">Permissions</span>
                <span className="text-[13px] text-[#8c8c8c] font-sans">Adjust functional scopes for this API key</span>
              </div>
              <PermissionTable 
                value={editPermissions} 
                onChange={setEditPermissions}
                disabled={disabledPermissions}
              />
            </div>

            {/* Security & Key Control Action Section matching Users */}
            <div className="pt-2 space-y-3 font-sans">
              <span className="text-[14px] font-medium text-white block font-sans">Security & Key Control</span>

              {/* Disable / Enable Action */}
              {editingToken && (currentUser?.permissions?.api_keys_disable || isOwner()) && (
                editingToken.is_disabled ? (
                  <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                    <div>
                      <span className="text-[14px] font-medium text-white block font-sans">API Key Disabled</span>
                      <span className="text-[13px] text-[#8c8c8c] font-sans">Requests using this key are currently blocked</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleTokenStatus(editingToken, false)}
                      className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#257850] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#30a46c] to-[#247c52] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      <span className="relative z-10">Enable</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                    <div>
                      <span className="text-[14px] font-medium text-white block font-sans">Disable API Key</span>
                      <span className="text-[13px] text-[#8c8c8c] font-sans">Temporarily suspend access for this token</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDisableTarget({ token: editingToken!, disable: true });
                        setEditingToken(null);
                      }}
                      className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#b45309] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#f59e0b] to-[#d97706] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      <span className="relative z-10">Disable</span>
                    </button>
                  </div>
                )
              )}

              {/* Revoke API Key Action */}
              {(currentUser?.permissions?.api_keys_delete || isOwner()) && (
                <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                  <div>
                    <span className="text-[14px] font-medium text-white block font-sans">Revoke API Key</span>
                    <span className="text-[13px] text-[#8c8c8c] font-sans">Permanently invalidate and revoke this token</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(editingToken);
                      setEditingToken(null);
                    }}
                    className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#b91c1c] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    <span className="relative z-10">Revoke</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pinned Bottom Footer Bar */}
          <div className="shrink-0 px-4 py-3 bg-[#0e0e0e] flex items-center justify-between font-sans">
            <span className="text-[13px] text-[#8c8c8c] font-sans">
              {countGrantedPermissions(editPermissions)} of 21 granted
            </span>
            <div className="flex items-center gap-2 font-sans">
              <button
                type="button"
                onClick={() => setEditingToken(null)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
                  {editLoading ? 'Saving...' : 'Save changes'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </SlideOver>

      {/* API Token Created Reveal Modal */}
      <Dialog
        isOpen={generatedToken !== null}
        onClose={() => setGeneratedToken(null)}
        title="API Key Created"
      >
        <div className="space-y-4 font-sans">
          <div className="flex items-start gap-2.5 p-3 rounded-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[13px] leading-relaxed font-sans">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Important:</strong> Copy your new API key now. It will not be shown again for security reasons.
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              readOnly
              value={generatedToken || ''}
              className="w-full h-10 pl-3 pr-24 font-mono text-[14px] rounded-[8px] border border-[#262626] bg-[#141414] text-white select-all focus:outline-none focus:border-[#383838] transition-colors"
            />
            <button
              type="button"
              onClick={handleCopyToken}
              className="absolute right-1 top-1 h-8 px-3 rounded-md text-[13px] font-medium text-[#cccccc] hover:text-white bg-[#1a1a1a] border border-[#2e2e2e] hover:border-[#444444] transition-colors cursor-pointer flex items-center gap-1.5 font-sans"
            >
              {tokenCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#30a46c]" />
                  <span className="text-[#30a46c]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8c8c8c]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="flex justify-end pt-2 font-sans">
            <button
              type="button"
              onClick={() => setGeneratedToken(null)}
              className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
              <span className="relative flex items-center text-[14px] font-sans">
                Done
              </span>
            </button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={disableTarget !== null}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => disableTarget && handleToggleTokenStatus(disableTarget.token, disableTarget.disable)}
        title={disableTarget?.disable ? 'Disable API Key' : 'Enable API Key'}
        message={
          disableTarget?.disable
            ? `Are you sure you want to disable "${disableTarget?.token.name}"? Any applications or services using this token will be blocked immediately.`
            : `Are you sure you want to enable "${disableTarget?.token.name}"? Applications using it will be able to make requests normally again.`
        }
        confirmLabel={disableTarget?.disable ? 'Disable Key' : 'Enable Key'}
        variant={disableTarget?.disable ? 'danger' : 'primary'}
        isLoading={dialogLoading}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null || isBulkDeleting}
        onClose={() => {
          setDeleteTarget(null);
          setIsBulkDeleting(false);
        }}
        onConfirm={confirmDeleteToken}
        title={isBulkDeleting ? `Revoke ${selectedIds.length} API Keys` : 'Revoke API Key'}
        message={
          isBulkDeleting
            ? `Are you sure you want to permanently revoke ${selectedIds.length} API keys? Any applications or services using these tokens will lose access immediately.`
            : `Are you sure you want to permanently revoke the API key "${deleteTarget?.name}"? Any applications using it will lose access immediately.`
        }
        confirmLabel={isBulkDeleting ? `Revoke ${selectedIds.length} Keys` : 'Revoke Key'}
        variant="danger"
        isLoading={dialogLoading}
      />
    </div>
  );
};
