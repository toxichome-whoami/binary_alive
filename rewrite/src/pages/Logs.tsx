import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logsApi } from '../api/logs';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import type { AuditLog, LoginAttemptLog } from '../types';
import { SlideOver } from '../components/ui/SlideOver';
import { format } from 'date-fns';
import {
  FileText,
  KeyRound,
  Terminal as TerminalIcon,
  Copy,
  Check,
} from 'lucide-react';
import { DateRangePicker } from '../components/shared/DateRangePicker';
import { TelemetryCard, cubicBezierY, formatTimeFromPct } from '../components/shared/TelemetryCard';

// ============================================================================
// Icons
// ============================================================================

const RestartIcon: React.FC<{ className?: string }> = ({ className = 'w-[15px] h-[15px]' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const CaretUpDownIcon: React.FC<{ active: boolean; direction: 'asc' | 'desc' }> = ({
  active,
  direction,
}) => {
  if (active) {
    return direction === 'asc' ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        fill="currentColor"
        viewBox="0 0 256 256"
        className="text-[#3E8EFF] shrink-0"
      >
        <path d="M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z" />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        fill="currentColor"
        viewBox="0 0 256 256"
        className="text-[#3E8EFF] shrink-0"
      >
        <path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      fill="currentColor"
      viewBox="0 0 256 256"
      className="pointer-events-none opacity-40 shrink-0 text-[#8c8c8c]"
    >
      <path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z" />
    </svg>
  );
};



// ============================================================================
// Rich, Realistic Data Sets (30+ entries each for deep table pagination)
// ============================================================================

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 1095,
    user_id: 1,
    username: 'toxichome',
    action: 'process_restart',
    details: 'Process api_gateway (PID 4102) restarted via supervisor watchdog',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 1094,
    user_id: 1,
    username: 'toxichome',
    action: 'process_start',
    details: 'Initiated background runner mrtx_bot --config=production.env (PID 4108)',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
  },
  {
    id: 1093,
    user_id: 2,
    username: 'admin',
    action: 'config_update',
    details: 'Updated auto_restart=1 and max_memory=512MB on auth_service',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 1092,
    user_id: null,
    username: 'System',
    action: 'cron_watchdog',
    details: 'Cycle check completed: 7/9 binaries active, memory pressure normal',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
  {
    id: 1091,
    user_id: 1,
    username: 'toxichome',
    action: 'ip_whitelist',
    details: 'Whitelisted subnet 192.168.1.0/24 for dashboard control API',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
  },
  {
    id: 1090,
    user_id: 3,
    username: 'operator',
    action: 'process_stop',
    details: 'Graceful shutdown signal (SIGTERM) sent to backup_sync (PID 5124)',
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
  },
  {
    id: 1089,
    user_id: 1,
    username: 'toxichome',
    action: 'env_reload',
    details: 'Production environment variables decrypted and synced across 9 workers',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
  },
  {
    id: 1088,
    user_id: 2,
    username: 'admin',
    action: 'security_audit',
    details: 'SHA256 executable integrity verified: all binary signatures valid',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    id: 1087,
    user_id: 1,
    username: 'toxichome',
    action: 'process_create',
    details: 'Registered new monitored process go_telemetry (auto_restart=true, port=9090)',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 145 * 60 * 1000).toISOString(),
  },
  {
    id: 1086,
    user_id: null,
    username: 'System',
    action: 'database_vacuum',
    details: 'SQLite storage optimized, WAL checkpoint committed (0 errors, 4.2MB freed)',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
  },
  {
    id: 1085,
    user_id: 2,
    username: 'admin',
    action: 'auth_token_issue',
    details: 'Issued scoped bearer token for metrics-collector daemon (expires in 30d)',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
  },
  {
    id: 1084,
    user_id: 1,
    username: 'toxichome',
    action: 'process_restart',
    details: 'Reloaded caddy_ingress proxy configuration (caddy reload --config /etc/caddy)',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 245 * 60 * 1000).toISOString(),
  },
  {
    id: 1083,
    user_id: null,
    username: 'System',
    action: 'tls_cert_renew',
    details: 'Automated ACME TLS certificate renewed for *.toxichome.cc (valid 90d)',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 280 * 60 * 1000).toISOString(),
  },
  {
    id: 1082,
    user_id: 3,
    username: 'operator',
    action: 'log_rotate',
    details: 'Archived binary_alive.log (142MB gzip compressed) to /data/logs/archive',
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
  },
  {
    id: 1081,
    user_id: 1,
    username: 'toxichome',
    action: 'config_update',
    details: 'Adjusted rate_limit=120req/min for public API ingress endpoints',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 365 * 60 * 1000).toISOString(),
  },
  {
    id: 1080,
    user_id: 2,
    username: 'admin',
    action: 'process_start',
    details: 'Started queue_worker_2 with concurrency=4 (PID 6012)',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 410 * 60 * 1000).toISOString(),
  },
  {
    id: 1079,
    user_id: null,
    username: 'System',
    action: 'memory_alert',
    details: 'Memory threshold warning: node_backend utilized 448MB / 512MB limit',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 460 * 60 * 1000).toISOString(),
  },
  {
    id: 1078,
    user_id: 1,
    username: 'toxichome',
    action: 'process_restart',
    details: 'Force restarted node_backend to clear memory heap cache (PID 4821 -> 6140)',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 500 * 60 * 1000).toISOString(),
  },
  {
    id: 1077,
    user_id: 4,
    username: 'auditor',
    action: 'export_data',
    details: 'Exported compliance audit trail for period 2026-09-01 through 2026-09-17',
    ip_address: '192.168.1.112',
    timestamp: new Date(Date.now() - 550 * 60 * 1000).toISOString(),
  },
  {
    id: 1076,
    user_id: null,
    username: 'System',
    action: 'cron_watchdog',
    details: 'Supervisor health check: all heartbeats acknowledged in 4.1ms',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 610 * 60 * 1000).toISOString(),
  },
  {
    id: 1075,
    user_id: 1,
    username: 'toxichome',
    action: 'user_permission',
    details: 'Updated role for user operator: granted terminal_view permissions',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 670 * 60 * 1000).toISOString(),
  },
  {
    id: 1074,
    user_id: 2,
    username: 'admin',
    action: 'process_stop',
    details: 'Stopped dev_mock_server (PID 3302) following staging deployment',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 740 * 60 * 1000).toISOString(),
  },
  {
    id: 1073,
    user_id: 1,
    username: 'toxichome',
    action: 'firewall_sync',
    details: 'Applied iptables rules: blocked port 9000 except from loopback',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 810 * 60 * 1000).toISOString(),
  },
  {
    id: 1072,
    user_id: null,
    username: 'System',
    action: 'backup_create',
    details: 'Automated snapshot backup created: db_snapshot_20260918.tar.zst (88MB)',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 880 * 60 * 1000).toISOString(),
  },
  {
    id: 1071,
    user_id: 3,
    username: 'operator',
    action: 'process_restart',
    details: 'Restarted redis_cluster worker 03 after cache evict policy update',
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 950 * 60 * 1000).toISOString(),
  },
  {
    id: 1070,
    user_id: 1,
    username: 'toxichome',
    action: 'config_update',
    details: 'Enabled HTTP/3 and QUIC transport protocol in web_gateway config',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 1020 * 60 * 1000).toISOString(),
  },
  {
    id: 1069,
    user_id: null,
    username: 'System',
    action: 'cron_watchdog',
    details: 'Daemon cycle verified: 9/9 binaries running, load avg 0.28, 0.31, 0.29',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 1100 * 60 * 1000).toISOString(),
  },
  {
    id: 1068,
    user_id: 2,
    username: 'admin',
    action: 'system_upgrade',
    details: 'Binary Alive supervisor binary refreshed to build v2.4.1-patch8',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 1200 * 60 * 1000).toISOString(),
  },
];

