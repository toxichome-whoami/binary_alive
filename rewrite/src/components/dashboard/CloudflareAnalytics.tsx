import React, { useState, useMemo, useEffect, useRef } from 'react';
import { processesApi } from '../../api/processes';
import { DATE_PRESETS } from '../shared/DateRangePicker';
import {
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

const MAX_PTS = 60;
type MetricKey = 'cpu' | 'active' | 'memory' | 'load' | 'restarts' | 'uptime';

const getInitialStore = (): Record<MetricKey, number[]> => {
  try {
    const saved = sessionStorage.getItem('binary_alive_tsStore');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.cpu && parsed.cpu.length === MAX_PTS) return parsed;
    }
  } catch {}
  return {
    cpu: Array(MAX_PTS).fill(0),
    active: Array(MAX_PTS).fill(0),
    memory: Array(MAX_PTS).fill(0),
    load: Array(MAX_PTS).fill(0),
    restarts: Array(MAX_PTS).fill(0),
    uptime: Array(MAX_PTS).fill(100),
  };
};

export const tsStore: Record<MetricKey, number[]> = getInitialStore();

export function generateGraphPaths(key: MetricKey, width: number, bottomY: number, data: number[]) {
  
  if (data.length === 0) return { line: '', area: '' };
  
  let baseMax = 1;
  if (key === 'cpu') baseMax = 100;
  if (key === 'memory') baseMax = 1024;
  if (key === 'active') baseMax = 10;
  if (key === 'load') baseMax = 4;
  if (key === 'restarts') baseMax = 5;
  if (key === 'uptime') baseMax = 100;

  const maxVal = Math.max(...data, baseMax);
  
  
  let line = '';
  
  // For historical data, we might have hundreds of points, but we just draw them across the width
  const actualStepX = width / Math.max(data.length - 1, 1);
  data.forEach((val, i) => {
    const x = i * actualStepX;
    
    let rawY = bottomY - ((val / maxVal) * (bottomY - 20));
    if (val === 0) rawY = bottomY;
    
    if (i === 0) line += `M ${x.toFixed(1)},${rawY.toFixed(1)}`;
    else line += ` L ${x.toFixed(1)},${rawY.toFixed(1)}`;
  });

  const area = `${line} L ${width},${bottomY} L 0,${bottomY} Z`;
  return { line, area, maxVal };
}

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
  
  // Total memory used by running processes (in MB)
  const totalMemoryMB = useMemo(() => {
    if (!processes || processes.length === 0) return 0;
    return processes.reduce((acc, p) => {
      if (p.status === 'running' && p.mem) {
        const num = parseFloat(p.mem);
        if (!isNaN(num)) {
          if (p.mem.toLowerCase().includes('gb')) return acc + num * 1024;
          return acc + num;
        }
        return acc + parseMemMB(p.mem);
      }
      return acc;
    }, 0);
  }, [processes]);
  // Aggregate CPU utilization across all running processes
  const totalCpuPercent = useMemo(() => {
    if (!processes || processes.length === 0) return 0;
    const sum = processes.reduce((acc, p) => {
      if (p.status === 'running' && p.cpu !== undefined) {
        return acc + parseCpuVal(p.cpu);
      }
      return acc;
    }, 0);
    return Number(sum.toFixed(1));
  }, [processes]);

  // Demo / Real values fallback
  const displayRunning = runningCount;
  const displayStopped = stoppedCount;
  const displayMemory =
    totalMemoryMB >= 1024
      ? `${(totalMemoryMB / 1024).toFixed(2)} GB`
      : `${Math.round(totalMemoryMB)} MB`;
  const displaySysLoad = sysLoad !== '---' ? sysLoad : '0.00';
  const displayRestarts = restartsCount;
  const displayCpu = `${totalCpuPercent}%`;
  
  const [, setTick] = useState(0);

  useEffect(() => {
    tsStore.cpu.shift(); tsStore.cpu.push(totalCpuPercent);
    tsStore.active.shift(); tsStore.active.push(runningCount);
    tsStore.memory.shift(); tsStore.memory.push(totalMemoryMB);
    tsStore.load.shift(); tsStore.load.push(parseFloat(String(displaySysLoad)) || 0);
    tsStore.restarts.shift(); tsStore.restarts.push(restartsCount);
    tsStore.uptime.shift(); tsStore.uptime.push(100);
    setTick(t => t + 1);
  }, [processes]);

  // Right-side SlideOver Telemetry Drawer State
    const [selectedMetric, setSelectedMetric] = useState<
    'cpu' | 'active' | 'memory' | 'load' | 'restarts' | 'uptime' | null
  >(null);
  
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('Live (60s)');
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  
  

  // Use historical data if available, else live buffer
  const getGraphData = (key: MetricKey) => {
    if (historicalData.length > 0) {
      // Map DB columns to metric keys
      const dbKey = key === 'memory' ? 'memory_mb' : key === 'load' ? 'sys_load' : key === 'active' ? 'active_procs' : key;
      return historicalData.map(row => row[dbKey] || 0);
    }
    return tsStore[key];
  };

  const [isCooldown, setIsCooldown] = useState(false);
  
  const handleRefreshWithCooldown = () => {
    if (isCooldown) return;
    setIsCooldown(true);
    onRefresh();
    setTimeout(() => setIsCooldown(false), 2000);
  };

  const [drawerSearch, setDrawerSearch] = useState('');

  // Memory & CPU parse utilities
  function parseMemMB(memStr: string | undefined): number {
    if (!memStr) return 0;
    const num = parseFloat(memStr);
    if (isNaN(num)) return 0;
    if (memStr.toLowerCase().includes('gb')) return num * 1024;
    return num;
  };

  function parseCpuVal(cpuVal: string | number | undefined): number {
    if (cpuVal === undefined || cpuVal === null) return 0;
    const val = typeof cpuVal === 'number' ? cpuVal : parseFloat(String(cpuVal).replace('%', ''));
    return isNaN(val) ? 0 : val;
  };

  // Active processes for telemetry display
  const activeProcessesList = useMemo(() => {
    return processes || [];
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
  const [activeHover, setActiveHover] = useState<CardHoverData | null>(null);
  const [memoryHover, setMemoryHover] = useState<CardHoverData | null>(null);
  const [sysLoadHover, setSysLoadHover] = useState<CardHoverData | null>(null);
  const [restartsHover, setRestartsHover] = useState<CardHoverData | null>(null);
  const [uptimeHover, setUptimeHover] = useState<CardHoverData | null>(null);

  const getHoverData = (e: React.MouseEvent<HTMLDivElement>, key: MetricKey): CardHoverData | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    const data = getGraphData(key);
    
    const idx = Math.round(pct * Math.max(data.length - 1, 0));
    const timeStr = formatTimeFromPct(pct);
      const val = data[idx] || 0;

    let baseMax = 1;
    if (key === 'cpu') baseMax = 100;
    if (key === 'memory') baseMax = 1024;
    if (key === 'active') baseMax = 10;
    if (key === 'load') baseMax = 4;
    if (key === 'restarts') baseMax = 5;
    if (key === 'uptime') baseMax = 100;

    const maxVal = Math.max(...data, baseMax);
    
    let rawY = 116 - ((val / maxVal) * (116 - 20));
    if (val === 0) rawY = 116;
    
    let displayValue = '';
    if (key === 'cpu') displayValue = `${val.toFixed(1)}%`;
    else if (key === 'active') displayValue = `${val} active`;
    else if (key === 'memory') displayValue = val >= 1024 ? `${(val / 1024).toFixed(2)} GB` : `${Math.round(val)} MB`;
    else if (key === 'load') displayValue = val.toFixed(2);
    else if (key === 'restarts') displayValue = `${val}`;
    else displayValue = `${val.toFixed(2)}%`;

    return { pct, yPct: rawY / 130, time: timeStr, value: displayValue };
  };

  const handleCpuMouseMove = (e: React.MouseEvent<HTMLDivElement>) => setCpuHover(getHoverData(e, 'cpu'));
  const handleActiveMouseMove = (e: React.MouseEvent<HTMLDivElement>) => setActiveHover(getHoverData(e, 'active'));
  const handleMemoryMouseMove = (e: React.MouseEvent<HTMLDivElement>) => setMemoryHover(getHoverData(e, 'memory'));
  const handleSysLoadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => setSysLoadHover(getHoverData(e, 'load'));
  const handleRestartsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => setRestartsHover(getHoverData(e, 'restarts'));
  const handleUptimeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => setUptimeHover(getHoverData(e, 'uptime'));

return (
    <section className="w-full flex flex-col gap-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 w-full">
        <h3 className="text-white text-[16px] font-semibold tracking-tight">Analytics</h3>
        <div className="flex items-center gap-2">
            <DateRangePicker
              selectedRangeLabel={selectedRangeLabel}
              onRangeChange={(label, start, end) => {
                setSelectedRangeLabel(label);
                if (label === 'Live (60s)') {
                  setHistoricalData([]);
                  return;
                }
                const preset = DATE_PRESETS.find(p => p.label === label);
                if (start && end) {
                  // Custom date range
                  processesApi.getTelemetry(0, start.toISOString(), end.toISOString()).then(res => {
                    if (res.success && res.data) setHistoricalData(res.data);
                  }).catch(console.error);
                } else if (preset && preset.minutes > 0) {
                  // Preset range
                  processesApi.getTelemetry(preset.minutes).then(res => {
                    if (res.success && res.data) setHistoricalData(res.data);
                  }).catch(console.error);
                }
              }}
            />

            <button
              type="button"
              onClick={handleRefreshWithCooldown}
              disabled={isLoading || isCooldown}
              className={`flex items-center justify-center h-9 w-9 text-[#8c8c8c] hover:text-white rounded-lg bg-transparent hover:bg-[#141414] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${isCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Refresh metrics"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin opacity-50' : ''}`} />
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
                  d={generateGraphPaths('cpu', 1000, 116, getGraphData('cpu')).area}
                  fill="url(#cpu-gradient-area)"
                  stroke="none"
                />
                <path
                  d={generateGraphPaths('cpu', 1000, 116, getGraphData('cpu')).line}
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
                  d={generateGraphPaths('active', 1000, 116, getGraphData('active')).area}
                  fill="url(#active-gradient-area)"
                  stroke="none"
                />
                <path
                  d={generateGraphPaths('active', 1000, 116, getGraphData('active')).line}
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
                  d={generateGraphPaths('memory', 1000, 116, getGraphData('memory')).area}
                  fill="url(#mem-usage-grad)"
                  stroke="none"
                />
                <path
                  d={generateGraphPaths('memory', 1000, 116, getGraphData('memory')).line}
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
                  d={generateGraphPaths('load', 1000, 116, getGraphData('load')).area}
                  fill="url(#sys-load-grad)"
                  stroke="none"
                />
                <path
                  d={generateGraphPaths('load', 1000, 116, getGraphData('load')).line}
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
                  d={generateGraphPaths('restarts', 1000, 116, getGraphData('restarts')).area}
                  fill="url(#restarts-grad)"
                  stroke="none"
                />
                <path
                  d={generateGraphPaths('restarts', 1000, 116, getGraphData('restarts')).line}
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
                100%
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
                  d={generateGraphPaths('uptime', 1000, 116, getGraphData('uptime')).area}
                  fill="url(#uptime-grad)"
                  stroke="none"
                />
                <path
                  d={generateGraphPaths('uptime', 1000, 116, getGraphData('uptime')).line}
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
                    {selectedMetric === 'uptime' && '100%'}
                  </div>
                  <div className="mt-0.5">
                    
                    
                    
                    
                    
                    
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
                      d={selectedMetric ? generateGraphPaths(selectedMetric, 220, 48, getGraphData(selectedMetric)).area : ''}
                      fill="url(#drawerSparklineGrad)"
                    />
                    {/* Stroke line */}
                    <path
                      d={selectedMetric ? generateGraphPaths(selectedMetric, 220, 48, getGraphData(selectedMetric)).line : ''}
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
                        cy={(() => {
                          if (!selectedMetric) return 48;
                          const data = getGraphData(selectedMetric);
                          if (!data || data.length === 0) return 48;
                          
                          let baseMax = 1;
                          if (selectedMetric === 'cpu') baseMax = 100;
                          if (selectedMetric === 'memory') baseMax = 1024;
                          if (selectedMetric === 'active') baseMax = 10;
                          if (selectedMetric === 'load') baseMax = 4;
                          if (selectedMetric === 'restarts') baseMax = 5;
                          if (selectedMetric === 'uptime') baseMax = 100;
                          
                          const maxVal = Math.max(...data, baseMax);
                          const val = data[data.length - 1] || 0;
                          
                          if (val === 0) return 48;
                          return 48 - ((val / maxVal) * (48 - 20));
                        })()}
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
                    {selectedMetric === 'uptime' && (activeProcessesList.find(p => p.status === 'running')?.uptime || '0s')}
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
              <div className="h-[40px] bg-[#141414] border-b border-[#222222] px-3.5 flex items-center justify-between text-[13px] text-[#8c8c8c] font-normal shrink-0 font-sans">
                <span>Process</span>
                <span>
                  {selectedMetric === 'cpu' && 'Usage'}
                  {selectedMetric === 'active' && 'Status'}
                  {selectedMetric === 'memory' && 'Memory'}
                  {selectedMetric === 'load' && 'Load'}
                  {selectedMetric === 'restarts' && 'Restarts'}
                  {selectedMetric === 'uptime' && 'Uptime'}
                </span>
              </div>

              {/* Inset Table Scrollable Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#1c1c1c] min-h-0 font-sans">
                {filteredProcesses.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[#8c8c8c] font-sans">
                    No processes found
                  </div>
                ) : (
                  filteredProcesses.map((p) => {
                    const cpuVal = parseCpuVal(p.cpu);
                    const restarts = p.restart_count || 0;
                    const isRunning = p.status === 'running';
                    const procLoad = isRunning
                      ? Math.max(0.01, (cpuVal / 50) + (parseMemMB(p.mem) / 1500)).toFixed(2)
                      : '0.00';

                    return (
                      <div
                        key={p.id}
                        className="h-[46px] hover:bg-[#141414] px-3.5 flex items-center justify-between transition-colors cursor-default font-sans"
                      >
                        {/* Process details */}
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? 'bg-[#30a46c]' : 'bg-[#555555]'
                            }`}
                          />
                          <span
                            className="text-[13px] font-medium text-white truncate font-sans"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          <span className="text-[13px] text-[#8c8c8c] font-sans tabular-nums shrink-0">
                            {p.pid ? `PID ${p.pid}` : 'No PID'}
                          </span>
                        </div>

                        {/* Metric Value */}
                        <div className="text-right shrink-0 font-sans">
                          {selectedMetric === 'cpu' && (
                            <span className="text-[13px] font-normal text-[#8c8c8c] font-sans tabular-nums">
                              {cpuVal.toFixed(1)}%
                            </span>
                          )}

                          {selectedMetric === 'active' && (
                            <span
                              className={`inline-block text-[12px] font-normal px-2 py-0.5 rounded capitalize font-sans ${
                                isRunning
                                  ? 'text-[#30a46c] bg-[#30a46c]/10 border border-[#30a46c]/20'
                                  : 'text-[#8c8c8c] bg-[#161616] border border-[#262626]'
                              }`}
                            >
                              {p.status}
                            </span>
                          )}

                          {selectedMetric === 'memory' && (
                            <span className="text-[13px] font-normal text-[#8c8c8c] font-sans tabular-nums">
                              {p.mem || '0 MB'}
                            </span>
                          )}

                          {selectedMetric === 'load' && (
                            <span className="text-[13px] font-normal text-[#8c8c8c] font-sans tabular-nums">
                              {procLoad}
                            </span>
                          )}

                          {selectedMetric === 'restarts' && (
                            <span
                              className={`text-[13px] font-normal font-sans tabular-nums ${
                                restarts > 0 ? 'text-[#f59e0b]' : 'text-[#8c8c8c]'
                              }`}
                            >
                              {restarts}
                            </span>
                          )}

                          {selectedMetric === 'uptime' && (
                            <span className="text-[13px] font-normal text-[#8c8c8c] font-sans tabular-nums">
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
                  className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent hover:bg-[#161616] border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMetric(null)}
                  className="group relative flex shrink-0 items-center justify-center h-9 px-5 rounded-lg font-medium text-white shadow-xs outline-none cursor-pointer overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                  <span className="relative flex items-center gap-1.5 text-[14px]">
                    Done
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </section>
  );
};
