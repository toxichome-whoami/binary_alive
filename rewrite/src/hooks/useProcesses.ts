import { useState, useEffect, useCallback, useRef } from 'react';
import { processesApi } from '../api/processes';
import type { Process } from '../types';
import { parseUptimeToSeconds, formatSecondsToUptime } from '../utils/uptime';

interface UseProcessesOptions {
  intervalMs?: number;
}

export function useProcesses({ intervalMs = 5000 }: UseProcessesOptions = {}) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [sysLoad, setSysLoad] = useState<string | number>('0.00');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref of current seconds for each process so we can smoothly tick without refetching
  const uptimeSecondsRef = useRef<Record<number, number>>({});

  const fetchStatus = useCallback(async (showLoading = false) => {
    if (document.hidden) return;
    if (showLoading && processes.length === 0) setIsLoading(true);

    try {
      const res = await processesApi.getStatus();
      if (res.success && Array.isArray(res.data)) {
        const processList = res.data;

        // Sync uptime counters
        const newSecondsMap: Record<number, number> = {};
        processList.forEach((p) => {
          if (p.status === 'running' && p.uptime) {
            newSecondsMap[p.id] = parseUptimeToSeconds(p.uptime);
          } else {
            newSecondsMap[p.id] = 0;
          }
        });
        uptimeSecondsRef.current = newSecondsMap;

        setProcesses(processList);
        if (res.sys_load !== undefined) {
          setSysLoad(res.sys_load);
        }
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch process status');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Polling interval
  useEffect(() => {
    fetchStatus(true);

    const interval = setInterval(() => {
      fetchStatus(false);
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatus(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStatus, intervalMs]);

  // Smooth 1-second client-side uptime ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setProcesses((prevProcs) => {
        let changed = false;
        const nextProcs = prevProcs.map((p) => {
          if (p.status === 'running') {
            const currentSecs = (uptimeSecondsRef.current[p.id] || 0) + 1;
            uptimeSecondsRef.current[p.id] = currentSecs;
            changed = true;
            return {
              ...p,
              uptime: formatSecondsToUptime(currentSecs),
            };
          }
          return p;
        });
        return changed ? nextProcs : prevProcs;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  return {
    processes,
    sysLoad,
    isLoading,
    error,
    refresh: () => fetchStatus(true),
  };
}