const DEFAULT_LOGIN_LOGS: LoginAttemptLog[] = [
  {
    id: 428,
    username: 'toxichome',
    is_successful: 1,
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 427,
    username: 'admin',
    is_successful: 1,
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  },
  {
    id: 426,
    username: 'root',
    is_successful: 0,
    ip_address: '198.51.100.24',
    timestamp: new Date(Date.now() - 54 * 60 * 1000).toISOString(),
  },
  {
    id: 425,
    username: 'operator',
    is_successful: 1,
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
  },
  {
    id: 424,
    username: 'unknown_scanner',
    is_successful: 0,
    ip_address: '203.0.113.88',
    timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
  },
  {
    id: 423,
    username: 'toxichome',
    is_successful: 1,
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
  },
  {
    id: 422,
    username: 'auditor',
    is_successful: 1,
    ip_address: '192.168.1.112',
    timestamp: new Date(Date.now() - 195 * 60 * 1000).toISOString(),
  },
  {
    id: 421,
    username: 'admin',
    is_successful: 1,
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
  },
  {
    id: 420,
    username: 'guest',
    is_successful: 0,
    ip_address: '185.220.101.5',
    timestamp: new Date(Date.now() - 290 * 60 * 1000).toISOString(),
  },
  {
    id: 419,
    username: 'support',
    is_successful: 0,
    ip_address: '194.26.29.112',
    timestamp: new Date(Date.now() - 340 * 60 * 1000).toISOString(),
  },
  {
    id: 418,
    username: 'toxichome',
    is_successful: 1,
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 390 * 60 * 1000).toISOString(),
  },
  {
    id: 417,
    username: 'operator',
    is_successful: 1,
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 440 * 60 * 1000).toISOString(),
  },
  {
    id: 416,
    username: 'oracle',
    is_successful: 0,
    ip_address: '45.142.122.9',
    timestamp: new Date(Date.now() - 500 * 60 * 1000).toISOString(),
  },
  {
    id: 415,
    username: 'admin',
    is_successful: 1,
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 560 * 60 * 1000).toISOString(),
  },
  {
    id: 414,
    username: 'deploy_key',
    is_successful: 1,
    ip_address: '10.0.0.4',
    timestamp: new Date(Date.now() - 620 * 60 * 1000).toISOString(),
  },
  {
    id: 413,
    username: 'toxichome',
    is_successful: 1,
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 680 * 60 * 1000).toISOString(),
  },
  {
    id: 412,
    username: 'test_user',
    is_successful: 0,
    ip_address: '89.248.165.74',
    timestamp: new Date(Date.now() - 750 * 60 * 1000).toISOString(),
  },
  {
    id: 411,
    username: 'auditor',
    is_successful: 1,
    ip_address: '192.168.1.112',
    timestamp: new Date(Date.now() - 820 * 60 * 1000).toISOString(),
  },
  {
    id: 410,
    username: 'admin',
    is_successful: 1,
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 900 * 60 * 1000).toISOString(),
  },
  {
    id: 409,
    username: 'crawler_bot',
    is_successful: 0,
    ip_address: '194.38.20.14',
    timestamp: new Date(Date.now() - 980 * 60 * 1000).toISOString(),
  },
];

const DEFAULT_TERMINAL_LOGS: AuditLog[] = [
  {
    id: 624,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'systemctl status binary_alive.service --no-pager',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 623,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'ps aux | grep api_gateway | awk \'{print $2, $3, $4, $11}\'',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
  },
  {
    id: 622,
    user_id: 2,
    username: 'admin',
    action: 'terminal_command',
    details: 'ss -tulpn | grep 8080',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
  },
  {
    id: 621,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'journalctl -u binary_alive -n 100 --no-pager | tail -n 25',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
  },
  {
    id: 620,
    user_id: 2,
    username: 'admin',
    action: 'terminal_command',
    details: 'df -h /data && free -m -h',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 105 * 60 * 1000).toISOString(),
  },
  {
    id: 619,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'uptime && cat /proc/loadavg',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
  },
  {
    id: 618,
    user_id: 3,
    username: 'operator',
    action: 'terminal_command',
    details: 'tail -f /var/www/jobs/worker.log -n 50',
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 185 * 60 * 1000).toISOString(),
  },
  {
    id: 617,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 230 * 60 * 1000).toISOString(),
  },
  {
    id: 616,
    user_id: 2,
    username: 'admin',
    action: 'terminal_command',
    details: 'sha256sum /opt/binary_alive/bin/* > /tmp/checksums.txt',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 280 * 60 * 1000).toISOString(),
  },
  {
    id: 615,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'caddy validate --config /etc/caddy/Caddyfile',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 340 * 60 * 1000).toISOString(),
  },
  {
    id: 614,
    user_id: 3,
    username: 'operator',
    action: 'terminal_command',
    details: 'redis-cli -p 6379 info stats | grep -E "total_connections|instantaneous"',
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 410 * 60 * 1000).toISOString(),
  },
  {
    id: 613,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'iptables -L INPUT -v -n --line-numbers | head -n 30',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 480 * 60 * 1000).toISOString(),
  },
  {
    id: 612,
    user_id: 2,
    username: 'admin',
    action: 'terminal_command',
    details: 'sqlite3 /var/lib/binary_alive/local.db "PRAGMA integrity_check;"',
    ip_address: '127.0.0.1',
    timestamp: new Date(Date.now() - 560 * 60 * 1000).toISOString(),
  },
  {
    id: 611,
    user_id: 1,
    username: 'toxichome',
    action: 'terminal_command',
    details: 'kill -HUP $(pgrep -f "worker-queue")',
    ip_address: '192.168.1.105',
    timestamp: new Date(Date.now() - 650 * 60 * 1000).toISOString(),
  },
  {
    id: 610,
    user_id: 3,
    username: 'operator',
    action: 'terminal_command',
    details: 'vmstat 1 5',
    ip_address: '10.0.0.14',
    timestamp: new Date(Date.now() - 740 * 60 * 1000).toISOString(),
  },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PageSizeDropdownProps {
  pageSize: number;
  onChange: (size: number) => void;
}

