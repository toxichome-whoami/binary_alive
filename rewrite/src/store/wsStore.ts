import { create } from 'zustand';

interface WsState {
  isConnected: boolean;
  onlineUsers: Record<number, boolean>;
  setConnected: (connected: boolean) => void;
  setOnlineStatus: (userId: number, isOnline: boolean) => void;
}

export const useWsStore = create<WsState>((set) => ({
  isConnected: false,
  onlineUsers: {},
  setConnected: (connected) => set({ isConnected: connected }),
  setOnlineStatus: (userId, isOnline) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: isOnline },
    })),
}));
