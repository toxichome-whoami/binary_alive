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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  hasPermission: (permission) => {
    const u = get().user;
    if (!u) return false;
    if (u.role === 'owner') return true;
    return !!u.permissions?.[permission];
  },
  isOwner: () => {
    const u = get().user;
    return u?.role === 'owner';
  },
}));
