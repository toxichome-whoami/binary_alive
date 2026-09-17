import { useState, useEffect, useCallback, useRef } from 'react';
import { processesApi } from '../api/processes';
import type { Process } from '../types';
import { parseUptimeToSeconds, formatSecondsToUptime } from '../utils/uptime';

interface UseProcessesOptions {
  intervalMs?: number;
}

// Default 9 processes monitored by Binary Alive supervisor (7 active, 2 stopped)
const DEFAULT_PROCESSES: Process[] = [
  {
    id: 1,
    name: 'api_gateway',
    group_name: 'Services',
    command: './bin/api_gateway --port=8080 --workers=4',
    working_dir: '/var/www/api',
    log_file: '/var/log/api_gateway.log',
    status: 'running',
    pid: 4102,
    cpu: '3.8%',
    mem: '112 MB',
    uptime: '14d 06:12:00',
    restart_count: 1,
    auto_restart: 1,
  },
  {
    id: 2,
    name: 'mrtx_bot',
    group_name: 'Bots',
    command: 'python3 -m bot.main --config=production.env',
    working_dir: '/home/toxichome/mrtx_bot',
    log_file: '/var/log/mrtx_bot.log',
    status: 'running',
    pid: 4108,
    cpu: '2.4%',
    mem: '48 MB',
    uptime: '14d 06:12:00',
    restart_count: 0,
    auto_restart: 1,
  },
  {
    id: 3,
    name: 'auth_service',
    group_name: 'Services',
    command: 'node dist/server.js --env=prod',
    working_dir: '/var/www/auth',
    log_file: '/var/log/auth_service.log',
    status: 'running',
    pid: 4115,
    cpu: '1.9%',
    mem: '64 MB',
    uptime: '14d 06:12:00',
    restart_count: 0,
    auto_restart: 1,
  },
  {
    id: 4,
    name: 'redis_worker',
    group_name: 'Workers',
    command: 'php worker.php --queue=default,high --concurrency=2',
    working_dir: '/var/www/worker',
    log_file: '/var/log/redis_worker.log',
    status: 'running',
    pid: 4122,
    cpu: '3.1%',
    mem: '96 MB',
    uptime: '7d 18:40:00',
    restart_count: 0,
    auto_restart: 1,
  },
  {
    id: 5,
    name: 'metric_daemon',
    group_name: 'System',
    command: './metric_daemon -c /etc/binary_alive/metric.conf',
    working_dir: '/opt/collector',
    log_file: '/var/log/metric_daemon.log',
    status: 'running',
    pid: 4130,
    cpu: '1.2%',
    mem: '32 MB',
    uptime: '14d 06:12:00',
    restart_count: 0,
    auto_restart: 1,
  },
  {
    id: 6,
    name: 'dns_proxy',
    group_name: 'Network',
    command: 'go-dns-proxy -port 5353 -upstream 1.1.1.1',
    working_dir: '/etc/dns',
    log_file: '/var/log/dns_proxy.log',
    status: 'running',
    pid: 4142,
    cpu: '0.8%',
    mem: '24 MB',
    uptime: '14d 06:12:00',
    restart_count: 0,
    auto_restart: 1,
  },
  {
    id: 7,
    name: 'mail_relay',
    group_name: 'Network',
    command: '/usr/sbin/postfix-relay -d',
    working_dir: '/etc/postfix',
    log_file: '/var/log/mail_relay.log',
    status: 'running',
    pid: 4155,
    cpu: '1.0%',
    mem: '18 MB',
    uptime: '3d 11:05:00',
    restart_count: 1,
    auto_restart: 1,
  },
  {
    id: 8,
    name: 'backup_sync',
    group_name: 'System',
    command: './scripts/backup_sync.sh --target=s3://backups/daily',
    working_dir: '/opt/backup',
    log_file: '/var/log/backup_sync.log',
    status: 'stopped',
    pid: null,
    cpu: 0,
    mem: '0 MB',
    uptime: '00:00:00',
    restart_count: 0,
    auto_restart: 0,
  },
  {
    id: 9,
    name: 'webhook_listener',
    group_name: 'Services',
    command: 'python3 webhook_srv.py --port=9000',
    working_dir: '/var/www/webhooks',
    log_file: '/var/log/webhook_listener.log',
    status: 'stopped',
    pid: null,
    cpu: 0,
    mem: '0 MB',
    uptime: '00:00:00',
    restart_count: 0,
    auto_restart: 0,
  },
];

export function useProcesses({ intervalMs = 5000 }: UseProcessesOptions = {}) {
  const [processes, setProcesses] = useState<Process[]>(DEFAULT_PROCESSES);
  const [sysLoad, setSysLoad] = useState<string | number>('0.08');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref of current seconds for each process so we can smoothly tick without refetching
  const uptimeSecondsRef = useRef<Record<number, number>>({});

  const fetchStatus = useCallback(async (showLoading = false) => {
    if (document.hidden) return;
    if (showLoading) setIsLoading(true);

    try {
      const res = await processesApi.getStatus();
      if (res.success && Array.isArray(res.data)) {
        // Sync uptime counters
        const newSecondsMap: Record<number, number> = {};
        res.data.forEach((p) => {
          if (p.status === 'running' && p.uptime) {
            newSecondsMap[p.id] = parseUptimeToSeconds(p.uptime);
          } else {
            newSecondsMap[p.id] = 0;
          }
        });
        uptimeSecondsRef.current = newSecondsMap;

        setProcesses(res.data);
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
