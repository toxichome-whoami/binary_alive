import { create } from 'zustand';
import type { CurrentUser, Role } from '../types';

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  setUser: (user: CurrentUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  hasRole: (roles: Role[]) => boolean;
  canControl: () => boolean;
  isAdmin: () => boolean;
  isMasterAdmin: () => boolean;
}

export const DEV_ADMIN: CurrentUser = {
  id: 1,
  username: 'admin',
  role: 'admin',
  hostname: 'localhost',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: DEV_ADMIN,
  isLoading: false,
  setUser: (user) => set({ user: user || DEV_ADMIN, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  hasRole: (roles) => {
    const u = get().user;
    if (!u) return false;
    return roles.includes(u.role);
  },
  canControl: () => {
    const u = get().user;
    if (!u) return false;
    return u.role === 'admin' || u.role === 'operator';
  },
  isAdmin: () => {
    const u = get().user;
    return u?.role === 'admin';
  },
  isMasterAdmin: () => {
    const u = get().user;
    return u?.id === 1;
  },
}));
