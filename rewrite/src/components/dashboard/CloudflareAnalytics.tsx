import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Process } from '../../types';

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

const NoDataWavyChart: React.FC<NoDataWavyChartProps> = ({
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

  // 1. CPU Hover State - Precisely tracks SVG line (y=116 baseline, peaks at 58% and 72%)
  const [cpuHover, setCpuHover] = useState<CardHoverData | null>(null);
  const handleCpuMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeStr = formatTimeFromPct(pct);

    let val = 0.0;
    let y = 116;

    const dist1 = Math.abs(pct - 0.58);
    const dist2 = Math.abs(pct - 0.72);

    if (dist1 <= 0.025) {
      const factor = 1 - dist1 / 0.025;
      val = factor * 24.2;
      y = 116 - factor * (116 - 24);
    } else if (dist2 <= 0.02) {
      const factor = 1 - dist2 / 0.02;
      val = factor * 11.5;
      y = 116 - factor * (116 - 68);
    } else {
      val = 0.0;
      y = 116;
    }

    const yPct = y / 130;
    setCpuHover({ pct, yPct, time: timeStr, value: `${val.toFixed(1)}%` });
  };

  // 2. Active Processes Hover State - Precisely tracks active process line (y=31 baseline, dip at 40-48% to y=48)
  const [activeHover, setActiveHover] = useState<CardHoverData | null>(null);
  const handleActiveMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeStr = formatTimeFromPct(pct);

    let val = displayRunning;
    let y = 31;

    if (pct >= 0.38 && pct <= 0.40) {
      const f = (pct - 0.38) / 0.02;
      y = 31 + f * (48 - 31);
      val = f > 0.5 ? Math.max(1, displayRunning - 1) : displayRunning;
    } else if (pct > 0.40 && pct < 0.48) {
      y = 48;
      val = Math.max(1, displayRunning - 1);
    } else if (pct >= 0.48 && pct <= 0.50) {
      const f = (pct - 0.48) / 0.02;
      y = 48 - f * (48 - 31);
      val = f > 0.5 ? displayRunning : Math.max(1, displayRunning - 1);
    }

    const yPct = y / 130;
    setActiveHover({ pct, yPct, time: timeStr, value: `${val} active` });
  };

  // 3. Memory Usage Hover State - Needle spikes precisely mapped to line coordinates
  const [memoryHover, setMemoryHover] = useState<CardHoverData | null>(null);
  const handleMemoryMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeStr = formatTimeFromPct(pct);

    let val = '0 MB';
    let y = 116;

    const spikes = [
      { p: 0.12, r: 0.008, topY: 85, val: '86 MB' },
      { p: 0.28, r: 0.008, topY: 65, val: '124 MB' },
      { p: 0.48, r: 0.008, topY: 16, val: '486 MB' },
      { p: 0.62, r: 0.008, topY: 45, val: '312 MB' },
      { p: 0.78, r: 0.008, topY: 75, val: '98 MB' },
      { p: 0.90, r: 0.008, topY: 55, val: '245 MB' },
    ];

    for (const sp of spikes) {
      const dist = Math.abs(pct - sp.p);
      if (dist <= sp.r) {
        const factor = 1 - dist / sp.r;
        y = 116 - factor * (116 - sp.topY);
        val = sp.val;
        break;
      }
    }

    const yPct = y / 130;
    setMemoryHover({ pct, yPct, time: timeStr, value: val });
  };

  // 4. System Load Hover State - Continuous wave formula matching SVG curve
  const [sysLoadHover, setSysLoadHover] = useState<CardHoverData | null>(null);
  const handleSysLoadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeStr = formatTimeFromPct(pct);

    const wave = Math.sin(pct * Math.PI * 2.8) * 18 + Math.cos(pct * Math.PI * 1.5) * 10;
    const y = 92 - wave;
    const loadVal = Math.max(0.12, 0.28 + (wave / 100)).toFixed(2);

    const yPct = y / 130;
    setSysLoadHover({ pct, yPct, time: timeStr, value: loadVal });
  };

  // 5. Process Restarts Hover State - Flat baseline y=116 with 2 distinct reload pulses
  const [restartsHover, setRestartsHover] = useState<CardHoverData | null>(null);
  const handleRestartsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeStr = formatTimeFromPct(pct);

    let val = '0 restarts';
    let y = 116;

    const dist1 = Math.abs(pct - 0.35);
    const dist2 = Math.abs(pct - 0.68);

    if (dist1 <= 0.015) {
      const f = 1 - dist1 / 0.015;
      y = 116 - f * (116 - 56);
      val = '1 (axiom reload)';
    } else if (dist2 <= 0.015) {
      const f = 1 - dist2 / 0.015;
      y = 116 - f * (116 - 56);
      val = '1 (mail worker reload)';
    }

    const yPct = y / 130;
    setRestartsHover({ pct, yPct, time: timeStr, value: val });
  };

  // 6. Avg. Uptime Hover State - High baseline y=20 (99.98%) with slight dip at 43%
  const [uptimeHover, setUptimeHover] = useState<CardHoverData | null>(null);
  const handleUptimeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeStr = formatTimeFromPct(pct);

    let val = '99.98%';
    let y = 20;

    if (pct >= 0.38 && pct <= 0.48) {
      const dip = 1 - Math.abs((pct - 0.43) / 0.05);
      val = `${(99.98 - dip * 0.48).toFixed(2)}%`;
      y = 20 + dip * (65 - 20);
    } else if (pct > 0.88) {
      val = '100.0%';
      y = 14;
    }

    const yPct = y / 130;
    setUptimeHover({ pct, yPct, time: timeStr, value: val });
  };

  return (
    <section className="w-full flex flex-col gap-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 w-full">
        <h3 className="text-white text-[15px] font-semibold tracking-tight">Analytics</h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-md bg-[#121212] hover:bg-[#181818] text-gray-300 border border-[#222222] transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256">
              <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
            </svg>
            <span>Last 24 hours</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center justify-center h-8 w-8 text-gray-400 hover:text-white rounded-md bg-[#121212] hover:bg-[#181818] border border-[#222222] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh metrics"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              fill="currentColor"
              viewBox="0 0 256 256"
              className={isLoading ? 'animate-spin' : ''}
            >
              <path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Top Row: 2 Wide Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {/* Card 1: CPU utilization */}
        <div className="relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c]">CPU utilization</span>
              <span className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-0.5">•••</span>
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

          {/* Chart row with pl-4 left padding and dynamic text-based right space */}
          <div className="relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="relative flex-1 h-full cursor-crosshair overflow-visible"
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
                <line x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

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
                <>
                  <div
                    className="absolute top-2 bottom-0 w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${cpuHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: `${cpuHover.pct * 100}%`, top: `${cpuHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none ${
                      cpuHover.pct > 0.5 ? '-translate-x-full pr-3' : 'pl-3'
                    }`}
                    style={{ left: `${cpuHover.pct * 100}%`, top: '16px' }}
                  >
                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[145px] max-w-xs">
                      <div className="text-xs font-semibold text-white mb-1 tabular-nums">{cpuHover.time}</div>
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4290F0' }}></span>
                          <span className="text-xs font-medium text-[#d4d4d8] truncate">CPU utilization</span>
                        </div>
                        <span className="text-xs font-semibold text-white shrink-0 tabular-nums">{cpuHover.value}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
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
        <div className="relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c]">Active processes</span>
              <span className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-0.5">•••</span>
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

          <div className="relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="relative flex-1 h-full cursor-crosshair overflow-visible"
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
                <line x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

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
                <>
                  <div
                    className="absolute top-2 bottom-0 w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${activeHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: `${activeHover.pct * 100}%`, top: `${activeHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none ${
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
                </>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
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
        <div className="relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c]">Memory usage</span>
              <span className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-0.5">•••</span>
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

          <div className="relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="relative flex-1 h-full cursor-crosshair overflow-visible"
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
                <line x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

                <path
                  d="M 0,116 L 118,116 L 120,85 L 122,116 L 278,116 L 280,65 L 282,116 L 478,116 L 480,16 L 482,116 L 618,116 L 620,45 L 622,116 L 778,116 L 780,75 L 782,116 L 898,116 L 900,55 L 902,116 L 1000,116 L 1000,126 L 0,126 Z"
                  fill="url(#mem-usage-grad)"
                  stroke="none"
                />
                <path
                  d="M 0,116 L 118,116 L 120,85 L 122,116 L 278,116 L 280,65 L 282,116 L 478,116 L 480,16 L 482,116 L 618,116 L 620,45 L 622,116 L 778,116 L 780,75 L 782,116 L 898,116 L 900,55 L 902,116 L 1000,116"
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
                <>
                  <div
                    className="absolute top-2 bottom-0 w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${memoryHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: `${memoryHover.pct * 100}%`, top: `${memoryHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none ${
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
                </>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
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
        <div className="relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c]">System load</span>
              <span className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-0.5">•••</span>
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

          <div className="relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="relative flex-1 h-full cursor-crosshair overflow-visible"
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
                <line x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

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
                <>
                  <div
                    className="absolute top-2 bottom-0 w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${sysLoadHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: `${sysLoadHover.pct * 100}%`, top: `${sysLoadHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none ${
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
                </>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
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
        <div className="relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c]">Process restarts</span>
              <span className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-0.5">•••</span>
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

          <div className="relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="relative flex-1 h-full cursor-crosshair overflow-visible"
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
                <line x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

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
                <>
                  <div
                    className="absolute top-2 bottom-0 w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${restartsHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: `${restartsHover.pct * 100}%`, top: `${restartsHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none ${
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
                </>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
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
        <div className="relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-[#8c8c8c]">Avg. uptime</span>
              <span className="text-[#555555] hover:text-gray-300 text-xs cursor-pointer font-bold leading-none p-0.5">•••</span>
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

          <div className="relative w-full h-[155px] mt-auto select-none flex items-stretch pl-4 pr-3 overflow-hidden">
            <div
              className="relative flex-1 h-full cursor-crosshair overflow-visible"
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
                <line x1="0" y1="14" x2="1000" y2="14" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="82" x2="1000" y2="82" stroke="#1c1c1c" strokeWidth="1" />
                <line x1="0" y1="116" x2="1000" y2="116" stroke="#262626" strokeWidth="1" />

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
                <>
                  <div
                    className="absolute top-2 bottom-0 w-px border-r border-dashed border-[#666666] pointer-events-none z-10"
                    style={{ left: `${uptimeHover.pct * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-[#2f80ed] border-[1.5px] border-white shadow-md pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: `${uptimeHover.pct * 100}%`, top: `${uptimeHover.yPct * 100}%` }}
                  />
                  <div
                    className={`absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none ${
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
                </>
              )}
            </div>

            {/* Y-Axis Labels: dynamically sized to text space */}
            <div className="relative shrink-0 pl-2.5 text-[11px] text-[#8c8c8c] text-right font-normal pointer-events-none select-none tabular-nums flex flex-col justify-between pt-[10px] pb-[10px]">
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
    </section>
  );
};
