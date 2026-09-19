import { create } from 'zustand';
import type { CurrentUser, Permissions } from '../types';

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  setUser: (user: CurrentUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  hasPermission: (permission: keyof Permissions) => boolean;
  isOwner: () => boolean;
}

export const DEV_ADMIN: CurrentUser = {
  id: 1,
  username: 'admin',
  role: 'owner',
  permissions: {
    users_create: true,
    users_edit: true,
    users_delete: true,
    users_reset_2fa: true,
    users_view: true,
    users_disable: true,
    api_keys_view: true,
    api_keys_create: true,
    api_keys_edit: true,
    api_keys_disable: true,
    api_keys_delete: true,
    processes_view: true,
    processes_start: true,
    processes_stop: true,
    processes_restart: true,
    processes_create: true,
    processes_edit: true,
    processes_delete: true,
    logs_view_audit: true,
    logs_view_login: true,
    logs_view_terminal: true,
    settings_view: true,
    settings_edit: true,
    settings_security: true,
    terminal_access: true,
    terminal_unrestricted: true
  },
  hostname: 'localhost',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: DEV_ADMIN,
  isLoading: false,
  setUser: (user) => set({ user: user || DEV_ADMIN, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  hasPermission: (permission) => {
    const u = get().user;
    if (!u) return false;
    if (u.role === 'owner') return true;
    return !!u.permissions?.[permission];
  },
  isOwner: () => {
    const u = get().user;
    return u?.id === 1;
  },
}));
