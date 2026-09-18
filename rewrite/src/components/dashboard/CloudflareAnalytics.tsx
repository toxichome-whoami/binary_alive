import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import type { Process } from '../../types';
import { SlideOver } from '../ui/SlideOver';
import { DateRangePicker } from '../shared/DateRangePicker';

interface CloudflareAnalyticsProps {
  runningCount: number;
  stoppedCount: number;
  totalCount: number;
  sysLoad: string | number;
  restartsCount: number;
  processes?: Process[];
  onRefresh: () => void;
  isLoading?: boolean;
}

// Exact wavy SVG path extracted from Cloudflare conter.html
const WAVY_NO_DATA_PATH =
  'M0.00,54.82 L6.67,53.35 L13.33,55.07 L20.00,57.95 L26.67,60.06 L33.33,60.51 L40.00,59.77 L46.67,59.19 L53.33,60.07 L60.00,62.86 L66.67,66.84 L73.33,70.51 L80.00,72.48 L86.67,72.25 L93.33,70.57 L100.00,69.07 L106.67,69.27 L113.33,71.71 L120.00,75.41 L126.67,78.20 L133.33,77.76 L140.00,72.80 L146.67,63.93 L153.33,53.59 L160.00,45.16 L166.67,41.60 L173.33,44.14 L180.00,51.81 L186.67,61.85 L193.33,70.97 L200.00,76.66 L206.67,78.13 L213.33,76.41 L220.00,73.53 L226.67,71.42 L233.33,70.97 L240.00,71.71 L246.67,72.29 L253.33,71.41 L260.00,68.62 L266.67,64.64 L273.33,60.97 L280.00,59.00 L286.67,59.23 L293.33,60.91 L300.00,62.41 L306.67,62.21 L313.33,59.77 L320.00,56.07 L326.67,53.28 L333.33,53.72 L340.00,58.68 L346.67,67.55 L353.33,77.89 L360.00,86.32 L366.67,89.88 L373.33,87.34 L380.00,79.67 L386.67,69.63 L393.33,60.51 L400.00,54.82';

interface NoDataWavyChartProps {
  id: string;
  heightClass?: string;
}

