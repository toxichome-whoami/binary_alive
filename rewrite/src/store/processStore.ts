import { create } from 'zustand';
import type { Process } from '../types';

interface ProcessState {
  processes: Process[];
  sysLoad: string | number;
  isInitialLoading: boolean;
  setStats: (processes: Process[], sysLoad: string | number) => void;
}

export const useProcessStore = create<ProcessState>((set) => ({
  processes: [],
  sysLoad: '0.00',
  isInitialLoading: true,
  setStats: (processes, sysLoad) => set({ processes, sysLoad, isInitialLoading: false }),
}));
