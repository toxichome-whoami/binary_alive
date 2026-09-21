import { useCallback, useEffect } from 'react';
import { useProcessStore } from '../store/processStore';
import { processesApi } from '../api/processes';
import { useToastStore } from '../store/toastStore';

interface UseProcessesOptions {
  intervalMs?: number;
}

export function useProcesses({ intervalMs }: UseProcessesOptions = {}) {
  const processes = useProcessStore(s => s.processes);
  const sysLoad = useProcessStore(s => s.sysLoad);
  const isLoading = useProcessStore(s => s.isInitialLoading);
  const pushToast = useToastStore(s => s.push);

  const refresh = useCallback(async () => {
    // This is now just a fallback if they want to manually trigger an API refresh
    try {
      const res = await processesApi.getStatus();
      if (res.success && Array.isArray(res.data)) {
        useProcessStore.getState().setStats(res.data, res.sys_load || '0.00');
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to fetch process status manually');
    }
  }, [pushToast]);

  useEffect(() => {
    // Fetch immediately on mount so the user doesn't wait for the first websocket broadcast
    if (useProcessStore.getState().isInitialLoading) {
      refresh();
    }
  }, [refresh]);

  return {
    processes,
    sysLoad,
    isLoading,
    error: null,
    refresh,
  };
}