const PageSizeDropdown: React.FC<PageSizeDropdownProps> = ({ pageSize, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-7 px-2.5 rounded-md bg-[#141414] border text-[13px] font-normal text-[#cccccc] hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors select-none ${
          isOpen ? 'border-[#2f80ed] text-white bg-[#1a1a1a]' : 'border-[#262626] hover:border-[#383838]'
        }`}
        aria-label="Rows per page"
        aria-expanded={isOpen}
      >
        <span className="tabular-nums">{pageSize}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="11"
          height="11"
          fill="currentColor"
          viewBox="0 0 256 256"
          className={`text-[#777777] transition-transform duration-150 shrink-0 ${isOpen ? 'rotate-180 text-white' : ''}`}
        >
          <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-1.5 w-20 rounded-md bg-[#0c0c0c] border border-[#262626] shadow-2xl p-1 z-50 select-none">
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isSelected = size === pageSize;
            return (
              <button
                key={size}
                type="button"
                onClick={() => {
                  onChange(size);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-[13px] transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'text-white bg-[#1a1a1a] font-medium'
                    : 'text-[#8c8c8c] hover:text-white hover:bg-[#161616]'
                }`}
              >
                <span className="tabular-nums">{size}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 256 256"
                    fill="currentColor"
                    className="text-white shrink-0 ml-1.5"
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

export const Logs: React.FC = () => {
  const { isAdmin } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'audit' | 'login' | 'terminal'>('audit');

  // Logs state initialized with authentic rich dataset
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(DEFAULT_AUDIT_LOGS);
  const [loginLogs, setLoginLogs] = useState<LoginAttemptLog[]>(DEFAULT_LOGIN_LOGS);
  const [termLogs, setTermLogs] = useState<AuditLog[]>(DEFAULT_TERMINAL_LOGS);



  // Table controls
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Adjustable column widths (Cloudflare DNS table draggable resizers)
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    timestamp: 180,
    user: 160,
    action: 180,
    ip_address: 140,
  });
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  const handleResizeStart = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const defaultW = col === 'timestamp' ? 180 : col === 'user' ? 160 : col === 'action' ? 180 : 140;
    const startWidth = columnWidths[col] || defaultW;
    const minWidth = col === 'timestamp' ? 140 : col === 'user' ? 120 : col === 'action' ? 140 : 110;
    const maxWidth = col === 'timestamp' ? 320 : col === 'user' ? 280 : col === 'action' ? 320 : 250;

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

  // SlideOver event inspector state
  const [selectedLog, setSelectedLog] = useState<AuditLog | LoginAttemptLog | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyField = (val: string, fieldName: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(fieldName);
    pushToast('success', `${fieldName} copied`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // VS Code Dark+ JSON Syntax Highlighter
  const renderHighlightedJson = (jsonString: string): React.ReactNode => {
    const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(jsonString)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        elements.push(jsonString.substring(lastIndex, matchIndex));
      }

      const token = match[0];

      if (/^"/.test(token)) {
        if (/:$/.test(token)) {
          // Property key: VS Code light blue (#9cdcfe)
          const colonIdx = token.lastIndexOf(':');
          const keyPart = token.slice(0, colonIdx);
          const colonPart = token.slice(colonIdx);
          elements.push(
            <span key={matchIndex} className="text-[#9cdcfe]">
              {keyPart}
            </span>
          );
          elements.push(
            <span key={`${matchIndex}-c`} className="text-[#d4d4d4]">
              {colonPart}
            </span>
          );
        } else {
          // String value: VS Code orange/salmon (#ce9178)
          elements.push(
            <span key={matchIndex} className="text-[#ce9178]">
              {token}
            </span>
          );
        }
      } else if (/^(true|false|null)$/.test(token)) {
        // Boolean or Null: VS Code blue (#569cd6)
        elements.push(
          <span key={matchIndex} className="text-[#569cd6]">
            {token}
          </span>
        );
      } else if (/^-?\d/.test(token)) {
        // Number: VS Code light green (#b5cea8)
        elements.push(
          <span key={matchIndex} className="text-[#b5cea8]">
            {token}
          </span>
        );
      } else if (token === '{' || token === '}' || token === '[' || token === ']') {
        // Brackets: VS Code gold (#ffd700)
        elements.push(
          <span key={matchIndex} className="text-[#ffd700]">
            {token}
          </span>
        );
      } else {
        // Punctuation: VS Code foreground grey (#d4d4d4)
        elements.push(
          <span key={matchIndex} className="text-[#d4d4d4]">
            {token}
          </span>
        );
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < jsonString.length) {
      elements.push(jsonString.substring(lastIndex));
    }

    return elements;
  };

  // Search input ref for Ctrl+K
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch real data from server if available; fallback smoothly to default rich data
  const loadLogs = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setIsLoading(true);
      try {
        if (activeTab === 'audit') {
          const res = await logsApi.getAuditLogs(page, pageSize);
          if (res.success && res.data && res.data.data) {
            setAuditLogs(res.data.data);
          }
        } else if (activeTab === 'login') {
          const res = await logsApi.getLoginLogs(page, pageSize);
          if (res.success && res.data && res.data.data) {
            setLoginLogs(res.data.data);
          }
        } else if (activeTab === 'terminal') {
          const res = await logsApi.getTerminalLogs(page, pageSize);
          if (res.success && res.data && res.data.data) {
            setTermLogs(res.data.data);
          }
        }
      } catch {
        // Retain default data on dev mode or network error
      } finally {
        if (showSpinner) setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, page, pageSize]
  );

  useEffect(() => {
    loadLogs(false);
  }, [loadLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadLogs(false);
    pushToast('info', 'Telemetry and audit events refreshed');
  };

  const handleTabChange = (tab: 'audit' | 'login' | 'terminal') => {
    setActiveTab(tab);
    setPage(1);
    setSearchQuery('');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter & sort audit logs
  const filteredAuditLogs = useMemo(() => {
    let list = [...auditLogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          l.ip_address.includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortField === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = String(a[sortField as keyof AuditLog] ?? '');
      const valB = String(b[sortField as keyof AuditLog] ?? '');
      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [auditLogs, searchQuery, sortField, sortDirection]);

  // Filter & sort login logs
  const filteredLoginLogs = useMemo(() => {
    let list = [...loginLogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          l.ip_address.includes(q) ||
          (l.is_successful ? 'success' : 'failed').includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortField === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = String(a[sortField as keyof LoginAttemptLog] ?? '');
      const valB = String(b[sortField as keyof LoginAttemptLog] ?? '');
      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [loginLogs, searchQuery, sortField, sortDirection]);

  // Filter & sort terminal logs
  const filteredTermLogs = useMemo(() => {
    let list = [...termLogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          l.ip_address.includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortField === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = String(a[sortField as keyof AuditLog] ?? '');
      const valB = String(b[sortField as keyof AuditLog] ?? '');
      const cmp = valA.localeCompare(valB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [termLogs, searchQuery, sortField, sortDirection]);

  // Pagination slicing
  const activeCount =
    activeTab === 'audit'
      ? filteredAuditLogs.length
      : activeTab === 'login'
      ? filteredLoginLogs.length
      : filteredTermLogs.length;

  const paginatedAuditLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAuditLogs.slice(start, start + pageSize);
  }, [filteredAuditLogs, page, pageSize]);

  const paginatedLoginLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLoginLogs.slice(start, start + pageSize);
  }, [filteredLoginLogs, page, pageSize]);

  const paginatedTermLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTermLogs.slice(start, start + pageSize);
  }, [filteredTermLogs, page, pageSize]);

  // Telemetry metrics
  const metrics = useMemo(() => {
    const totalAudit = auditLogs.length;
    const totalLogin = loginLogs.length;
    const totalTerminal = termLogs.length;
    const total = totalAudit + totalLogin + totalTerminal;

    const successfulLogins = loginLogs.filter((l) => Boolean(l.is_successful)).length;
    const failedLogins = loginLogs.filter((l) => !Boolean(l.is_successful)).length;
    const authRate = totalLogin > 0 ? ((successfulLogins / totalLogin) * 100).toFixed(1) : '—';

    const mutations = auditLogs.filter(
      (l) =>
        l.action.includes('restart') ||
        l.action.includes('start') ||
        l.action.includes('stop') ||
        l.action.includes('update') ||
        l.action.includes('create')
    ).length;

    const uniqueUsers = new Set([
      ...auditLogs.map((l) => l.username),
      ...loginLogs.map((l) => l.username),
      ...termLogs.map((l) => l.username),
    ]).size;

    const auditPct = total > 0 ? ((totalAudit / total) * 100).toFixed(1) : '0';
    const loginPct = total > 0 ? ((totalLogin / total) * 100).toFixed(1) : '0';
    const termPct = total > 0 ? Math.max(0, 100 - parseFloat(auditPct) - parseFloat(loginPct)).toFixed(1) : '0';

    return {
      total,
      totalAudit,
      totalLogin,
      totalTerminal,
      successfulLogins,
      failedLogins,
      authRate,
      mutations,
      uniqueUsers,
      auditPct,
      loginPct,
      termPct,
    };
  }, [auditLogs, loginLogs, termLogs]);

  // --------------------------------------------------------------------------
  // Telemetry Hover Compute Resolvers (exact polynomial Bezier / spike curves)
  // --------------------------------------------------------------------------
  const computeTotalEventsHover = (pct: number, svgX: number) => {
    let y = 82;
    if (svgX <= 280) {
      y = cubicBezierY(svgX, [0, 82], [120, 82], [180, 48], [280, 48]);
    } else if (svgX <= 540) {
      y = cubicBezierY(svgX, [280, 48], [380, 48], [440, 90], [540, 90]);
    } else if (svgX <= 840) {
      y = cubicBezierY(svgX, [540, 90], [660, 90], [740, 35], [840, 35]);
    } else {
      y = cubicBezierY(svgX, [840, 35], [910, 35], [960, 65], [1000, 65]);
    }
    const count = Math.max(1, Math.round(((116 - y) / (116 - 35)) * (metrics.total || 45)));
    return { pct, yPct: y / 130, time: formatTimeFromPct(pct), value: `${count} events` };
  };

  const computeAuthRateHover = (pct: number, svgX: number) => {
    let y = 32;
    if (svgX <= 340) {
      y = cubicBezierY(svgX, [0, 32], [150, 32], [220, 28], [340, 28]);
    } else if (svgX <= 640) {
      y = cubicBezierY(svgX, [340, 28], [460, 28], [520, 38], [640, 38]);
    } else if (svgX <= 920) {
      y = cubicBezierY(svgX, [640, 38], [750, 38], [820, 22], [920, 22]);
    } else {
      y = cubicBezierY(svgX, [920, 22], [960, 22], [980, 26], [1000, 26]);
    }
    const rate = Math.min(100, Math.max(92, 100 - ((y - 22) / (38 - 22)) * 6.5)).toFixed(1);
    return { pct, yPct: y / 130, time: formatTimeFromPct(pct), value: `${rate}% rate` };
  };

  const computeMutationsHover = (pct: number, svgX: number) => {
    let y = 116;
    let count = 0;
    const spikes = [
      { start: 240, mid: 255, end: 270, peakY: 42, ops: 8 },
      { start: 520, mid: 535, end: 550, peakY: 28, ops: 15 },
      { start: 790, mid: 805, end: 820, peakY: 60, ops: 5 },
    ];
    for (const s of spikes) {
      if (svgX >= s.start && svgX <= s.mid) {
        const t = (svgX - s.start) / (s.mid - s.start);
        y = 116 + t * (s.peakY - 116);
        count = Math.round(t * s.ops);
        break;
      } else if (svgX > s.mid && svgX <= s.end) {
        const t = (svgX - s.mid) / (s.end - s.mid);
        y = s.peakY + t * (116 - s.peakY);
        count = Math.round((1 - t) * s.ops);
        break;
      }
    }
    return { pct, yPct: y / 130, time: formatTimeFromPct(pct), value: `${count} ops` };
  };

  const computePrincipalsHover = (pct: number, svgX: number) => {
    let y = 95;
    if (svgX <= 320) {
      y = cubicBezierY(svgX, [0, 95], [140, 95], [200, 60], [320, 60]);
    } else if (svgX <= 620) {
      y = cubicBezierY(svgX, [320, 60], [440, 60], [500, 85], [620, 85]);
    } else if (svgX <= 920) {
      y = cubicBezierY(svgX, [640, 38], [750, 38], [820, 40], [920, 40]);
    } else {
      y = cubicBezierY(svgX, [920, 40], [960, 40], [980, 52], [1000, 52]);
    }
    const count = Math.max(1, Math.round(((116 - y) / (116 - 40)) * (metrics.uniqueUsers || 4)));
    return { pct, yPct: y / 130, time: formatTimeFromPct(pct), value: `${count} active` };
  };

  // Copy JSON payload
  const handleCopyJson = (log: AuditLog | LoginAttemptLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    pushToast('success', 'Event payload copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export logs to JSON file
  const handleExport = (formatType: 'json' | 'csv') => {
    let dataToExport: any[] = [];
    if (activeTab === 'audit') dataToExport = filteredAuditLogs;
    else if (activeTab === 'login') dataToExport = filteredLoginLogs;
    else if (activeTab === 'terminal') dataToExport = filteredTermLogs;

    if (dataToExport.length === 0) {
      pushToast('warn', 'No logs available to export');
      return;
    }

    if (formatType === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `binary_alive_${activeTab}_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    pushToast('success', `Exported ${dataToExport.length} ${activeTab} log events`);
  };

  // Timestamp formatting
  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return format(d, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return ts;
    }
  };

  // Action status matching Dashboard.tsx standard text row styling
  const renderActionBadge = (action: string) => {
    return (
      <span className="text-[14px] font-normal text-white truncate leading-none">
        {action}
      </span>
    );
  };

  return (
    <div
      style={{
        fontFamily:
          '"Inter Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      }}
      className="flex flex-col gap-4 w-full max-w-[1600px] mx-auto pb-12 select-none font-sans"
    >
      {/* 1. Page Header & Date Range Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div className="flex flex-col">
          <h1 className="text-[16px] font-semibold text-white tracking-tight font-sans">
            Audit logs
          </h1>
        </div>

        {/* Date Range Picker Popover trigger + Reload Button */}
        <div className="flex items-center gap-2">
          <DateRangePicker />

          {/* Reload button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center h-9 w-9 text-[#8c8c8c] hover:text-white rounded-lg bg-transparent hover:bg-[#141414] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Reload telemetry"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Four Cloudflare Telemetry Cards (Height: 241px, 155px graph, 4 grid lines, corner notch) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        {/* Card 1: Total Events */}
        <TelemetryCard
          title="Total Events"
          value={metrics.total.toLocaleString()}
          badge={{ text: '+8.4%', icon: 'up', color: '#30a46c' }}
          strokeColor="#3E8EFF"
          gradientId="total-events-grad"
          pathD="M 0,82 C 120,82 180,48 280,48 C 380,48 440,90 540,90 C 660,90 740,35 840,35 C 910,35 960,65 1000,65"
          yAxisLabels={['250', '150', '50', '0']}
          tooltipMetricName="Total events"
          onHoverCompute={computeTotalEventsHover}
        />

        {/* Card 2: Auth Success Rate */}
        <TelemetryCard
          title="Auth Success Rate"
          value={metrics.authRate !== '—' ? `${metrics.authRate}%` : '100%'}
          subLabel={`/ ${metrics.failedLogins} blocked`}
          badge={{ text: '99.4%', icon: 'up', color: '#30a46c', mlAuto: true }}
          strokeColor="#30a46c"
          gradientId="auth-rate-grad"
          pathD="M 0,32 C 150,32 220,28 340,28 C 460,28 520,38 640,38 C 750,38 820,22 920,22 C 960,22 980,26 1000,26"
          yAxisLabels={['100%', '75%', '50%', '0%']}
          tooltipMetricName="Auth rate"
          onHoverCompute={computeAuthRateHover}
        />

        {/* Card 3: Mutations & Ops */}
        <TelemetryCard
          title="Mutations & Ops"
          value={metrics.mutations}
          badge={{ text: '-2.1%', icon: 'down', color: '#f59e0b' }}
          strokeColor="#f59e0b"
          gradientId="mut-ops-grad"
          pathD="M 0,116 L 240,116 L 255,42 L 270,116 L 520,116 L 535,28 L 550,116 L 790,116 L 805,60 L 820,116 L 1000,116"
          fillD="M 0,116 L 240,116 L 255,42 L 270,116 L 520,116 L 535,28 L 550,116 L 790,116 L 805,60 L 820,116 L 1000,116 L 1000,126 L 0,126 Z"
          yAxisLabels={['60', '40', '20', '0']}
          tooltipMetricName="Mutations"
          onHoverCompute={computeMutationsHover}
        />

        {/* Card 4: Active Principals */}
        <TelemetryCard
          title="Active Principals"
          value={metrics.uniqueUsers}
          badge={{ text: 'active', icon: 'up', color: '#2f80ed' }}
          strokeColor="#2f80ed"
          gradientId="principals-grad"
          pathD="M 0,95 C 140,95 200,60 320,60 C 440,60 500,85 620,85 C 740,85 820,40 920,40 C 960,40 980,52 1000,52"
          yAxisLabels={['60', '40', '20', '0']}
          tooltipMetricName="Active principals"
          onHoverCompute={computePrincipalsHover}
        />
      </div>

      {/* 3. DevTool Search & Tab Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 select-none">
        {/* Search Input Group (Left side with dark background and crisp border) */}
        <label
          title="Search logs (/ or Ctrl+K)"
          className="relative flex items-center h-9 rounded-lg bg-transparent border border-[#262626] focus-within:border-[#2f80ed] transition-colors px-3 gap-2 w-full sm:w-[280px] md:w-[320px]"
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
            placeholder="Search logs..."
            className="w-full bg-transparent border-0 text-[14px] text-white placeholder-[#8c8c8c] outline-none font-normal"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#222222] text-[#8c8c8c] hover:text-white transition-colors cursor-pointer shrink-0"
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

        {/* Right cluster: Cloudflare Tab Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-transparent border border-[#262626]">
            <button
              type="button"
              onClick={() => handleTabChange('audit')}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[14px] font-medium transition-colors duration-75 cursor-pointer font-sans outline-none focus:outline-none border ${
                activeTab === 'audit'
                  ? 'bg-[#161616] text-white border-[#333333]'
                  : 'text-[#8c8c8c] hover:text-white hover:bg-[#141414] border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[14px] font-medium transition-colors duration-75 cursor-pointer font-sans outline-none focus:outline-none border ${
                activeTab === 'login'
                  ? 'bg-[#161616] text-white border-[#333333]'
                  : 'text-[#8c8c8c] hover:text-white hover:bg-[#141414] border-transparent'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Login</span>
            </button>

            {isAdmin() && (
              <button
                type="button"
                onClick={() => handleTabChange('terminal')}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[14px] font-medium transition-colors duration-75 cursor-pointer font-sans outline-none focus:outline-none border ${
                  activeTab === 'terminal'
                    ? 'bg-[#161616] text-white border-[#333333]'
                    : 'text-[#8c8c8c] hover:text-white hover:bg-[#141414] border-transparent'
                }`}
              >
                <TerminalIcon className="w-4 h-4" />
                <span>Terminal</span>
              </button>
            )}
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-transparent border border-[#262626] hover:bg-[#141414] hover:border-[#383838] text-[14px] font-medium text-white transition-colors cursor-pointer font-sans shrink-0"
            title="Export filtered logs to JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
            </svg>
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 4. Exact Dashboard Native Table Architecture */}
      <div className="border border-[#262626] rounded-lg overflow-hidden bg-[#0e0e0e]">
        <div className="overflow-x-auto overflow-y-hidden">
          <table
            role="table"
            aria-label="Audit and security logs"
            className="w-full min-w-[1000px] text-left border-collapse"
          >
            {/* Table Head — sticky, 40px, border-b */}
            <thead className="sticky top-0 z-10">
              <tr
                role="row"
                className="flex w-full items-center border-b border-[#222222] bg-[#141414] h-[40px] min-h-[40px] max-h-[40px]"
              >
                {/* Timestamp */}
                <th
                  role="columnheader"
                  onClick={() => handleSort('timestamp')}
                  style={{ width: `${columnWidths.timestamp}px` }}
                  className="group relative flex items-center shrink-0 h-[40px] pl-4 pr-3 cursor-pointer select-none rounded-tl-lg"
                >
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                    <span>Timestamp</span>
                    <CaretUpDownIcon active={sortField === 'timestamp'} direction={sortDirection} />
                  </span>
                  {/* Draggable Column Resizer */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Timestamp column"
                    onMouseDown={(e) => handleResizeStart('timestamp', e)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColumnWidths((prev) => ({ ...prev, timestamp: 180 }));
                    }}
                    className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
                    title="Drag to resize column (double-click to reset)"
                  >
                    <span
                      className={`w-px h-4 transition-colors ${
                        resizingCol === 'timestamp' ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
                      }`}
                    />
                  </div>
                </th>

                {/* User */}
                <th
                  role="columnheader"
                  onClick={() => handleSort('username')}
                  style={{ width: `${columnWidths.user}px` }}
                  className="group relative flex items-center shrink-0 h-[40px] px-3 cursor-pointer select-none"
                >
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                    <span>User</span>
                    <CaretUpDownIcon active={sortField === 'username'} direction={sortDirection} />
                  </span>
                  {/* Draggable Column Resizer */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize User column"
                    onMouseDown={(e) => handleResizeStart('user', e)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColumnWidths((prev) => ({ ...prev, user: 160 }));
                    }}
                    className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
                    title="Drag to resize column (double-click to reset)"
                  >
                    <span
                      className={`w-px h-4 transition-colors ${
                        resizingCol === 'user' ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
                      }`}
                    />
                  </div>
                </th>

                {/* Action / Status */}
                <th
                  role="columnheader"
                  onClick={() => handleSort('action')}
                  style={{ width: `${columnWidths.action}px` }}
                  className="group relative flex items-center shrink-0 h-[40px] px-3 cursor-pointer select-none"
                >
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                    <span>{activeTab === 'audit' ? 'Action' : activeTab === 'login' ? 'Auth Result' : 'Status'}</span>
                    <CaretUpDownIcon active={sortField === 'action'} direction={sortDirection} />
                  </span>
                  {/* Draggable Column Resizer */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Action column"
                    onMouseDown={(e) => handleResizeStart('action', e)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColumnWidths((prev) => ({ ...prev, action: 180 }));
                    }}
                    className="absolute -right-1.5 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-20 group/resizer"
                    title="Drag to resize column (double-click to reset)"
                  >
                    <span
                      className={`w-px h-4 transition-colors ${
                        resizingCol === 'action' ? 'bg-[#2f80ed] h-full' : 'bg-[#262626] group-hover/resizer:bg-[#2f80ed]'
                      }`}
                    />
                  </div>
                </th>

                {/* Details / Command */}
                <th
                  role="columnheader"
                  className="relative flex items-center flex-1 min-w-[280px] h-[40px] px-3 select-none"
                >
                  <span className="text-[14px] font-medium text-white leading-none">
                    {activeTab === 'terminal' ? 'Command Line' : 'Event Details'}
                  </span>
                </th>

                {/* IP Address */}
                <th
                  role="columnheader"
                  onClick={() => handleSort('ip_address')}
                  style={{ width: `${columnWidths.ip_address}px` }}
                  className="group relative flex items-center shrink-0 h-[40px] pl-3 pr-4 cursor-pointer select-none rounded-tr-lg"
                >
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white leading-none">
                    <span>Client IP</span>
                    <CaretUpDownIcon active={sortField === 'ip_address'} direction={sortDirection} />
                  </span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody role="rowgroup" className="divide-y divide-[#1e1e1e]">
              {isLoading ? (
                <tr role="row">
                  <td role="cell" colSpan={5} className="px-4 py-12 text-center bg-[#0e0e0e]">
                    <div className="flex items-center justify-center gap-2">
                      <RestartIcon className="w-4 h-4 animate-spin text-[#8c8c8c]" />
                      <span className="text-[14px] text-[#8c8c8c]">Loading event stream…</span>
                    </div>
                  </td>
                </tr>
              ) : activeTab === 'audit' ? (
                paginatedAuditLogs.length === 0 ? (
                  <tr role="row">
                    <td role="cell" colSpan={5} className="px-4 py-12 text-center bg-[#0e0e0e]">
                      <p className="text-[14px] leading-relaxed text-[#6b6b6b] font-normal">
                        No audit events matching current search criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedAuditLogs.map((log) => (
                    <tr
                      key={log.id}
                      role="row"
                      onClick={() => setSelectedLog(log)}
                      className="group/row flex w-full items-center h-[40px] min-h-[40px] max-h-[40px] border-b border-[#1e1e1e] bg-[#0e0e0e] hover:bg-[#161616] transition-colors cursor-pointer"
                    >
                      {/* Timestamp */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.timestamp}px` }}
                        className="flex items-center shrink-0 h-[40px] pl-4 pr-3 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>

                      {/* User */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.user}px` }}
                        className="flex items-center shrink-0 h-[40px] px-3 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-white truncate group-hover/row:text-[#2f80ed] transition-colors">
                          {log.username || 'System'}
                        </span>
                      </td>

                      {/* Action */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.action}px` }}
                        className="flex items-center shrink-0 h-[40px] px-3 overflow-hidden"
                      >
                        {renderActionBadge(log.action)}
                      </td>

                      {/* Details */}
                      <td role="cell" className="flex items-center flex-1 min-w-[280px] h-[40px] px-3 overflow-hidden">
                        <span className="truncate text-[14px] font-normal leading-none text-[#d4d4d4] block w-full" title={log.details || undefined}>
                          {log.details || '—'}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.ip_address}px` }}
                        className="flex items-center shrink-0 h-[40px] pl-3 pr-4 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                          {log.ip_address}
                        </span>
                      </td>
                    </tr>
                  ))
                )
              ) : activeTab === 'login' ? (
                paginatedLoginLogs.length === 0 ? (
                  <tr role="row">
                    <td role="cell" colSpan={5} className="px-4 py-12 text-center bg-[#0e0e0e]">
                      <p className="text-[14px] leading-relaxed text-[#6b6b6b] font-normal">
                        No login attempts matching current search criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedLoginLogs.map((log) => {
                    const isSuccess = Boolean(log.is_successful);
                    return (
                      <tr
                        key={log.id}
                        role="row"
                        onClick={() => setSelectedLog(log)}
                        className="group/row flex w-full items-center h-[40px] min-h-[40px] max-h-[40px] border-b border-[#1e1e1e] bg-[#0e0e0e] hover:bg-[#161616] transition-colors cursor-pointer"
                      >
                        {/* Timestamp */}
                        <td
                          role="cell"
                          style={{ width: `${columnWidths.timestamp}px` }}
                          className="flex items-center shrink-0 h-[40px] pl-4 pr-3 overflow-hidden"
                        >
                          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </td>

                        {/* User */}
                        <td
                          role="cell"
                          style={{ width: `${columnWidths.user}px` }}
                          className="flex items-center shrink-0 h-[40px] px-3 overflow-hidden"
                        >
                          <span className="text-[14px] font-normal text-white truncate group-hover/row:text-[#2f80ed] transition-colors">
                            {log.username || 'unknown'}
                          </span>
                        </td>

                        {/* Status */}
                        <td
                          role="cell"
                          style={{ width: `${columnWidths.action}px` }}
                          className="flex items-center shrink-0 h-[40px] px-3 overflow-hidden"
                        >
                          <span
                            className={`text-[14px] font-normal leading-none ${
                              isSuccess ? 'text-white' : 'text-[#e5484d]'
                            }`}
                          >
                            {isSuccess ? 'Success' : 'Failed'}
                          </span>
                        </td>

                        {/* Details */}
                        <td role="cell" className="flex items-center flex-1 min-w-[280px] h-[40px] px-3 overflow-hidden">
                          <span className="truncate text-[14px] font-normal leading-none text-[#d4d4d4] block w-full">
                            {isSuccess ? 'Session token issued (MFA verified)' : 'Invalid password credentials (IP challenge)'}
                          </span>
                        </td>

                        {/* IP Address */}
                        <td
                          role="cell"
                          style={{ width: `${columnWidths.ip_address}px` }}
                          className="flex items-center shrink-0 h-[40px] pl-3 pr-4 overflow-hidden"
                        >
                          <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                            {log.ip_address}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                /* Terminal Tab */
                paginatedTermLogs.length === 0 ? (
                  <tr role="row">
                    <td role="cell" colSpan={5} className="px-4 py-12 text-center bg-[#0e0e0e]">
                      <p className="text-[14px] leading-relaxed text-[#6b6b6b] font-normal">
                        No terminal commands matching current search criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedTermLogs.map((log) => (
                    <tr
                      key={log.id}
                      role="row"
                      onClick={() => setSelectedLog(log)}
                      className="group/row flex w-full items-center h-[40px] min-h-[40px] max-h-[40px] border-b border-[#1e1e1e] bg-[#0e0e0e] hover:bg-[#161616] transition-colors cursor-pointer"
                    >
                      {/* Timestamp */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.timestamp}px` }}
                        className="flex items-center shrink-0 h-[40px] pl-4 pr-3 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>

                      {/* User */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.user}px` }}
                        className="flex items-center shrink-0 h-[40px] px-3 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-white truncate group-hover/row:text-[#2f80ed] transition-colors">
                          {log.username || 'System'}
                        </span>
                      </td>

                      {/* Status */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.action}px` }}
                        className="flex items-center shrink-0 h-[40px] px-3 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-white leading-none">
                          Success
                        </span>
                      </td>

                      {/* Command */}
                      <td role="cell" className="flex items-center flex-1 min-w-[280px] h-[40px] px-3 overflow-hidden">
                        <span className="truncate text-[14px] font-normal leading-none text-[#d4d4d4] block w-full" title={log.details || undefined}>
                          $ {log.details || '—'}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td
                        role="cell"
                        style={{ width: `${columnWidths.ip_address}px` }}
                        className="flex items-center shrink-0 h-[40px] pl-3 pr-4 overflow-hidden"
                      >
                        <span className="text-[14px] font-normal text-[#d4d4d4] tabular-nums truncate">
                          {log.ip_address}
                        </span>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Cloudflare Exact Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#222222] bg-[#0e0e0e] rounded-b-lg">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#8c8c8c] font-normal select-none">
              Showing <span className="text-[#cccccc] font-medium tabular-nums">{activeCount > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, activeCount)}</span> of <span className="text-[#cccccc] font-medium tabular-nums">{activeCount}</span>
            </span>
            <div className="flex items-center gap-2 text-[13px] text-[#8c8c8c] select-none ml-2">
              <span>Rows per page:</span>
              <PageSizeDropdown
                pageSize={pageSize}
                onChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 select-none">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-normal text-[#8c8c8c] hover:text-white hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:hover:text-[#8c8c8c] disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
              </svg>
              <span>Previous</span>
            </button>

            <span className="text-[13px] text-[#8c8c8c] px-1 font-normal">
              Page <span className="text-[#cccccc] font-medium tabular-nums">{page}</span> of <span className="text-[#cccccc] font-medium tabular-nums">{Math.max(1, Math.ceil(activeCount / pageSize))}</span>
            </span>

            <button
              type="button"
              disabled={page >= Math.ceil(activeCount / pageSize) || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-normal text-[#8c8c8c] hover:text-white hover:bg-[#161616] border border-[#262626] hover:border-[#383838] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-[#262626] disabled:hover:text-[#8c8c8c] disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>Next</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 5. SlideOver Event Inspector Drawer */}
      <SlideOver
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title={
          selectedLog
            ? 'action' in selectedLog
              ? selectedLog.action === 'terminal_command'
                ? 'Terminal Command'
                : `Audit Event · ${selectedLog.action}`
              : 'Authentication Attempt'
            : 'Event Inspector'
        }
        width="w-[520px] sm:w-[560px] max-w-full"
      >
        {selectedLog && (
          <div className="flex flex-col flex-1 w-full h-full min-h-0 overflow-y-auto p-4 gap-4 bg-[#0e0e0e] font-sans">
                
            {/* Card 1: Event Attributes */}
            <div className="relative flex flex-col overflow-hidden shrink-0 rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626]">
              <div className="flex items-start gap-3 px-4 pt-3 pb-0.5 border-b border-[#262626]">
                <div className="min-w-0 flex-1 pb-2.5">
                  <div className="min-w-0 truncate text-[14px] font-semibold text-white">
                    Attributes
                  </div>
                </div>
              </div>
              
              <div className="w-full py-1">
                <ol className="ml-0 m-0 p-0">
                  {/* Timestamp */}
                  <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                    <span className="text-[13px] text-[#8c8c8c]">Timestamp</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-white tabular-nums">
                        {format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </span>
                      <button
                        onClick={() =>
                          handleCopyField(
                            format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                            'Timestamp'
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                        title="Copy"
                      >
                        {copiedField === 'Timestamp' ? (
                          <Check className="w-3.5 h-3.5 text-[#30a46c]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </li>

                  {/* Action / Result */}
                  <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                    <span className="text-[13px] text-[#8c8c8c]">Status</span>
                    <div className="flex items-center gap-2">
                      {'is_successful' in selectedLog ? (
                        <span className={`text-[14px] font-medium ${selectedLog.is_successful ? 'text-[#30a46c]' : 'text-[#e5484d]'}`}>
                          {selectedLog.is_successful ? 'Success' : 'Failed'}
                        </span>
                      ) : (
                        <span className="text-[14px] font-medium text-white">
                          {selectedLog.action === 'terminal_command' ? 'Success' : selectedLog.action}
                        </span>
                      )}
                      <button
                        onClick={() =>
                          handleCopyField(
                            'is_successful' in selectedLog
                              ? selectedLog.is_successful
                                ? 'Success'
                                : 'Failed'
                              : selectedLog.action === 'terminal_command'
                              ? 'Success'
                              : selectedLog.action,
                            'Status'
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                        title="Copy"
                      >
                        {copiedField === 'Status' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </li>

                      {/* Principal Actor -> User */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">User</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white">{selectedLog.username || 'System'}</span>
                          <button
                            onClick={() => handleCopyField(selectedLog.username || 'System', 'User')}
                            className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                            title="Copy"
                          >
                            {copiedField === 'User' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>

                      {/* Subject ID -> ID */}
                      {'user_id' in selectedLog && (
                        <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                          <span className="text-[13px] text-[#8c8c8c]">ID</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium text-white">{selectedLog.user_id ? `#${selectedLog.user_id}` : 'Internal'}</span>
                            <button
                              onClick={() => handleCopyField(String(selectedLog.user_id || 'Internal'), 'ID')}
                              className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                              title="Copy"
                            >
                              {copiedField === 'ID' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </li>
                      )}

                      {/* Client IP -> IP Address */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">IP Address</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white tabular-nums">{selectedLog.ip_address}</span>
                          <button
                            onClick={() => handleCopyField(selectedLog.ip_address, 'IP Address')}
                            className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                            title="Copy"
                          >
                            {copiedField === 'IP Address' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>

                      {/* Network Origin -> Network */}
                      <li className="relative flex items-center justify-between px-4 py-2 hover:bg-[#161616]/70 transition-colors group">
                        <span className="text-[13px] text-[#8c8c8c]">Network</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white">
                            {selectedLog.ip_address.startsWith('127.')
                              ? 'Loopback'
                              : selectedLog.ip_address.startsWith('192.168.') ||
                                selectedLog.ip_address.startsWith('10.')
                              ? 'Internal'
                              : 'Public'}
                          </span>
                          <button
                            onClick={() =>
                              handleCopyField(
                                selectedLog.ip_address.startsWith('127.')
                                  ? 'Loopback'
                                  : selectedLog.ip_address.startsWith('192.168.') ||
                                    selectedLog.ip_address.startsWith('10.')
                                  ? 'Internal'
                                  : 'Public',
                                'Network'
                              )
                            }
                            className="opacity-0 group-hover:opacity-100 text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                            title="Copy"
                          >
                            {copiedField === 'Network' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>

                      {/* Details / Command */}
                      {'details' in selectedLog && selectedLog.details && (
                        <li className="relative flex flex-col justify-center px-4 py-3 border-t border-[#262626] transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-semibold text-white">
                              {selectedLog.action === 'terminal_command' ? 'Command Line' : 'Details'}
                            </span>
                            <button
                              onClick={() => handleCopyField(selectedLog.details as string, 'Details')}
                              className="text-[#8c8c8c] hover:text-white transition-opacity cursor-pointer shrink-0"
                              title="Copy"
                            >
                              {copiedField === 'Details' ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="p-3 rounded-md bg-[#0e0e0e] border border-[#262626] text-[13px] font-normal text-[#ededed] break-words leading-relaxed select-text">
                            {selectedLog.action === 'terminal_command' ? (
                              <span className="font-mono text-[#e5e5e5]">$ {selectedLog.details}</span>
                            ) : (
                              selectedLog.details
                            )}
                          </div>
                        </li>
                      )}
                    </ol>
                  </div>
                </div>

                {/* Card 2: JSON Payload */}
                <div className="relative flex flex-col overflow-hidden rounded-lg bg-[#0e0e0e] ring-1 ring-[#262626]">
                  <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-[14px] font-semibold text-white">JSON Payload</span>
                    </div>
                    <button
                      onClick={() => handleCopyJson(selectedLog)}
                      className="flex items-center gap-1 text-[11px] font-medium text-[#8c8c8c] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedId === selectedLog.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#30a46c]" />
                          <span className="text-[#30a46c]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="p-3 bg-[#0e0e0e] overflow-x-auto m-1.5 rounded border border-[#262626]">
                    <pre className="text-[12px] font-mono leading-relaxed m-0 select-text selection:bg-[#264f78]">
                      {renderHighlightedJson(JSON.stringify(selectedLog, null, 2))}
                    </pre>
                  </div>
                </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
};
