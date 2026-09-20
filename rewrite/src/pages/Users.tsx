import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useWsStore } from '../store/wsStore';
import type { User, Permissions } from '../types';
import { SlideOver } from '../components/ui/SlideOver';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { PermissionTable } from '../components/shared/PermissionTable';
import {
  Shield,
  Plus,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users as UsersIcon,
  Lock,
  ShieldCheck,
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

export type UserFilterField = 'username' | 'email' | 'status' | 'two_fa' | 'role';

export type UserFilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'is'
  | 'is_not';

export interface UserFilterRule {
  id: string;
  field: UserFilterField;
  operator: UserFilterOperator;
  value: string;
}

const USER_FILTER_FIELD_OPTIONS: { value: UserFilterField; label: string }[] = [
  { value: 'username', label: 'Member' },
  { value: 'email', label: 'Email' },
  { value: 'status', label: 'Status' },
  { value: 'two_fa', label: '2FA' },
  { value: 'role', label: 'Role' },
];

const getUserFilterOperatorOptions = (field: UserFilterField): { value: UserFilterOperator; label: string }[] => {
  if (field === 'status' || field === 'two_fa' || field === 'role') {
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

const USER_FILTER_STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'disabled', label: 'disabled' },
];

const USER_FILTER_2FA_OPTIONS = [
  { value: 'enabled', label: 'enabled' },
  { value: 'disabled', label: 'disabled' },
];

const USER_FILTER_ROLE_OPTIONS = [
  { value: 'owner', label: 'owner' },
  { value: 'member', label: 'member' },
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

const DEFAULT_USER_COLUMN_WIDTHS: Record<string, number> = {
  status: 110,
  username: 180,
  email: 220,
  permissions: 150,
  api_keys: 130,
  two_fa: 130,
};

const MIN_USER_COLUMN_WIDTHS: Record<string, number> = {
  status: 85,
  username: 130,
  email: 140,
  permissions: 120,
  api_keys: 100,
  two_fa: 100,
};

const MAX_USER_COLUMN_WIDTHS: Record<string, number> = {
  status: 240,
  username: 450,
  email: 500,
  permissions: 320,
  api_keys: 250,
  two_fa: 250,
};

const ColumnResizer: React.FC<{
  col: string;
  resizingCol: string | null;
  onResizeStart: (col: string, e: React.MouseEvent) => void;
  onReset: (col: string) => void;
}> = ({ col, resizingCol, onResizeStart, onReset }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={`Resize ${col} column`}
    onMouseDown={(e) => onResizeStart(col, e)}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
    }}
    onDoubleClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onReset(col);
    }}
    className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
    title="Drag to resize column (double-click to reset)"
  >
    <span
      className={`w-px h-4 transition-colors ${
        resizingCol === col ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
      }`}
    />
  </div>
);