export const NoDataWavyChart: React.FC<NoDataWavyChartProps> = ({
  id,
  heightClass = 'h-[160px]',
}) => (
  <div className={`relative w-full ${heightClass} mt-auto flex items-end justify-center overflow-hidden`}>
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 400 173"
      preserveAspectRatio="none"
      className="block w-full h-full"
    >
      <defs>
        {/* Exact Cloudflare linearGradient fill under the wavy line */}
        <linearGradient id={`kumo-chart-nodata-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C5C5C" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#5C5C5C" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area gradient under the wavy curve spanning edge-to-edge and touching bottom */}
      <path
        d={`${WAVY_NO_DATA_PATH} L400,173 L0,173 Z`}
        fill={`url(#kumo-chart-nodata-fill-${id})`}
        stroke="none"
      />
      {/* Wavy line stroke starting at x=0 and ending at x=400 */}
      <path
        d={WAVY_NO_DATA_PATH}
        fill="none"
        stroke="#5C5C5C"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
    {/* Floating "No data" pill matching Cloudflare styling */}
    <div className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#141414] px-2.5 py-0.5 text-xs font-medium text-[#8c8c8c] border border-[#262626]">
      No data
    </div>
    {/* Resize handle notch */}
    <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
        <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
      </svg>
    </span>
  </div>
);

export const CloudflareAnalytics: React.FC<CloudflareAnalyticsProps> = ({
  runningCount,
  stoppedCount,
  totalCount,
  sysLoad,
  restartsCount,
  processes = [],
  onRefresh,
  isLoading = false,
}) => {
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('Last 24 hours');

  // Total memory used by running processes (in MB)
  const totalMemoryMB = useMemo(() => {
    if (!processes || processes.length === 0) return 208;
    return processes.reduce((acc, p) => {
      if (p.status === 'running' && p.mem) {
        const num = parseFloat(p.mem);
        if (!isNaN(num)) {
          if (p.mem.toLowerCase().includes('gb')) return acc + num * 1024;
          return acc + num;
        }
      }
      return acc;
    }, 0);
  }, [processes]);
  // Aggregate CPU utilization across all running processes
  const totalCpuPercent = useMemo(() => {
    if (!processes || processes.length === 0) return 14.2;
    const sum = processes.reduce((acc, p) => {
      if (p.status === 'running' && p.cpu !== undefined) {
        const val = typeof p.cpu === 'number' ? p.cpu : parseFloat(String(p.cpu).replace('%', ''));
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);
    return sum > 0 ? parseFloat(sum.toFixed(1)) : 14.2;
  }, [processes]);

  // Demo / Real values fallback
  const displayRunning = runningCount > 0 ? runningCount : 7;
  const displayStopped = stoppedCount > 0 ? stoppedCount : 2;
  const displayMemory =
    totalMemoryMB > 0 && totalMemoryMB !== 208
      ? totalMemoryMB >= 1024
        ? `${(totalMemoryMB / 1024).toFixed(2)} GB`
        : `${Math.round(totalMemoryMB)} MB`
      : '486 MB';
  const displaySysLoad = sysLoad !== '---' && sysLoad !== 0 ? sysLoad : '0.28';
  const displayRestarts = restartsCount > 0 ? restartsCount : 2;
  const displayCpu = `${totalCpuPercent}%`;

  // Right-side SlideOver Telemetry Drawer State
  const [selectedMetric, setSelectedMetric] = useState<
    'cpu' | 'active' | 'memory' | 'load' | 'restarts' | 'uptime' | null
  >(null);
  const [drawerSearch, setDrawerSearch] = useState('');

  // Memory & CPU parse utilities
  const parseMemMB = (memStr: string | undefined): number => {
    if (!memStr) return 0;
    const num = parseFloat(memStr);
    if (isNaN(num)) return 0;
    if (memStr.toLowerCase().includes('gb')) return num * 1024;
    return num;
  };

  const parseCpuVal = (cpuVal: string | number | undefined): number => {
    if (cpuVal === undefined || cpuVal === null) return 0;
    const val = typeof cpuVal === 'number' ? cpuVal : parseFloat(String(cpuVal).replace('%', ''));
    return isNaN(val) ? 0 : val;
  };

  // Fallback realistic process telemetry pool when processes prop is empty
  const activeProcessesList = useMemo(() => {
    if (processes && processes.length > 0) return processes;
    return [
      { id: 1, name: 'api-server', group_name: 'backend', command: 'node dist/index.js', working_dir: '/var/www/api', log_file: 'api.log', status: 'running', pid: 4821, cpu: 5.4, mem: '124.6 MB', uptime: '4d 12h', restart_count: 0, auto_restart: true },
      { id: 2, name: 'worker-queue', group_name: 'jobs', command: 'python worker.py', working_dir: '/var/www/jobs', log_file: 'worker.log', status: 'running', pid: 4892, cpu: 3.8, mem: '88.2 MB', uptime: '4d 12h', restart_count: 1, auto_restart: true },
      { id: 3, name: 'redis-cache', group_name: 'infra', command: 'redis-server /etc/redis.conf', working_dir: '/etc/redis', log_file: 'redis.log', status: 'running', pid: 1042, cpu: 1.2, mem: '64.0 MB', uptime: '12d 8h', restart_count: 0, auto_restart: true },
      { id: 4, name: 'cron-scheduler', group_name: 'jobs', command: 'python scheduler.py', working_dir: '/var/www/jobs', log_file: 'cron.log', status: 'running', pid: 5120, cpu: 0.8, mem: '42.1 MB', uptime: '2d 6h', restart_count: 0, auto_restart: true },
      { id: 5, name: 'metrics-agent', group_name: 'telemetry', command: './telegraf --config telegraf.conf', working_dir: '/etc/telegraf', log_file: 'agent.log', status: 'running', pid: 5310, cpu: 0.5, mem: '32.4 MB', uptime: '18d 4h', restart_count: 0, auto_restart: true },
      { id: 6, name: 'auth-service', group_name: 'backend', command: 'go run main.go', working_dir: '/var/www/auth', log_file: 'auth.log', status: 'running', pid: 5402, cpu: 1.9, mem: '78.5 MB', uptime: '3d 1h', restart_count: 1, auto_restart: true },
      { id: 7, name: 'web-gateway', group_name: 'ingress', command: 'caddy run', working_dir: '/etc/caddy', log_file: 'caddy.log', status: 'running', pid: 3201, cpu: 0.6, mem: '56.2 MB', uptime: '9d 14h', restart_count: 0, auto_restart: true },
      { id: 8, name: 'backup-sync', group_name: 'maintenance', command: 'rclone sync /data s3:backup', working_dir: '/root', log_file: 'backup.log', status: 'stopped', pid: null, cpu: 0, mem: '0 MB', uptime: 'Stopped', restart_count: 0, auto_restart: false },
      { id: 9, name: 'log-shipper', group_name: 'telemetry', command: 'fluent-bit -c fluent-bit.conf', working_dir: '/etc/fluent-bit', log_file: 'shipper.log', status: 'stopped', pid: null, cpu: 0, mem: '0 MB', uptime: 'Stopped', restart_count: 2, auto_restart: false },
    ] as Process[];
  }, [processes]);

  // Filtered & sorted process list based on active metric & search query
  const filteredProcesses = useMemo(() => {
    let list = [...activeProcessesList];
    if (drawerSearch.trim()) {
      const q = drawerSearch.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.group_name && p.group_name.toLowerCase().includes(q)) ||
          (p.pid && String(p.pid).includes(q)) ||
          p.command.toLowerCase().includes(q)
      );
    }

    if (!selectedMetric) return list;

    switch (selectedMetric) {
      case 'cpu':
        return list.sort((a, b) => parseCpuVal(b.cpu) - parseCpuVal(a.cpu));
      case 'memory':
        return list.sort((a, b) => parseMemMB(b.mem) - parseMemMB(a.mem));
      case 'restarts':
        return list.sort((a, b) => (b.restart_count || 0) - (a.restart_count || 0));
      case 'active':
        return list.sort((a, b) => {
          if (a.status === 'running' && b.status !== 'running') return -1;
          if (a.status !== 'running' && b.status === 'running') return 1;
          return (a.pid || 0) - (b.pid || 0);
        });
      case 'load':
        return list.sort((a, b) => {
          const loadA = parseCpuVal(a.cpu) + parseMemMB(a.mem) / 20;
          const loadB = parseCpuVal(b.cpu) + parseMemMB(b.mem) / 20;
          return loadB - loadA;
        });
      case 'uptime':
        return list.sort((a, b) => {
          if (a.status === 'running' && b.status !== 'running') return -1;
          if (a.status !== 'running' && b.status === 'running') return 1;
          return 0;
        });
      default:
        return list;
    }
  }, [activeProcessesList, drawerSearch, selectedMetric]);

  const METRIC_TABS: {
    id: 'cpu' | 'active' | 'memory' | 'load' | 'restarts' | 'uptime';
    label: string;
  }[] = [
    { id: 'cpu', label: 'CPU' },
    { id: 'active', label: 'Processes' },
    { id: 'memory', label: 'Memory' },
    { id: 'load', label: 'Load' },
    { id: 'restarts', label: 'Restarts' },
    { id: 'uptime', label: 'Uptime' },
  ];

  const METRIC_META: Record<
    'cpu' | 'active' | 'memory' | 'load' | 'restarts' | 'uptime',
    { title: string; subtitle: string; badge: string }
  > = {
    cpu: {
      title: 'CPU Utilization',
      subtitle: 'Processor telemetry & per-process thread allocation',
      badge: 'Compute',
    },
    active: {
      title: 'Active Processes',
      subtitle: 'Service health & lifecycle distribution across instances',
      badge: 'Lifecycle',
    },
    memory: {
      title: 'Memory Usage',
      subtitle: 'Resident Set Size (RSS) memory consumption footprint',
      badge: 'Memory',
    },
    load: {
      title: 'System Load',
      subtitle: 'Normalized execution queues and thread saturation',
      badge: 'System',
    },
    restarts: {
      title: 'Process Restarts',
      subtitle: 'Crash statistics, restart counters & auto-recovery policies',
      badge: 'Reliability',
    },
    uptime: {
      title: 'Average Uptime',
      subtitle: 'Continuous availability, SLA timeline & service uptime',
      badge: 'Availability',
    },
  };

  // Helper to format timestamp from horizontal percentage
  const formatTimeFromPct = (pct: number) => {
    const now = new Date();
    const pointTime = new Date(now.getTime() - (1 - pct) * 24 * 60 * 60 * 1000);
    const day = pointTime.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[pointTime.getMonth()];
    const hh = String(pointTime.getHours()).padStart(2, '0');
    const mm = String(pointTime.getMinutes()).padStart(2, '0');
    const ss = String(pointTime.getSeconds()).padStart(2, '0');
    return `${day} ${month}, ${hh}:${mm}:${ss}`;
  };

  // Normalized Hover State Interface for smooth, non-distorted tracking
  interface CardHoverData {
    pct: number;
    yPct: number;
    time: string;
    value: string;
  }

  // Helper for finding Y on a cubic bezier segment with horizontal monotonicity
  const cubicBezierY = (
    targetX: number,
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number]
  ): number => {
    let low = 0;
    let high = 1;
    let t = 0.5;
    for (let i = 0; i < 14; i++) {
      const cx = 3 * (p1[0] - p0[0]);
      const bx = 3 * (p2[0] - p1[0]) - cx;
      const ax = p3[0] - p0[0] - cx - bx;
      const curX = ((ax * t + bx) * t + cx) * t + p0[0];
      if (curX < targetX) {
        low = t;
      } else {
        high = t;
      }
      t = (low + high) / 2;
    }
    const cy = 3 * (p1[1] - p0[1]);
    const by = 3 * (p2[1] - p1[1]) - cy;
    const ay = p3[1] - p0[1] - cy - by;
    return ((ay * t + by) * t + cy) * t + p0[1];
  };

  // 1. CPU Hover State - Precisely tracks SVG line
  // Path: M 0,116 L 555,116 L 580,24 L 605,116 L 700,116 L 720,68 L 740,116 L 1000,116
  const [cpuHover, setCpuHover] = useState<CardHoverData | null>(null);
  const handleCpuMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const svgX = pct * 1000;
    const timeStr = formatTimeFromPct(pct);

    let y = 116;
    let val = 0.0;
    if (svgX >= 555 && svgX <= 580) {
      const t = (svgX - 555) / (580 - 555);
      y = 116 + t * (24 - 116);
      val = t * 24.2;
    } else if (svgX > 580 && svgX <= 605) {
      const t = (svgX - 580) / (605 - 580);
      y = 24 + t * (116 - 24);
      val = (1 - t) * 24.2;
    } else if (svgX >= 700 && svgX <= 720) {
      const t = (svgX - 700) / (720 - 700);
      y = 116 + t * (68 - 116);
      val = t * 11.5;
    } else if (svgX > 720 && svgX <= 740) {
      const t = (svgX - 720) / (740 - 720);
      y = 68 + t * (116 - 68);
      val = (1 - t) * 11.5;
    }

    setCpuHover({ pct, yPct: y / 130, time: timeStr, value: `${val.toFixed(1)}%` });
  };

  // 2. Active Processes Hover State
  // Path: M 0,31 L 380,31 L 400,48 L 480,48 L 500,31 L 1000,31
  const [activeHover, setActiveHover] = useState<CardHoverData | null>(null);
  const handleActiveMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const svgX = pct * 1000;
    const timeStr = formatTimeFromPct(pct);

    let y = 31;
    let count = displayRunning;
    if (svgX >= 380 && svgX <= 400) {
      const t = (svgX - 380) / (400 - 380);
      y = 31 + t * (48 - 31);
      count = t > 0.5 ? Math.max(1, displayRunning - 1) : displayRunning;
    } else if (svgX > 400 && svgX <= 480) {
      y = 48;
      count = Math.max(1, displayRunning - 1);
    } else if (svgX > 480 && svgX <= 500) {
      const t = (svgX - 480) / (500 - 480);
      y = 48 + t * (31 - 48);
      count = t > 0.5 ? displayRunning : Math.max(1, displayRunning - 1);
    }

    setActiveHover({ pct, yPct: y / 130, time: timeStr, value: `${count} active` });
  };

  // 3. Memory Usage Hover State
  // Path: M 0,116 L 110,116 L 120,85 L 130,116 L 270,116 L 280,65 L 290,116 L 468,116 L 480,16 L 492,116 L 610,116 L 620,45 L 630,116 L 770,116 L 780,75 L 790,116 L 890,116 L 900,55 L 910,116 L 1000,116
  const [memoryHover, setMemoryHover] = useState<CardHoverData | null>(null);
  const handleMemoryMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const svgX = pct * 1000;
    const timeStr = formatTimeFromPct(pct);

    let y = 116;
    let val = '0 MB';
    const spikes = [
      { start: 110, mid: 120, end: 130, topY: 85, val: 86 },
      { start: 270, mid: 280, end: 290, topY: 65, val: 124 },
      { start: 468, mid: 480, end: 492, topY: 16, val: 486 },
      { start: 610, mid: 620, end: 630, topY: 45, val: 312 },
      { start: 770, mid: 780, end: 790, topY: 75, val: 98 },
      { start: 890, mid: 900, end: 910, topY: 55, val: 245 },
    ];
    for (const s of spikes) {
      if (svgX >= s.start && svgX <= s.mid) {
        const t = (svgX - s.start) / (s.mid - s.start);
        y = 116 + t * (s.topY - 116);
        val = `${Math.round(t * s.val)} MB`;
        break;
      } else if (svgX > s.mid && svgX <= s.end) {
        const t = (svgX - s.mid) / (s.end - s.mid);
        y = s.topY + t * (116 - s.topY);
        val = `${Math.round((1 - t) * s.val)} MB`;
        break;
      }
    }

    setMemoryHover({ pct, yPct: y / 130, time: timeStr, value: val });
  };

  // 4. System Load Hover State
  // Path: M 0,82 C 120,82 180,65 280,65 C 380,65 440,100 540,100 C 660,100 740,60 840,60 C 910,60 960,80 1000,80
  const [sysLoadHover, setSysLoadHover] = useState<CardHoverData | null>(null);
  const handleSysLoadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const svgX = pct * 1000;
    const timeStr = formatTimeFromPct(pct);

    let y = 82;
    if (svgX <= 280) {
      y = cubicBezierY(svgX, [0, 82], [120, 82], [180, 65], [280, 65]);
    } else if (svgX <= 540) {
      y = cubicBezierY(svgX, [280, 65], [380, 65], [440, 100], [540, 100]);
    } else if (svgX <= 840) {
      y = cubicBezierY(svgX, [540, 100], [660, 100], [740, 60], [840, 60]);
    } else {
      y = cubicBezierY(svgX, [840, 60], [910, 60], [960, 80], [1000, 80]);
    }
    const loadVal = Math.max(0.12, ((116 - y) / (116 - 14)) * 0.95 + 0.05).toFixed(2);

    setSysLoadHover({ pct, yPct: y / 130, time: timeStr, value: loadVal });
  };

  // 5. Process Restarts Hover State
  // Path: M 0,116 L 335,116 L 350,56 L 365,116 L 665,116 L 680,56 L 695,116 L 1000,116
  const [restartsHover, setRestartsHover] = useState<CardHoverData | null>(null);
  const handleRestartsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const svgX = pct * 1000;
    const timeStr = formatTimeFromPct(pct);

    let y = 116;
    let val = '0 restarts';
    if (svgX >= 335 && svgX <= 350) {
      const t = (svgX - 335) / (350 - 335);
      y = 116 + t * (56 - 116);
      val = '1 (axiom reload)';
    } else if (svgX > 350 && svgX <= 365) {
      const t = (svgX - 350) / (365 - 350);
      y = 56 + t * (116 - 56);
      val = '1 (axiom reload)';
    } else if (svgX >= 665 && svgX <= 680) {
      const t = (svgX - 665) / (680 - 665);
      y = 116 + t * (56 - 116);
      val = '1 (mail worker reload)';
    } else if (svgX > 680 && svgX <= 695) {
      const t = (svgX - 680) / (695 - 680);
      y = 56 + t * (116 - 56);
      val = '1 (mail worker reload)';
    }

    setRestartsHover({ pct, yPct: y / 130, time: timeStr, value: val });
  };

  // 6. Avg. Uptime Hover State
  // Path: M 0,20 L 380,20 C 400,20 415,65 430,65 C 445,65 460,20 480,20 L 880,20 L 900,14 L 1000,14
  const [uptimeHover, setUptimeHover] = useState<CardHoverData | null>(null);
  const handleUptimeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const svgX = pct * 1000;
    const timeStr = formatTimeFromPct(pct);

    let y = 20;
    let val = '99.98%';
    if (svgX < 380) {
      y = 20;
      val = '99.98%';
    } else if (svgX <= 430) {
      y = cubicBezierY(svgX, [380, 20], [400, 20], [415, 65], [430, 65]);
      const dip = (y - 20) / (65 - 20);
      val = `${(99.98 - dip * 0.48).toFixed(2)}%`;
    } else if (svgX <= 480) {
      y = cubicBezierY(svgX, [430, 65], [445, 65], [460, 20], [480, 20]);
      const dip = (y - 20) / (65 - 20);
      val = `${(99.98 - dip * 0.48).toFixed(2)}%`;
    } else if (svgX < 880) {
      y = 20;
      val = '99.98%';
    } else if (svgX <= 900) {
      const t = (svgX - 880) / (900 - 880);
      y = 20 + t * (14 - 20);
      val = `${(99.98 + t * 0.02).toFixed(2)}%`;
    } else {
      y = 14;
      val = '100.0%';
    }

    setUptimeHover({ pct, yPct: y / 130, time: timeStr, value: val });
  };

  return (
    <section className="w-full flex flex-col gap-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 w-full">
        <h3 className="text-white text-[16px] font-semibold tracking-tight">Analytics</h3>
        <div className="flex items-center gap-2">
          <DateRangePicker
            selectedRangeLabel={selectedRangeLabel}
            onRangeChange={(label) => setSelectedRangeLabel(label)}
          />

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center justify-center h-9 w-9 text-[#8c8c8c] hover:text-white rounded-lg bg-transparent hover:bg-[#141414] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Refresh metrics"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-4 h-4 shrink-0 ${isLoading ? 'animate-spin' : ''}`}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Top Row: 2 Wide Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {/* Card 1: CPU utilization */}
        <div
          className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden cursor-pointer group"
          onClick={() => setSelectedMetric('cpu')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedMetric('cpu')}
        >
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c] group-hover:text-[#cccccc] transition-colors">CPU utilization</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMetric('cpu');
                }}
                className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-1 rounded hover:bg-[#1a1a1a] transition-colors"
                title="View detailed CPU telemetry"
              >
                •••
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight">
                {displayCpu}
              </span>
              <span className="text-xs font-medium text-[#30a46c] flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>3.4%</span>
              </span>
            </div>
          </div>

          {/* Chart row */}
          <div className="chart-graph-container relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="chart-canvas relative flex-1 h-full cursor-crosshair overflow-visible"
              onMouseMove={handleCpuMouseMove}
              onMouseLeave={() => setCpuHover(null)}
            >
              <svg className="w-full h-full block" viewBox="0 0 1000 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpu-gradient-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80ed" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2f80ed" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line className="chart-grid-line" x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,116 L 555,116 L 580,24 L 605,116 L 700,116 L 720,68 L 740,116 L 1000,116 L 1000,126 L 0,126 Z"
                  fill="url(#cpu-gradient-area)"
                  stroke="none"
                />
                <path
                  d="M 0,116 L 555,116 L 580,24 L 605,116 L 700,116 L 720,68 L 740,116 L 1000,116"
                  fill="none"
                  stroke="#2f80ed"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Tracking Guideline & Circular Dot */}
              {cpuHover && (
                <div className="chart-hover-overlay pointer-events-none">
                  <div
                    className="absolute top-[10.8%] bottom-[10.8%] w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${cpuHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${cpuHover.pct * 100}%`, top: `${cpuHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 select-none ${
                      cpuHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${cpuHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-normal text-white mb-1 tabular-nums">{cpuHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-normal text-[#d4d4d8] truncate">CPU utilization</span>
                        </div>
                        <span className="text-xs font-normal text-white shrink-0 tabular-nums">{cpuHover.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="chart-y-axis relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
              <span>25%</span>
              <span>15%</span>
              <span>5%</span>
              <span>0%</span>
            </div>

            <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
                <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
              </svg>
            </span>
          </div>
        </div>

        {/* Card 2: Active processes */}
        <div
          className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden cursor-pointer group"
          onClick={() => setSelectedMetric('active')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedMetric('active')}
        >
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c] group-hover:text-[#cccccc] transition-colors">Active processes</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMetric('active');
                }}
                className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-1 rounded hover:bg-[#1a1a1a] transition-colors"
                title="View detailed process telemetry"
              >
                •••
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight">
                {displayRunning}
              </span>
              <span className="text-xs font-medium text-[#30a46c] flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>100%</span>
              </span>
            </div>
          </div>

          <div className="chart-graph-container relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="chart-canvas relative flex-1 h-full cursor-crosshair overflow-visible"
              onMouseMove={handleActiveMouseMove}
              onMouseLeave={() => setActiveHover(null)}
            >
              <svg className="w-full h-full block" viewBox="0 0 1000 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="active-gradient-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80ed" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#2f80ed" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                <line className="chart-grid-line" x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,31 L 380,31 L 400,48 L 480,48 L 500,31 L 1000,31 L 1000,116 L 0,116 Z"
                  fill="url(#active-gradient-area)"
                  stroke="none"
                />
                <path
                  d="M 0,31 L 380,31 L 400,48 L 480,48 L 500,31 L 1000,31"
                  fill="none"
                  stroke="#2f80ed"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Tracking Guideline & Circular Dot */}
              {activeHover && (
                <div className="chart-hover-overlay pointer-events-none">
                  <div
                    className="absolute top-[10.8%] bottom-[10.8%] w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${activeHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${activeHover.pct * 100}%`, top: `${activeHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 select-none ${
                      activeHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${activeHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-semibold text-white mb-1 tabular-nums">{activeHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-medium text-[#d4d4d8] truncate">Active processes</span>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0 tabular-nums">{activeHover.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="chart-y-axis relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
              <span>8</span>
              <span>6</span>
              <span>4</span>
              <span>0</span>
            </div>

            <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
                <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        {/* Card 3: Memory usage */}
        <div
          className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden cursor-pointer group"
          onClick={() => setSelectedMetric('memory')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedMetric('memory')}
        >
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c] group-hover:text-[#cccccc] transition-colors">Memory usage</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMetric('memory');
                }}
                className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-1 rounded hover:bg-[#1a1a1a] transition-colors"
                title="View detailed memory telemetry"
              >
                •••
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight">
                {displayMemory}
              </span>
              <span className="text-xs font-medium text-[#2f80ed] flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>5.2%</span>
              </span>
            </div>
          </div>

          <div className="chart-graph-container relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="chart-canvas relative flex-1 h-full cursor-crosshair overflow-visible"
              onMouseMove={handleMemoryMouseMove}
              onMouseLeave={() => setMemoryHover(null)}
            >
              <svg className="w-full h-full block" viewBox="0 0 1000 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mem-usage-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80ed" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#2f80ed" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line className="chart-grid-line" x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,116 L 110,116 L 120,85 L 130,116 L 270,116 L 280,65 L 290,116 L 468,116 L 480,16 L 492,116 L 610,116 L 620,45 L 630,116 L 770,116 L 780,75 L 790,116 L 890,116 L 900,55 L 910,116 L 1000,116 L 1000,126 L 0,126 Z"
                  fill="url(#mem-usage-grad)"
                  stroke="none"
                />
                <path
                  d="M 0,116 L 110,116 L 120,85 L 130,116 L 270,116 L 280,65 L 290,116 L 468,116 L 480,16 L 492,116 L 610,116 L 620,45 L 630,116 L 770,116 L 780,75 L 790,116 L 890,116 L 900,55 L 910,116 L 1000,116"
                  fill="none"
                  stroke="#2f80ed"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Tracking Guideline & Circular Dot */}
              {memoryHover && (
                <div className="chart-hover-overlay pointer-events-none">
                  <div
                    className="absolute top-[10.8%] bottom-[10.8%] w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${memoryHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${memoryHover.pct * 100}%`, top: `${memoryHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 select-none ${
                      memoryHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${memoryHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-semibold text-white mb-1 tabular-nums">{memoryHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-medium text-[#d4d4d8] truncate">Memory usage</span>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0 tabular-nums">{memoryHover.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="chart-y-axis relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
              <span>512M</span>
              <span>384M</span>
              <span>256M</span>
              <span>0</span>
            </div>

            <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
                <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
              </svg>
            </span>
          </div>
        </div>

        {/* Card 4: System load */}
        <div
          className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden cursor-pointer group"
          onClick={() => setSelectedMetric('load')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedMetric('load')}
        >
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c] group-hover:text-[#cccccc] transition-colors">System load</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMetric('load');
                }}
                className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-1 rounded hover:bg-[#1a1a1a] transition-colors"
                title="View detailed system load telemetry"
              >
                •••
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight">
                {displaySysLoad}
              </span>
              <span className="text-xs font-medium text-[#30a46c] flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                <span>12.5%</span>
              </span>
            </div>
          </div>

          <div className="chart-graph-container relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="chart-canvas relative flex-1 h-full cursor-crosshair overflow-visible"
              onMouseMove={handleSysLoadMouseMove}
              onMouseLeave={() => setSysLoadHover(null)}
            >
              <svg className="w-full h-full block" viewBox="0 0 1000 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sys-load-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80ed" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2f80ed" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <line className="chart-grid-line" x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,82 C 120,82 180,65 280,65 C 380,65 440,100 540,100 C 660,100 740,60 840,60 C 910,60 960,80 1000,80 L 1000,116 L 0,116 Z"
                  fill="url(#sys-load-grad)"
                  stroke="none"
                />
                <path
                  d="M 0,82 C 120,82 180,65 280,65 C 380,65 440,100 540,100 C 660,100 740,60 840,60 C 910,60 960,80 1000,80"
                  fill="none"
                  stroke="#2f80ed"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Tracking Guideline & Circular Dot */}
              {sysLoadHover && (
                <div className="chart-hover-overlay pointer-events-none">
                  <div
                    className="absolute top-[10.8%] bottom-[10.8%] w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${sysLoadHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${sysLoadHover.pct * 100}%`, top: `${sysLoadHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 select-none ${
                      sysLoadHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${sysLoadHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-semibold text-white mb-1 tabular-nums">{sysLoadHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-medium text-[#d4d4d8] truncate">System load</span>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0 tabular-nums">{sysLoadHover.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="chart-y-axis relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
              <span>1.0</span>
              <span>0.5</span>
              <span>0.2</span>
              <span>0.0</span>
            </div>

            <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
                <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
              </svg>
            </span>
          </div>
        </div>

        {/* Card 5: Process restarts */}
        <div
          className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden cursor-pointer group"
          onClick={() => setSelectedMetric('restarts')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedMetric('restarts')}
        >
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c] group-hover:text-[#cccccc] transition-colors">Process restarts</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMetric('restarts');
                }}
                className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-1 rounded hover:bg-[#1a1a1a] transition-colors"
                title="View detailed restart telemetry"
              >
                •••
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight">
                {displayRestarts}
              </span>
              <span className="text-xs font-medium text-[#30a46c] flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                <span>50.0%</span>
              </span>
            </div>
          </div>

          <div className="chart-graph-container relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="chart-canvas relative flex-1 h-full cursor-crosshair overflow-visible"
              onMouseMove={handleRestartsMouseMove}
              onMouseLeave={() => setRestartsHover(null)}
            >
              <svg className="w-full h-full block" viewBox="0 0 1000 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="restarts-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80ed" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#2f80ed" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <line className="chart-grid-line" x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,116 L 335,116 L 350,56 L 365,116 L 665,116 L 680,56 L 695,116 L 1000,116 L 1000,126 L 0,126 Z"
                  fill="url(#restarts-grad)"
                  stroke="none"
                />
                <path
                  d="M 0,116 L 335,116 L 350,56 L 365,116 L 665,116 L 680,56 L 695,116 L 1000,116"
                  fill="none"
                  stroke="#2f80ed"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Tracking Guideline & Circular Dot */}
              {restartsHover && (
                <div className="chart-hover-overlay pointer-events-none">
                  <div
                    className="absolute top-[10.8%] bottom-[10.8%] w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${restartsHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${restartsHover.pct * 100}%`, top: `${restartsHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 select-none ${
                      restartsHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${restartsHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-semibold text-white mb-1 tabular-nums">{restartsHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-medium text-[#d4d4d8] truncate">Process restarts</span>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0 tabular-nums">{restartsHover.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="chart-y-axis relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
              <span>3</span>
              <span>2</span>
              <span>1</span>
              <span>0</span>
            </div>

            <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
                <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
              </svg>
            </span>
          </div>
        </div>

        {/* Card 6: Avg. uptime */}
        <div
          className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden cursor-pointer group"
          onClick={() => setSelectedMetric('uptime')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedMetric('uptime')}
        >
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c] group-hover:text-[#cccccc] transition-colors">Avg. uptime</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMetric('uptime');
                }}
                className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-1 rounded hover:bg-[#1a1a1a] transition-colors"
                title="View detailed uptime telemetry"
              >
                •••
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight">
                99.98%
              </span>
              <span className="text-xs font-medium text-[#30a46c] flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>0.05%</span>
              </span>
            </div>
          </div>

          <div className="chart-graph-container relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="chart-canvas relative flex-1 h-full cursor-crosshair overflow-visible"
              onMouseMove={handleUptimeMouseMove}
              onMouseLeave={() => setUptimeHover(null)}
            >
              <svg className="w-full h-full block" viewBox="0 0 1000 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="uptime-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80ed" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2f80ed" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                <line className="chart-grid-line" x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line className="chart-grid-line" x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,20 L 380,20 C 400,20 415,65 430,65 C 445,65 460,20 480,20 L 880,20 L 900,14 L 1000,14 L 1000,116 L 0,116 Z"
                  fill="url(#uptime-grad)"
                  stroke="none"
                />
                <path
                  d="M 0,20 L 380,20 C 400,20 415,65 430,65 C 445,65 460,20 480,20 L 880,20 L 900,14 L 1000,14"
                  fill="none"
                  stroke="#2f80ed"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Tracking Guideline & Circular Dot */}
              {uptimeHover && (
                <div className="chart-hover-overlay pointer-events-none">
                  <div
                    className="absolute top-[10.8%] bottom-[10.8%] w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${uptimeHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${uptimeHover.pct * 100}%`, top: `${uptimeHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 select-none ${
                      uptimeHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${uptimeHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-semibold text-white mb-1 tabular-nums">{uptimeHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-medium text-[#d4d4d8] truncate">Avg. uptime</span>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0 tabular-nums">{uptimeHover.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="chart-y-axis relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
              <span>100%</span>
              <span>99.9%</span>
              <span>99.5%</span>
              <span>99.0%</span>
            </div>

            <span className="absolute bottom-1 right-1 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-[#555555]">
                <path d="M216.49,136.49l-80,80a12,12,0,1,1-17-17l80-80a12,12,0,1,1,17,17Zm-16-105a12,12,0,0,0-17,0l-152,152a12,12,0,0,0,17,17l152-152A12,12,0,0,0,200.49,31.51Z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Right-Side Detailed Telemetry SlideOver Drawer */}
      <SlideOver
        isOpen={selectedMetric !== null}
        onClose={() => setSelectedMetric(null)}
        title={selectedMetric ? METRIC_META[selectedMetric].title : 'Telemetry'}
        subtitle={
          <div className="flex items-center gap-1.5 text-[13px] text-[#8c8c8c] font-sans">
            <span>{selectedRangeLabel}</span>
            <span>•</span>
            <span>localhost</span>
          </div>
        }
        width="w-[460px] sm:w-[480px] max-w-full"
      >
        {selectedMetric && (
          <div className="flex flex-col h-full overflow-hidden bg-[#0e0e0e]">
            {/* Top Metric Switcher Tabs (Exact Cloudflare / Dashboard Pills) */}
            <div className="shrink-0 px-3.5 py-2.5 bg-[#141414] border-b border-[#222222] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {METRIC_TABS.map((tab) => {
                const isCurrent = selectedMetric === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedMetric(tab.id)}
                    className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-colors shrink-0 cursor-pointer ${
                      isCurrent
                        ? 'bg-[#2f80ed] text-white shadow-xs'
                        : 'text-[#8c8c8c] hover:text-white hover:bg-[#1c1c1c]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Metric Hero Card (Exact Dashboard Card Typography & Layout) */}
            <div className="shrink-0 p-4 border-b border-[#222222] bg-[#0e0e0e]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-normal text-[#8c8c8c]">
                  {selectedMetric === 'cpu' && 'CPU utilization'}
                  {selectedMetric === 'active' && 'Active processes'}
                  {selectedMetric === 'memory' && 'Memory usage'}
                  {selectedMetric === 'load' && 'System load'}
                  {selectedMetric === 'restarts' && 'Process restarts'}
                  {selectedMetric === 'uptime' && 'Avg. uptime'}
                </span>
                <span className="text-[13px] font-normal text-[#8c8c8c]">
                  {selectedRangeLabel}
                </span>
              </div>
              {/* Main value + Right-side simple graph */}
              <div className="flex items-center justify-between gap-4 mt-2">
                <div>
                  <div className="text-[26px] font-semibold text-white tracking-[-0.02em] leading-tight font-sans">
                    {selectedMetric === 'cpu' && displayCpu}
                    {selectedMetric === 'active' && `${displayRunning} / ${totalCount || activeProcessesList.length}`}
                    {selectedMetric === 'memory' && displayMemory}
                    {selectedMetric === 'load' && displaySysLoad}
                    {selectedMetric === 'restarts' && `${displayRestarts}`}
                    {selectedMetric === 'uptime' && '99.98%'}
                  </div>
                  <div className="mt-0.5">
                    {selectedMetric === 'cpu' && (
                      <span className="text-[13px] font-medium text-[#30a46c] flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span>3.4%</span>
                      </span>
                    )}
                    {selectedMetric === 'active' && (
                      <span className="text-[13px] font-medium text-[#30a46c] flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span>100%</span>
                      </span>
                    )}
                    {selectedMetric === 'memory' && (
                      <span className="text-[13px] font-medium text-[#2f80ed] flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span>5.2%</span>
                      </span>
                    )}
                    {selectedMetric === 'load' && (
                      <span className="text-[13px] font-medium text-[#30a46c] flex items-center gap-0.5">
                        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                        <span>12.5%</span>
                      </span>
                    )}
                    {selectedMetric === 'restarts' && (
                      <span className="text-[13px] font-medium text-[#30a46c] flex items-center gap-0.5">
                        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                        <span>50.0%</span>
                      </span>
                    )}
                    {selectedMetric === 'uptime' && (
                      <span className="text-[13px] font-medium text-[#30a46c] flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span>0.05%</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side simple sparkline graph */}
                <div className="w-[180px] sm:w-[210px] h-[48px] shrink-0 relative overflow-hidden">
                  <svg viewBox="0 0 220 48" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="drawerSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={
                            selectedMetric === 'restarts'
                              ? '#f59e0b'
                              : selectedMetric === 'active' || selectedMetric === 'load' || selectedMetric === 'uptime'
                              ? '#30a46c'
                              : '#2f80ed'
                          }
                          stopOpacity="0.28"
                        />
                        <stop
                          offset="100%"
                          stopColor={
                            selectedMetric === 'restarts'
                              ? '#f59e0b'
                              : selectedMetric === 'active' || selectedMetric === 'load' || selectedMetric === 'uptime'
                              ? '#30a46c'
                              : '#2f80ed'
                          }
                          stopOpacity="0.0"
                        />
                      </linearGradient>
                    </defs>
                    {/* Subtle dashed baseline */}
                    <line x1="0" y1="44" x2="220" y2="44" stroke="#1c1c1c" strokeWidth="1" strokeDasharray="3 3" />
                    {/* Area fill */}
                    <path
                      d={
                        selectedMetric === 'cpu'
                          ? 'M 0,34 C 25,34 40,24 60,24 C 80,24 95,34 115,34 C 135,34 145,10 165,10 C 180,10 195,24 220,18 L 220,48 L 0,48 Z'
                          : selectedMetric === 'active'
                          ? 'M 0,16 L 55,16 L 55,26 L 70,26 L 70,16 L 125,16 L 125,32 L 140,32 L 140,16 L 180,16 L 180,26 L 195,26 L 195,16 L 220,16 L 220,48 L 0,48 Z'
                          : selectedMetric === 'memory'
                          ? 'M 0,36 L 25,36 L 28,26 L 31,36 L 62,36 L 66,16 L 70,36 L 105,36 L 110,8 L 115,36 L 150,36 L 155,22 L 160,36 L 185,36 L 189,24 L 193,36 L 220,36 L 220,48 L 0,48 Z'
                          : selectedMetric === 'load'
                          ? 'M 0,28 C 35,28 55,16 90,16 C 130,16 150,34 185,34 C 200,34 210,22 220,20 L 220,48 L 0,48 Z'
                          : selectedMetric === 'restarts'
                          ? 'M 0,40 L 75,40 L 80,14 L 85,40 L 150,40 L 155,18 L 160,40 L 220,40 L 220,48 L 0,48 Z'
                          : 'M 0,10 L 85,10 C 90,10 95,26 100,26 C 105,26 110,10 115,10 L 190,10 L 195,8 L 220,8 L 220,48 L 0,48 Z'
                      }
                      fill="url(#drawerSparklineGrad)"
                    />
                    {/* Stroke line */}
                    <path
                      d={
                        selectedMetric === 'cpu'
                          ? 'M 0,34 C 25,34 40,24 60,24 C 80,24 95,34 115,34 C 135,34 145,10 165,10 C 180,10 195,24 220,18'
                          : selectedMetric === 'active'
                          ? 'M 0,16 L 55,16 L 55,26 L 70,26 L 70,16 L 125,16 L 125,32 L 140,32 L 140,16 L 180,16 L 180,26 L 195,26 L 195,16 L 220,16'
                          : selectedMetric === 'memory'
                          ? 'M 0,36 L 25,36 L 28,26 L 31,36 L 62,36 L 66,16 L 70,36 L 105,36 L 110,8 L 115,36 L 150,36 L 155,22 L 160,36 L 185,36 L 189,24 L 193,36 L 220,36'
                          : selectedMetric === 'load'
                          ? 'M 0,28 C 35,28 55,16 90,16 C 130,16 150,34 185,34 C 200,34 210,22 220,20'
                          : selectedMetric === 'restarts'
                          ? 'M 0,40 L 75,40 L 80,14 L 85,40 L 150,40 L 155,18 L 160,40 L 220,40'
                          : 'M 0,10 L 85,10 C 90,10 95,26 100,26 C 105,26 110,10 115,10 L 190,10 L 195,8 L 220,8'
                      }
                      fill="none"
                      stroke={
                        selectedMetric === 'restarts'
                          ? '#f59e0b'
                          : selectedMetric === 'active' || selectedMetric === 'load' || selectedMetric === 'uptime'
                          ? '#30a46c'
                          : '#2f80ed'
                      }
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Current point indicator */}
                    <circle
                      cx="220"
                      cy={
                        selectedMetric === 'cpu'
                          ? 18
                          : selectedMetric === 'active'
                          ? 16
                          : selectedMetric === 'memory'
                          ? 36
                          : selectedMetric === 'load'
                          ? 20
                          : selectedMetric === 'restarts'
                          ? 40
                          : 8
                      }
                      r="2.5"
                      fill={
                        selectedMetric === 'restarts'
                          ? '#f59e0b'
                          : selectedMetric === 'active' || selectedMetric === 'load' || selectedMetric === 'uptime'
                          ? '#30a46c'
                          : '#2f80ed'
                      }
                    />
                  </svg>
                </div>
              </div>

              {/* Edge-to-edge line through padding */}
              <div className="-mx-4 h-px bg-[#222222] my-3" />

              {/* High-density 3-stat summary row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[13px] text-[#8c8c8c]">
                    {selectedMetric === 'cpu' ? 'Peak' : selectedMetric === 'active' ? 'Running' : selectedMetric === 'memory' ? 'Top process' : selectedMetric === 'load' ? '5m average' : selectedMetric === 'restarts' ? 'Unstable' : 'Incidents'}
                  </div>
                  <div className="text-[14px] font-medium text-white mt-0.5 tabular-nums">
                    {selectedMetric === 'cpu' && '24.8%'}
                    {selectedMetric === 'active' && `${displayRunning}`}
                    {selectedMetric === 'memory' && (filteredProcesses[0]?.mem || '124.6 MB')}
                    {selectedMetric === 'load' && (parseFloat(String(displaySysLoad)) * 0.85).toFixed(2)}
                    {selectedMetric === 'restarts' && `${activeProcessesList.filter(p => (p.restart_count || 0) > 0).length}`}
                    {selectedMetric === 'uptime' && '0'}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[#8c8c8c]">
                    {selectedMetric === 'cpu' ? 'Processes' : selectedMetric === 'active' ? 'Stopped' : selectedMetric === 'memory' ? 'Average' : selectedMetric === 'load' ? '15m average' : selectedMetric === 'restarts' ? 'Auto-restart' : 'Longest'}
                  </div>
                  <div className="text-[14px] font-medium text-white mt-0.5 tabular-nums">
                    {selectedMetric === 'cpu' && `${displayRunning}`}
                    {selectedMetric === 'active' && `${displayStopped}`}
                    {selectedMetric === 'memory' && `${(totalMemoryMB / (displayRunning || 1)).toFixed(0)} MB`}
                    {selectedMetric === 'load' && (parseFloat(String(displaySysLoad)) * 0.72).toFixed(2)}
                    {selectedMetric === 'restarts' && `${activeProcessesList.filter(p => p.auto_restart).length}`}
                    {selectedMetric === 'uptime' && (activeProcessesList.find(p => p.status === 'running')?.uptime || '18d 4h')}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[#8c8c8c]">
                    {selectedMetric === 'cpu' ? 'Target' : selectedMetric === 'active' ? 'Total' : selectedMetric === 'memory' ? 'Available' : selectedMetric === 'load' ? 'Status' : selectedMetric === 'restarts' ? 'Clean rate' : 'SLA'}
                  </div>
                  <div className="text-[14px] font-medium text-white mt-0.5">
                    {selectedMetric === 'cpu' && '< 80%'}
                    {selectedMetric === 'active' && `${totalCount || activeProcessesList.length}`}
                    {selectedMetric === 'memory' && '1.51 GB'}
                    {selectedMetric === 'load' && 'Normal'}
                    {selectedMetric === 'restarts' && '98.5%'}
                    {selectedMetric === 'uptime' && '99.9%'}
                  </div>
                </div>
              </div>
            </div>

            {/* Search Filter Header */}
            <div className="shrink-0 px-3.5 pt-3 pb-2 flex items-center justify-between gap-3 bg-[#0e0e0e]">
              <div className="relative flex-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                  className="text-[#8c8c8c] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                </svg>
                <input
                  type="text"
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  placeholder="Filter processes..."
                  className="w-full h-9 pl-9 pr-7 rounded-lg bg-[#141414] border border-[#262626] hover:border-[#383838] focus:border-[#2f80ed] text-[14px] text-white placeholder-[#666666] outline-none transition-colors font-sans"
                />
                {drawerSearch && (
                  <button
                    type="button"
                    onClick={() => setDrawerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c8c8c] hover:text-white cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-[13px] text-[#8c8c8c] shrink-0 font-sans tabular-nums">
                {filteredProcesses.length} of {activeProcessesList.length}
              </span>
            </div>

            {/* Inset Process Table (Exact Cloudflare Inset Table Style) */}
            <div className="mx-3.5 mb-3.5 border border-[#262626] rounded-lg overflow-hidden bg-[#0e0e0e] flex-1 flex flex-col min-h-0">
              {/* Inset Table Head */}
              <div className="h-[40px] bg-[#141414] border-b border-[#222222] px-3.5 flex items-center justify-between text-[13px] text-[#8c8c8c] font-normal shrink-0">
                <span>Process</span>
                <span>
                  {selectedMetric === 'cpu' && 'Usage'}
                  {selectedMetric === 'active' && 'Status'}
                  {selectedMetric === 'memory' && 'Memory'}
                  {selectedMetric === 'load' && 'CPU / Memory'}
                  {selectedMetric === 'restarts' && 'Restarts'}
                  {selectedMetric === 'uptime' && 'Uptime'}
                </span>
              </div>

              {/* Inset Table Scrollable Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#1c1c1c] min-h-0">
                {filteredProcesses.length === 0 ? (
                  <div className="p-8 text-center text-[14px] text-[#8c8c8c] font-sans">
                    No processes found
                  </div>
                ) : (
                  filteredProcesses.map((p) => {
                    const cpuVal = parseCpuVal(p.cpu);
                    const restarts = p.restart_count || 0;
                    const isRunning = p.status === 'running';

                    return (
                      <div
                        key={p.id}
                        className="h-[46px] hover:bg-[#141414] px-3.5 flex items-center justify-between transition-colors cursor-default"
                      >
                        {/* Process details */}
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? 'bg-[#30a46c]' : 'bg-[#555555]'
                            }`}
                          />
                          <span
                            className="text-[14px] font-medium text-white truncate font-sans"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          {p.group_name && (
                            <span
                              className="text-[12px] px-1.5 py-0.5 rounded bg-[#161616] text-[#8c8c8c] border border-[#262626] font-mono shrink-0 max-w-[100px] truncate"
                              title={`Group: ${p.group_name}`}
                            >
                              {p.group_name}
                            </span>
                          )}
                          <span className="text-[13px] text-[#8c8c8c] font-mono shrink-0">
                            {p.pid ? `PID ${p.pid}` : 'No PID'}
                          </span>
                        </div>

                        {/* Metric Value */}
                        <div className="text-right shrink-0">
                          {selectedMetric === 'cpu' && (
                            <span className="text-[14px] font-normal text-white font-mono tabular-nums">
                              {cpuVal.toFixed(1)}%
                            </span>
                          )}

                          {selectedMetric === 'active' && (
                            <span
                              className={`inline-block text-[12px] font-normal px-2 py-0.5 rounded capitalize ${
                                isRunning
                                  ? 'text-[#30a46c] bg-[#30a46c]/10 border border-[#30a46c]/20'
                                  : 'text-[#8c8c8c] bg-[#161616] border border-[#262626]'
                              }`}
                            >
                              {p.status}
                            </span>
                          )}

                          {selectedMetric === 'memory' && (
                            <span className="text-[14px] font-normal text-white font-mono tabular-nums">
                              {p.mem || '0 MB'}
                            </span>
                          )}

                          {selectedMetric === 'load' && (
                            <span className="text-[14px] font-normal text-white font-mono tabular-nums">
                              {cpuVal.toFixed(1)}% <span className="text-[13px] text-[#8c8c8c] font-sans font-normal">• {p.mem || '0 MB'}</span>
                            </span>
                          )}

                          {selectedMetric === 'restarts' && (
                            <span
                              className={`text-[14px] font-normal font-mono tabular-nums ${
                                restarts > 0 ? 'text-[#f59e0b]' : 'text-[#8c8c8c]'
                              }`}
                            >
                              {restarts}
                            </span>
                          )}

                          {selectedMetric === 'uptime' && (
                            <span className="text-[14px] font-normal text-white font-mono tabular-nums">
                              {isRunning ? p.uptime : 'Stopped'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pinned Bottom Footer Bar */}
            <div className="shrink-0 px-4 py-3 bg-[#0e0e0e] flex items-center justify-between">
              <span className="text-[13px] text-[#8c8c8c] font-sans flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#30a46c]" />
                <span>Live telemetry</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="h-9 px-4 rounded-lg text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMetric(null)}
                  className="h-9 px-5 rounded-lg text-[14px] font-medium text-white bg-[#2f80ed] hover:bg-[#2563eb] transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </section>
  );
};