export const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, isOwner } = useAuthStore();
  const { onlineUsers } = useWsStore();
  const { push: pushToast } = useToastStore();

  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sorting
  const [sortField, setSortField] = useState<'id' | 'username' | 'email' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Create user form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPermissions, setNewPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [createLoading, setCreateLoading] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPermissions, setEditPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [editLoading, setEditLoading] = useState(false);

  // Confirmation dialogs
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [remove2faTarget, setRemove2faTarget] = useState<User | null>(null);
  const [disableTarget, setDisableTarget] = useState<{ user: User; disable: boolean } | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchUsers = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    try {
      const res = await usersApi.list(targetPage, 15);
      if (res.success && res.data) {
        setUsers(res.data.data);
        setTotalPages(res.data.total_pages);
        setTotal(res.data.total);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to load user records');
    } finally {
      setIsLoading(false);
    }
  }, [page, pushToast]);

  useEffect(() => {
    if (!currentUser?.permissions?.users_view && !isOwner()) {
      navigate('/dashboard');
      return;
    }
    fetchUsers(page);
  }, [fetchUsers, page, currentUser, isOwner, navigate]);

  // Derived stats
  const stats = useMemo(() => {
    let activeTokens = 0;
    let twoFaCount = 0;
    let lockedCount = 0;

    users.forEach((u) => {
      activeTokens += u.api_keys_count || 0;
      if (u.has_2fa) twoFaCount++;
      if (u.locked_until && new Date(u.locked_until) > new Date()) lockedCount++;
    });

    return {
      members: total,
      tokens: activeTokens,
      twoFa: twoFaCount,
      locked: lockedCount,
    };
  }, [users, total]);

  // Display options
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const displayOptionsRef = useRef<HTMLDivElement | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    email: true,
    permissions: true,
    api_keys: true,
    two_fa: true,
    logins: true,
  });

  const COLUMN_LABELS: Record<string, string> = {
    email: 'Email',
    permissions: 'Permissions',
    api_keys: 'API Keys',
    two_fa: '2FA Status',
    logins: 'Logins',
  };

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [filterRules, setFilterRules] = useState<UserFilterRule[]>([
    { id: '1', field: 'username', operator: 'contains', value: '' },
  ]);
  const [appliedFilterRules, setAppliedFilterRules] = useState<UserFilterRule[]>([]);

  const activeFiltersCount = appliedFilterRules.length;

  const addFilterRule = () => {
    setFilterRules((prev) => [
      ...prev,
      { id: String(Date.now()), field: 'username', operator: 'contains', value: '' },
    ]);
  };

  const removeFilterRule = (id: string) => {
    setFilterRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateFilterRule = (id: string, patch: Partial<UserFilterRule>) => {
    setFilterRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const handleFieldChange = (id: string, newField: UserFilterField) => {
    const ops = getUserFilterOperatorOptions(newField);
    let initialValue = '';
    if (newField === 'status') initialValue = 'active';
    else if (newField === 'two_fa') initialValue = 'enabled';
    else if (newField === 'role') initialValue = 'owner';

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
    setFilterRules([{ id: '1', field: 'username', operator: 'contains', value: '' }]);
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

  // Adjustable column widths (Cloudflare table draggable resizers)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_USER_COLUMN_WIDTHS);
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  const handleResizeStart = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const defaultW = DEFAULT_USER_COLUMN_WIDTHS[col] || 150;
    const startWidth = columnWidths[col] || defaultW;
    const minWidth = MIN_USER_COLUMN_WIDTHS[col] || 80;
    const maxWidth = MAX_USER_COLUMN_WIDTHS[col] || 500;

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

  // Filter & sort
  const filteredUsers = useMemo(() => {
    let list = [...users];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          String(u.id).includes(q)
      );
    }

    if (appliedFilterRules.length > 0) {
      list = list.filter((u) => {
        const evalRule = (rule: UserFilterRule) => {
          const val = rule.value.trim().toLowerCase();
          if (!val) return true;

          const isLocked = !!(u.locked_until && new Date(u.locked_until) > new Date());
          const statusStr = isLocked ? 'disabled' : 'active';
          const twoFaStr = u.has_2fa ? 'enabled' : 'disabled';
          const roleStr = u.role === 'owner' ? 'owner' : 'member';

          if (rule.field === 'username') {
            const target = u.username.toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'email') {
            const target = (u.email || '').toLowerCase();
            if (rule.operator === 'contains') return target.includes(val);
            if (rule.operator === 'equals') return target === val;
            if (rule.operator === 'starts_with') return target.startsWith(val);
          } else if (rule.field === 'status') {
            if (rule.operator === 'is') return statusStr === val;
            if (rule.operator === 'is_not') return statusStr !== val;
          } else if (rule.field === 'two_fa') {
            if (rule.operator === 'is') return twoFaStr === val;
            if (rule.operator === 'is_not') return twoFaStr !== val;
          } else if (rule.field === 'role') {
            if (rule.operator === 'is') return roleStr === val;
            if (rule.operator === 'is_not') return roleStr !== val;
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
        const aLocked = a.locked_until && new Date(a.locked_until) > new Date();
        const bLocked = b.locked_until && new Date(b.locked_until) > new Date();
        valA = aLocked ? 'disabled' : 'active';
        valB = bLocked ? 'disabled' : 'active';
      } else if (sortField === 'email') {
        valA = (a.email || '').toLowerCase();
        valB = (b.email || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, searchQuery, appliedFilterRules, matchMode, sortField, sortDirection]);

  const handleSort = (field: 'id' | 'username' | 'email' | 'status') => {
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
  const selectableUsers = filteredUsers.filter((u) => u.role !== 'owner' && u.id !== currentUser?.id);
  const isAllSelected = selectableUsers.length > 0 && selectableUsers.every((u) => selectedIds.includes(u.id));
  const isSomeSelected = selectableUsers.some((u) => selectedIds.includes(u.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableUsers.map((u) => u.id));
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setCreateLoading(true);

    try {
      const res = await usersApi.create({
        username: newUsername.trim(),
        email: newEmail.trim() || undefined,
        password: newPassword,
        permissions: newPermissions,
      });

      if (res.success) {
        pushToast('success', `User "${newUsername}" created`);
        setIsCreateOpen(false);
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewPermissions({ ...DEFAULT_PERMISSIONS });
        fetchUsers(1);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email || '');
    setEditPassword('');
    setEditPermissions(u.permissions || { ...DEFAULT_PERMISSIONS });
  };

  const hasEditChanges = editingUser ? (
    editUsername !== editingUser.username ||
    editEmail !== (editingUser.email || '') ||
    editPassword !== '' ||
    JSON.stringify(editPermissions) !== JSON.stringify(editingUser.permissions || DEFAULT_PERMISSIONS)
  ) : false;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);

    try {
      const updates: any = {};
      if (editUsername.trim() && editUsername !== editingUser.username) {
        updates.username = editUsername.trim();
      }
      if (editEmail.trim() !== (editingUser.email || '')) {
        updates.email = editEmail.trim();
      }
      if (editPassword) {
        updates.password = editPassword;
      }
      if (editingUser.role !== 'owner') {
        updates.permissions = editPermissions;
      }

      const res = await usersApi.update(editingUser.id, updates);

      if (res.success) {
        pushToast('success', 'User updated successfully');
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (isBulkDeleting) {
      const deletableIds = selectedIds.filter((id) => users.find(u => u.id === id)?.role !== 'owner' && id !== currentUser?.id);
      if (deletableIds.length === 0) return;
      setDialogLoading(true);
      try {
        for (const id of deletableIds) {
          await usersApi.delete(id);
        }
        pushToast('success', `Deleted ${deletableIds.length} user accounts`);
        setSelectedIds([]);
        setIsBulkDeleting(false);
        fetchUsers();
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to delete selected accounts');
      } finally {
        setDialogLoading(false);
      }
    } else {
      if (!deleteTarget) return;
      setDialogLoading(true);
      try {
        const res = await usersApi.delete(deleteTarget.id);
        if (res.success) {
          pushToast('success', 'User deleted');
          setDeleteTarget(null);
          fetchUsers();
        }
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to delete user');
      } finally {
        setDialogLoading(false);
      }
    }
  };

  const confirmRemove2fa = async () => {
    if (!remove2faTarget) return;
    setDialogLoading(true);
    try {
      const res = await usersApi.remove2fa(remove2faTarget.id);
      if (res.success) {
        pushToast('success', '2FA removed for user');
        setRemove2faTarget(null);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to remove 2FA');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User, disable: boolean) => {
    setDialogLoading(true);
    try {
      const res = disable ? await usersApi.disable(user.id) : await usersApi.enable(user.id);
      if (res.success) {
        pushToast('success', res.message || `Account "${user.username}" ${disable ? 'disabled' : 'enabled'}`);
        setDisableTarget(null);
        if (editingUser?.id === user.id) {
          setEditingUser(null);
        }
        await fetchUsers(page);
      } else {
        pushToast('error', res.message || 'Operation failed');
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update account status');
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
        if (id === 1 || id === currentUser?.id) continue;
        if (disable) await usersApi.disable(id);
        else await usersApi.enable(id);
        count++;
      }
      pushToast('success', `${count} account${count !== 1 ? 's' : ''} ${disable ? 'disabled' : 'enabled'}`);
      setSelectedIds([]);
      await fetchUsers(page);
    } catch (err: any) {
      pushToast('error', err.message || 'Failed bulk status update');
    } finally {
      setIsLoading(false);
    }
  };

  const countGrantedPermissions = (perms?: Permissions) => {
    if (!perms) return 0;
    return Object.values(perms).filter(Boolean).length;
  };

  const startIndex = (page - 1) * 15;
  const endIndex = Math.min(total, startIndex + filteredUsers.length);
  const activeColSpan =
    5 +
    (visibleColumns.email ? 1 : 0) +
    (visibleColumns.permissions ? 1 : 0) +
    (visibleColumns.api_keys ? 1 : 0) +
    (visibleColumns.two_fa ? 1 : 0) +
    (visibleColumns.logins ? 1 : 0);

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-12 select-none font-sans">
      {/* 4 Clean Black Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full font-sans">
        <div className="flex items-stretch justify-between gap-5 rounded-[8px] border border-[#222222] bg-[#0f0f0f] hover:border-[#383838] transition-colors p-5 overflow-hidden shadow-sm">
          <div className="flex min-w-0 flex-col justify-between">
            <p className="truncate text-[13px] text-neutral-400">Total accounts</p>
            <p className="mt-1.5 text-[27px] font-medium leading-none tracking-tight text-white tabular-nums">{stats.members}</p>
            <p className="mt-2 h-[17px] overflow-hidden whitespace-nowrap text-[12.5px] font-medium leading-none text-neutral-500">active members</p>
          </div>
          <div className="flex items-center justify-center shrink-0">
             <UsersIcon className="w-6 h-6 text-neutral-500/50" />
          </div>
        </div>

        <div className="flex items-stretch justify-between gap-5 rounded-[8px] border border-[#222222] bg-[#0f0f0f] hover:border-[#383838] transition-colors p-5 overflow-hidden shadow-sm">
          <div className="flex min-w-0 flex-col justify-between">
            <p className="truncate text-[13px] text-neutral-400">Active API keys</p>
            <p className="mt-1.5 text-[27px] font-medium leading-none tracking-tight text-white tabular-nums">{stats.tokens}</p>
            <p className="mt-2 h-[17px] overflow-hidden whitespace-nowrap text-[12.5px] font-medium leading-none text-neutral-500">total generated</p>
          </div>
          <div className="flex items-center justify-center shrink-0">
             <KeyRound className="w-6 h-6 text-neutral-500/50" />
          </div>
        </div>

        <div className="flex items-stretch justify-between gap-5 rounded-[8px] border border-[#222222] bg-[#0f0f0f] hover:border-[#383838] transition-colors p-5 overflow-hidden shadow-sm">
          <div className="flex min-w-0 flex-col justify-between">
            <p className="truncate text-[13px] text-neutral-400">2FA protection</p>
            <p className="mt-1.5 text-[27px] font-medium leading-none tracking-tight text-white tabular-nums">{stats.twoFa}</p>
            <p className="mt-2 h-[17px] overflow-hidden whitespace-nowrap text-[12.5px] font-medium leading-none text-[#2f80ed]">secured</p>
          </div>
          <div className="flex items-center justify-center shrink-0">
             <ShieldCheck className="w-6 h-6 text-neutral-500/50" />
          </div>
        </div>

        <div className="flex items-stretch justify-between gap-5 rounded-[8px] border border-[#222222] bg-[#0f0f0f] hover:border-[#383838] transition-colors p-5 overflow-hidden shadow-sm">
          <div className="flex min-w-0 flex-col justify-between">
            <p className="truncate text-[13px] text-neutral-400">Disabled accounts</p>
            <p className={`mt-1.5 text-[27px] font-medium leading-none tracking-tight tabular-nums ${stats.locked > 0 ? 'text-[#ef4444]' : 'text-white'}`}>{stats.locked}</p>
            <p className="mt-2 h-[17px] overflow-hidden whitespace-nowrap text-[12.5px] font-medium leading-none text-neutral-500">locked</p>
          </div>
          <div className="flex items-center justify-center shrink-0">
             <Lock className="w-6 h-6 text-neutral-500/50" />
          </div>
        </div>
      </div>

      {/* Toolbar Controls — Matches Dashboard */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 select-none font-sans">
        {/* Search Input Group */}
        <label
          title="Search members (/ or Ctrl+K)"
          className="relative flex items-center h-9 rounded-[8px] bg-transparent border border-[#262626] focus-within:border-[#2f80ed] transition-colors px-3 gap-2 w-full sm:w-[280px] md:w-[320px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
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
                      setFilterRules([{ id: '1', field: 'username', operator: 'contains', value: '' }]);
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
              title="Filter members"
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
                        options={USER_FILTER_FIELD_OPTIONS}
                        onChange={(val) => handleFieldChange(rule.id, val as UserFilterField)}
                        className="w-28 sm:w-32 shrink-0"
                        menuWidth="w-40"
                      />

                      {/* Operator */}
                      <CustomSelect
                        value={rule.operator}
                        options={getUserFilterOperatorOptions(rule.field)}
                        onChange={(val) => updateFilterRule(rule.id, { operator: val as UserFilterOperator })}
                        className="w-32 sm:w-36 shrink-0"
                        menuWidth="w-44"
                      />

                      {/* Value Input */}
                      {rule.field === 'status' ? (
                        <CustomSelect
                          value={rule.value || 'active'}
                          options={USER_FILTER_STATUS_OPTIONS}
                          onChange={(val) => updateFilterRule(rule.id, { value: val })}
                          className="flex-1 min-w-0"
                          menuWidth="w-full"
                        />
                      ) : rule.field === 'two_fa' ? (
                        <CustomSelect
                          value={rule.value || 'enabled'}
                          options={USER_FILTER_2FA_OPTIONS}
                          onChange={(val) => updateFilterRule(rule.id, { value: val })}
                          className="flex-1 min-w-0"
                          menuWidth="w-full"
                        />
                      ) : rule.field === 'role' ? (
                        <CustomSelect
                          value={rule.value || 'owner'}
                          options={USER_FILTER_ROLE_OPTIONS}
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
                          placeholder="e.g. alex"
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
                {(['email', 'permissions', 'api_keys', 'two_fa', 'logins'] as const).map((col) => {
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
                      email: true,
                      permissions: true,
                      api_keys: true,
                      two_fa: true,
                      logins: true,
                    })
                  }
                  className="w-full text-left px-2.5 py-1.5 rounded text-[14px] text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer font-sans"
                >
                  Reset columns
                </button>
              </div>
            )}
          </div>

          {/* Create member button */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="group relative flex shrink-0 items-center justify-center h-9 px-3.5 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
            <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
              <Plus className="w-4 h-4 shrink-0" />
              <span>Create member</span>
            </span>
          </button>
        </div>
      </div>

      {/* Users Table Card — Exact Cloudflare DNS table structure */}
      <div id="users-table-card" className="w-full flex flex-col rounded-[12px] border border-[#222222] bg-black shadow-sm select-none font-sans">
        {/* Status bar */}
        <div className="flex w-full flex-col gap-2 px-4 py-3 bg-black font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-[#8c8c8c] font-normal select-none font-sans">
              {filteredUsers.length === users.length ? (
                <>
                  You have <strong className="font-semibold text-white">{total}</strong> {total === 1 ? 'member' : 'members'} configured.
                </>
              ) : (
                <>
                  Showing <strong className="font-semibold text-white">{filteredUsers.length}</strong> of <strong className="font-semibold text-white">{total}</strong> members.
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
                  USER_FILTER_FIELD_OPTIONS.find((f) => f.value === rule.field)?.label || rule.field;
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
                          setFilterRules([{ id: String(Date.now()), field: 'username', operator: 'contains', value: '' }]);
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
                  <span className="font-medium">{selectedIds.length} of {filteredUsers.length} selected</span>
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
                  Select all {filteredUsers.length} eligible members
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 font-sans">
                {isOwner() && (
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
                    <button
                      type="button"
                      onClick={() => setIsBulkDeleting(true)}
                      className="group relative flex shrink-0 items-center justify-center h-8 px-3 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#991b1b] bg-[#dc2626] font-sans"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                      <span className="relative flex items-center gap-1.5 text-[14px] font-sans">
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Delete {selectedIds.length} member{selectedIds.length !== 1 ? 's' : ''}</span>
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inset Table Card with rounded corners matching Dashboard */}
        <div className="mx-[6px] mb-[6px] border border-[#262626] rounded-[8px] overflow-hidden bg-[#0e0e0e]">
          <div className="overflow-x-auto overflow-y-hidden">
            <table
              role="table"
              aria-label="User members"
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
                    style={{ width: `${columnWidths.status}px` }}
                    className="group relative flex items-center shrink-0 h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                      <span>Status</span>
                      <CaretUpDownIcon active={sortField === 'status'} direction={sortDirection} />
                    </span>
                    <ColumnResizer
                      col="status"
                      resizingCol={resizingCol}
                      onResizeStart={handleResizeStart}
                      onReset={(c) => setColumnWidths((prev) => ({ ...prev, [c]: DEFAULT_USER_COLUMN_WIDTHS[c] }))}
                    />
                  </th>

                  {/* Member Column */}
                  <th
                    onClick={() => handleSort('username')}
                    style={{ width: `${columnWidths.username}px` }}
                    className="group relative flex items-center shrink-0 h-[40px] px-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                      <span>Member</span>
                      <CaretUpDownIcon active={sortField === 'username'} direction={sortDirection} />
                    </span>
                    <ColumnResizer
                      col="username"
                      resizingCol={resizingCol}
                      onResizeStart={handleResizeStart}
                      onReset={(c) => setColumnWidths((prev) => ({ ...prev, [c]: DEFAULT_USER_COLUMN_WIDTHS[c] }))}
                    />
                  </th>

                  {/* Email Column */}
                  {visibleColumns.email && (
                    <th
                      onClick={() => handleSort('email')}
                      style={{ width: `${columnWidths.email}px` }}
                      className="group relative flex items-center shrink-0 h-[40px] px-3 cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none font-sans">
                        <span>Email</span>
                        <CaretUpDownIcon active={sortField === 'email'} direction={sortDirection} />
                      </span>
                      <ColumnResizer
                        col="email"
                        resizingCol={resizingCol}
                        onResizeStart={handleResizeStart}
                        onReset={(c) => setColumnWidths((prev) => ({ ...prev, [c]: DEFAULT_USER_COLUMN_WIDTHS[c] }))}
                      />
                    </th>
                  )}

                  {/* Permissions Column */}
                  {visibleColumns.permissions && (
                    <th
                      style={{ width: `${columnWidths.permissions}px` }}
                      className="group relative flex items-center shrink-0 h-[40px] px-3"
                    >
                      <span className="text-[14px] font-medium text-white leading-none font-sans">Permissions</span>
                      <ColumnResizer
                        col="permissions"
                        resizingCol={resizingCol}
                        onResizeStart={handleResizeStart}
                        onReset={(c) => setColumnWidths((prev) => ({ ...prev, [c]: DEFAULT_USER_COLUMN_WIDTHS[c] }))}
                      />
                    </th>
                  )}

                  {/* API Keys Column */}
                  {visibleColumns.api_keys && (
                    <th
                      style={{ width: `${columnWidths.api_keys}px` }}
                      className="group relative flex items-center shrink-0 h-[40px] px-3"
                    >
                      <span className="text-[14px] font-medium text-white leading-none font-sans">API Keys</span>
                      <ColumnResizer
                        col="api_keys"
                        resizingCol={resizingCol}
                        onResizeStart={handleResizeStart}
                        onReset={(c) => setColumnWidths((prev) => ({ ...prev, [c]: DEFAULT_USER_COLUMN_WIDTHS[c] }))}
                      />
                    </th>
                  )}

                  {/* 2FA Status Column */}
                  {visibleColumns.two_fa && (
                    <th
                      style={{ width: `${columnWidths.two_fa}px` }}
                      className="group relative flex items-center shrink-0 h-[40px] px-3"
                    >
                      <span className="text-[14px] font-medium text-white leading-none font-sans">2FA Status</span>
                      <ColumnResizer
                        col="two_fa"
                        resizingCol={resizingCol}
                        onResizeStart={handleResizeStart}
                        onReset={(c) => setColumnWidths((prev) => ({ ...prev, [c]: DEFAULT_USER_COLUMN_WIDTHS[c] }))}
                      />
                    </th>
                  )}

                  {/* Failed Logins Column */}
                  {visibleColumns.logins && (
                    <th className="flex items-center shrink-0 w-[100px] h-[40px] px-3">
                      <span className="text-[14px] font-medium text-white leading-none font-sans">Logins</span>
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
                      <p className="text-[14px] text-[#6b6b6b] font-normal font-sans">Loading members...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={activeColSpan} className="px-4 py-12 text-center bg-[#0e0e0e]">
                      <p className="text-[14px] text-[#6b6b6b] font-normal font-sans">
                        No members match your search criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isMaster = u.role === 'owner';
                    const isSelf = u.id === currentUser?.id;
                    const isChecked = selectedIds.includes(u.id);
                    const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
                    const grantedPerms = countGrantedPermissions(u.permissions);

                    return (
                      <tr
                        key={u.id}
                        className={`group/row flex w-full items-center h-[40px] min-h-[40px] max-h-[40px] border-b border-[#1e1e1e] transition-colors font-sans ${
                          isChecked ? 'bg-[#181818]' : 'bg-[#0e0e0e] hover:bg-[#161616]'
                        }`}
                      >
                        {/* Checkbox cell */}
                        <td className="flex items-center justify-center shrink-0 w-[44px] min-w-[44px] h-[40px]">
                          <button
                            type="button"
                            role="checkbox"
                            disabled={isMaster || isSelf}
                            aria-checked={isChecked}
                            aria-label={`Select ${u.username}`}
                            onClick={() => handleSelectOne(u.id)}
                            className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-[#141414] ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2f80ed] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed data-[checked]:bg-[#2f80ed] data-[checked]:ring-[#2f80ed]"
                            data-checked={isChecked ? '' : undefined}
                          >
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                                <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                              </svg>
                            )}
                          </button>
                        </td>

                        {/* Status cell */}
                        <td
                          style={{ width: `${columnWidths.status}px` }}
                          className="flex items-center shrink-0 h-[40px] px-3 font-sans overflow-hidden"
                        >
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1.5 text-[14px] font-normal text-[#ef4444] leading-none font-sans">
                              Disabled
                            </span>
                          ) : onlineUsers[u.id] ? (
                            <span className="inline-flex items-center gap-1.5 text-[14px] font-normal text-[#30a46c] leading-none font-sans">
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[14px] font-normal text-[#8c8c8c] leading-none font-sans">
                              Offline
                            </span>
                          )}
                        </td>

                        {/* Member cell with Owner Shield Icon */}
                        <td
                          style={{ width: `${columnWidths.username}px` }}
                          className="flex items-center shrink-0 h-[40px] px-3 font-sans overflow-hidden"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate font-sans text-[14px] font-medium text-white">{u.username}</span>
                            {isMaster && (
                              <span title="System Owner" className="inline-flex items-center text-amber-500/90 shrink-0">
                                <Shield className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-[#1d4ed8]/20 text-[#60a5fa] font-medium leading-none shrink-0 font-sans">
                                You
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Email cell */}
                        {visibleColumns.email && (
                          <td
                            style={{ width: `${columnWidths.email}px` }}
                            className="flex items-center shrink-0 h-[40px] px-3 font-sans text-[14px] text-[#cccccc] truncate overflow-hidden"
                          >
                            {u.email ? (
                              <span className="truncate font-sans text-[14px] text-[#cccccc]">{u.email}</span>
                            ) : (
                              <span className="text-[#555555]">—</span>
                            )}
                          </td>
                        )}

                        {/* Permissions cell */}
                        {visibleColumns.permissions && (
                          <td
                            style={{ width: `${columnWidths.permissions}px` }}
                            className="flex items-center shrink-0 h-[40px] px-3 font-sans overflow-hidden"
                          >
                            {isMaster || grantedPerms === Object.keys(DEFAULT_PERMISSIONS).length ? (
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

                        {/* API Keys cell */}
                        {visibleColumns.api_keys && (
                          <td
                            style={{ width: `${columnWidths.api_keys}px` }}
                            className="flex items-center shrink-0 h-[40px] px-3 font-sans overflow-hidden"
                          >
                            {(u.api_keys_count || 0) > 0 ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/api-keys?user=${u.id}`)}
                                className="inline-flex items-center gap-1.5 text-[14px] text-[#2f80ed] hover:underline cursor-pointer font-sans"
                              >
                                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                                <span>{u.api_keys_count} key{u.api_keys_count !== 1 ? 's' : ''}</span>
                              </button>
                            ) : (
                              <span className="text-[14px] text-[#555555] font-sans">-</span>
                            )}
                          </td>
                        )}

                        {/* 2FA Status cell */}
                        {visibleColumns.two_fa && (
                          <td
                            style={{ width: `${columnWidths.two_fa}px` }}
                            className="flex items-center shrink-0 h-[40px] px-3 font-sans overflow-hidden"
                          >
                            <span
                              className={`text-[14px] font-normal leading-none font-sans ${
                                u.has_2fa ? 'text-white' : 'text-[#8c8c8c]'
                              }`}
                            >
                              {u.has_2fa ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                        )}

                        {/* Failed Logins cell */}
                        {visibleColumns.logins && (
                          <td className="flex items-center shrink-0 w-[100px] h-[40px] px-3 font-sans text-[14px] text-[#888888] tabular-nums">
                            {u.failed_attempts || 0}
                          </td>
                        )}

                        {/* Flexible Spacer to ensure all data columns stay left and ONLY Edit is right */}
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
                            disabled={isMaster && !isOwner()}
                            title={(isMaster && !isOwner()) ? "Only an owner can edit this account" : ""}
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center justify-center h-7 px-3 rounded-md text-[14px] font-medium leading-none text-white hover:text-white bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0 font-sans"
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

          {/* Table Footer — Embedded Pagination matching Dashboard */}
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

      {/* Create Member SlideOver Drawer */}
      <SlideOver
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create member"
      >
        <form onSubmit={handleCreateUser} className="flex flex-col h-full min-h-0 bg-[#0e0e0e] font-sans">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 font-sans">
            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Username <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. alex"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Email
              </label>
              <input
                type="email"
                placeholder="e.g. alex@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Password <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
              />
            </div>

            <div className="pt-2 font-sans">
              <div className="mb-2 font-sans">
                <span className="text-[14px] font-medium text-white block font-sans">Permissions</span>
                <span className="text-[13px] text-[#8c8c8c] font-sans">Fine-grained access rights for this member</span>
              </div>
              <PermissionTable value={newPermissions} onChange={setNewPermissions} />
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
                  {createLoading ? 'Creating...' : 'Create member'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </SlideOver>

      {/* Edit Member SlideOver Drawer */}
      <SlideOver
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title={
          <span className="flex items-center gap-2">
            <span>Edit member</span>
            <span className="text-[#555555] font-normal">/</span>
            <span className="text-[#e6e6e6] font-medium">{editingUser?.username}</span>
          </span>
        }
        subtitle={
          editingUser && (
            <div className="flex items-center gap-2 text-[13px] text-[#8c8c8c] mt-0.5 font-sans">
              {editingUser.role === 'owner' && (
                <span className="inline-flex items-center text-amber-500/90 shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </span>
              )}
              <span className={editingUser.role === 'owner' ? 'text-white font-medium font-sans text-[13px]' : 'text-[#8c8c8c] font-sans text-[13px]'}>
                {editingUser.role === 'owner' ? 'Owner' : 'Member'}
              </span>
              <span className="text-[#555555]">•</span>
              <span className="text-[13px] text-[#8c8c8c] font-sans">#{editingUser.id}</span>
              {editingUser.has_2fa && (
                <>
                  <span className="text-[#555555]">•</span>
                  <span className="text-[#30a46c] font-sans">2FA Active</span>
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
                Username <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white outline-none transition-colors font-sans"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                Email
              </label>
              <input
                type="email"
                placeholder="e.g. alex@example.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#8c8c8c] mb-1.5 font-sans">
                New Password <span className="text-[13px] text-[#555555] font-normal">(leave blank to keep current)</span>
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-[8px] border border-[#262626] bg-[#141414] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#555555] outline-none transition-colors font-sans"
              />
            </div>

            {/* Permissions */}
            {editingUser?.role !== 'owner' ? (
              <div className="pt-2 font-sans">
                <div className="mb-2 font-sans">
                  <span className="text-[14px] font-medium text-white block font-sans">Permissions</span>
                  <span className="text-[13px] text-[#8c8c8c] font-sans">Adjust functional scopes for this member</span>
                </div>
                <PermissionTable value={editPermissions} onChange={setEditPermissions} />
              </div>
            ) : (
              <div className="p-3.5 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-[14px] font-medium text-amber-500 font-sans">System Owner Account</span>
                </div>
                <p className="text-[13px] text-[#8c8c8c] mt-1 leading-relaxed font-sans">
                  The primary system owner account automatically possesses all permissions across processes, terminal, users, and security settings.
                </p>
              </div>
            )}

            {/* Account Management & Security Actions */}
            {(editingUser?.role !== 'owner' || editingUser?.has_2fa) && (
              <div className="pt-2 space-y-3 font-sans">
                <span className="text-[14px] font-medium text-white block font-sans">Security & Account Control</span>

              {/* Account Status / Disable Account Action */}
              {editingUser && editingUser.role !== 'owner' && isOwner() && (
                editingUser?.locked_until && new Date(editingUser.locked_until) > new Date() ? (
                  <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                    <div>
                      <span className="text-[14px] font-medium text-white block font-sans">Account Disabled</span>
                      <span className="text-[13px] text-[#8c8c8c] font-sans">User login is currently blocked</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleUserStatus(editingUser, false)}
                      className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#257850] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#30a46c] to-[#247c52] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      <span className="relative z-10">Enable</span>
                    </button>
                  </div>
                ) : editingUser?.id !== currentUser?.id ? (
                  <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                    <div>
                      <span className="text-[14px] font-medium text-white block font-sans">Disable Account</span>
                      <span className="text-[13px] text-[#8c8c8c] font-sans">Temporarily suspend this member's access</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDisableTarget({ user: editingUser!, disable: true });
                        setEditingUser(null);
                      }}
                      className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#b45309] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#f59e0b] to-[#d97706] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      <span className="relative z-10">Disable</span>
                    </button>
                  </div>
                ) : null
              )}

              {/* Force Remove 2FA Action */}
              {editingUser?.has_2fa && (
                <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                  <div>
                    <span className="text-[14px] font-medium text-white block font-sans">Two-Factor Authentication</span>
                    <span className="text-[13px] text-[#8c8c8c] font-sans">Disable if user lost their authenticator device</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemove2faTarget(editingUser);
                      setEditingUser(null);
                    }}
                    className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#b91c1c] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    <span className="relative z-10">Reset 2FA</span>
                  </button>
                </div>
              )}

              {/* Delete Member Action (Only for non-owner, non-self) */}
              {editingUser?.role !== 'owner' && editingUser?.id !== currentUser?.id && isOwner() && (
                <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#141414] border border-[#262626] font-sans">
                  <div>
                    <span className="text-[14px] font-medium text-white block font-sans">Delete Account</span>
                    <span className="text-[13px] text-[#8c8c8c] font-sans">Permanently revoke this member's access</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(editingUser);
                      setEditingUser(null);
                    }}
                    className="group relative inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-[#181818] border border-[#282828] hover:border-[#b91c1c] overflow-hidden transition-all duration-150 cursor-pointer font-sans shadow-xs"
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    <span className="relative z-10">Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned Bottom Footer Bar */}
          <div className="shrink-0 px-4 py-3 bg-[#0e0e0e] flex items-center justify-between font-sans">
            <span className="text-[13px] text-[#8c8c8c] font-sans">
              {editingUser?.role === 'owner' ? 'All scopes enabled' : `${countGrantedPermissions(editPermissions)} of 21 granted`}
            </span>
            <div className="flex items-center gap-2 font-sans">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading || !hasEditChanges}
                className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
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

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={disableTarget !== null}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => disableTarget && handleToggleUserStatus(disableTarget.user, disableTarget.disable)}
        title={disableTarget?.disable ? 'Disable Member Account' : 'Enable Member Account'}
        message={
          disableTarget?.disable
            ? `Are you sure you want to disable "${disableTarget?.user.username}"? Their active sessions will be terminated immediately, and they will be blocked from logging in.`
            : `Are you sure you want to enable "${disableTarget?.user.username}"? They will be able to log in normally again.`
        }
        confirmLabel={disableTarget?.disable ? 'Disable Account' : 'Enable Account'}
        variant={disableTarget?.disable ? 'danger' : 'primary'}
        isLoading={dialogLoading}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null || isBulkDeleting}
        onClose={() => {
          setDeleteTarget(null);
          setIsBulkDeleting(false);
        }}
        onConfirm={confirmDeleteUser}
        title={isBulkDeleting ? `Delete ${selectedIds.length} Member Accounts` : 'Delete Member Account'}
        message={
          isBulkDeleting
            ? `Are you sure you want to permanently delete ${selectedIds.length} member accounts? This action cannot be undone.`
            : `Are you sure you want to permanently delete member "${deleteTarget?.username}"? This action cannot be undone.`
        }
        confirmLabel={isBulkDeleting ? `Delete ${selectedIds.length} Members` : 'Delete User'}
        variant="danger"
        isLoading={dialogLoading}
      />

      <ConfirmDialog
        isOpen={remove2faTarget !== null}
        onClose={() => setRemove2faTarget(null)}
        onConfirm={confirmRemove2fa}
        title="Force Remove 2FA"
        message={`This will immediately disable 2FA for "${remove2faTarget?.username}". Use this only if the user has lost access to their authenticator device.`}
        confirmLabel="Disable 2FA"
        variant="danger"
        isLoading={dialogLoading}
      />
    </div>
  );
};
