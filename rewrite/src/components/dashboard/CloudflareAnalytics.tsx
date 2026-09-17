import React, { useState, useMemo, useRef, useEffect } from 'react';
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

const DATE_PRESETS = [
  { label: 'Last 30 minutes', minutes: 30 },
  { label: 'Last 1 hour', minutes: 60 },
  { label: 'Last 6 hours', minutes: 360 },
  { label: 'Last 12 hours', minutes: 720 },
  { label: 'Last 24 hours', minutes: 1440 },
  { label: 'Last 7 days', minutes: 10080 },
  { label: 'Last 30 days', minutes: 43200 },
];

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
  // Date Range Popover State (extracted from conter.html)
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('Last 24 hours');
  const [activePreset, setActivePreset] = useState('Last 24 hours');
  const [customRangeQuery, setCustomRangeQuery] = useState('');

  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => new Date());

  // Close when clicking outside
  useEffect(() => {
    if (!showDatePicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  const formatDateTime = (d: Date | null) => {
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSelectPreset = (label: string, minutes: number) => {
    setActivePreset(label);
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    setRangeStart(start);
    setRangeEnd(end);
    setCurrentMonthDate(end);
  };

  const handleDayClick = (dayDate: Date) => {
    setActivePreset('');
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dayDate);
      setRangeEnd(null as any);
    } else {
      if (dayDate < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(dayDate);
      } else {
        setRangeEnd(dayDate);
      }
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; dayNum: number }[] = [];

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({ date: d, isCurrentMonth: false, dayNum: prevMonthDays - i });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, dayNum: i });
    }

    // Next month leading days to complete 42 cells (6 rows * 7 cols)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, dayNum: i });
    }

    return days;
  }, [currentMonthDate]);

  const isSelectedStart = (d: Date) =>
    rangeStart && d.toDateString() === rangeStart.toDateString();

  const isSelectedEnd = (d: Date) =>
    rangeEnd && d.toDateString() === rangeEnd.toDateString();

  const isInRange = (d: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    return d > rangeStart && d < rangeEnd;
  };

  const isToday = (d: Date) =>
    d.toDateString() === new Date().toDateString();

  const userTimezone = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMinutes = -new Date().getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const mins = Math.abs(offsetMinutes) % 60;
      const offsetStr = `GMT${sign}${hours}${mins ? ':' + String(mins).padStart(2, '0') : ''}`;
      return `${tz.replace(/_/g, ' ')} (${offsetStr})`;
    } catch {
      return 'Bangladesh Standard Time (GMT+6)';
    }
  }, []);

  const handleApplyDateRange = () => {
    if (activePreset) {
      setSelectedRangeLabel(activePreset);
    } else if (rangeStart && rangeEnd) {
      const startStr = rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = rangeEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      setSelectedRangeLabel(`${startStr} – ${endStr}`);
    } else if (rangeStart) {
      setSelectedRangeLabel(rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
    setShowDatePicker(false);
  };

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
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker((prev) => !prev)}
              className={`flex items-center gap-2 h-9 px-3 text-[14px] font-normal rounded-lg transition-colors cursor-pointer shrink-0 border ${
                showDatePicker
                  ? 'border-[#444444] text-white bg-[#141414]'
                  : 'border-[#262626] text-white hover:bg-[#141414] hover:border-[#383838] bg-transparent'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
                <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
              </svg>
              <span>{selectedRangeLabel}</span>
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-11 z-50 flex flex-col rounded-xl bg-[#0c0c0c] border border-[#262626] shadow-2xl p-1.5 w-[560px] max-w-[calc(100vw-32px)] select-none font-sans animate-in fade-in">
                <div className="min-h-0 bg-[#0e0e0e] border border-[#222222] rounded-lg overflow-hidden">
                  {/* Top input: Custom range */}
                  <div className="border-b border-[#222222]">
                    <input
                      type="text"
                      value={customRangeQuery}
                      onChange={(e) => setCustomRangeQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (customRangeQuery.trim()) {
                            setSelectedRangeLabel(customRangeQuery.trim());
                            setShowDatePicker(false);
                          } else {
                            handleApplyDateRange();
                          }
                        }
                      }}
                      placeholder="Custom range: 3h, 3 hours, 3 m..."
                      className="outline-none border-none ring-0 w-full px-3.5 py-2.5 bg-transparent text-[14px] text-white placeholder-[#555555] font-sans"
                    />
                  </div>

                  {/* Calendar + Presets Container */}
                  <div className="flex flex-col sm:flex-row">
                    {/* Left: Calendar (the date pick - 13px) */}
                    <div className="mx-auto shrink-0 px-4 py-2 sm:mx-0 select-none">
                      {/* Nav bar */}
                      <div className="flex items-center justify-between py-1.5 px-0.5">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="w-7 h-7 flex items-center justify-center rounded text-[#8c8c8c] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                          aria-label="Previous Month"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
                          </svg>
                        </button>
                        <span className="text-[14px] font-medium text-white font-sans">
                          {currentMonthDate.toLocaleString('default', { month: 'long' })} {currentMonthDate.getFullYear()}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="w-7 h-7 flex items-center justify-center rounded text-[#8c8c8c] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                          aria-label="Next Month"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
                          </svg>
                        </button>
                      </div>

                      {/* Month Grid Table */}
                      <table role="grid" className="w-full border-collapse">
                        <thead>
                          <tr>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                              <th key={d} className="w-8 h-8 text-[13px] font-medium text-[#666666] text-center font-sans">
                                {d}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 6 }).map((_, rowIdx) => (
                            <tr key={rowIdx}>
                              {calendarDays.slice(rowIdx * 7, rowIdx * 7 + 7).map((item, colIdx) => {
                                const isStart = isSelectedStart(item.date);
                                const isEnd = isSelectedEnd(item.date);
                                const inRange = isInRange(item.date);
                                const today = isToday(item.date);

                                let cellBg = '';
                                let textClass = item.isCurrentMonth ? 'text-[#e0e0e0]' : 'text-[#444444]';
                                let roundedClass = 'rounded-md';

                                if (isStart && isEnd) {
                                  cellBg = 'bg-[#2f80ed] text-white font-semibold';
                                  roundedClass = 'rounded-md';
                                } else if (isStart) {
                                  cellBg = 'bg-[#2f80ed] text-white font-semibold';
                                  roundedClass = 'rounded-l-md rounded-r-none';
                                } else if (isEnd) {
                                  cellBg = 'bg-[#2f80ed] text-white font-semibold';
                                  roundedClass = 'rounded-r-md rounded-l-none';
                                } else if (inRange) {
                                  cellBg = 'bg-[#2f80ed]/20 text-white';
                                  roundedClass = 'rounded-none';
                                }

                                return (
                                  <td key={colIdx} className="p-0 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDayClick(item.date)}
                                      className={`w-8 h-8 flex items-center justify-center text-[13px] transition-colors cursor-pointer font-sans ${cellBg} ${roundedClass} ${
                                        !isStart && !isEnd && !inRange ? 'hover:bg-[#1f1f1f]' : ''
                                      } ${textClass} ${today && !isStart && !isEnd ? 'ring-1 ring-[#555555]' : ''}`}
                                    >
                                      {item.dayNum}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Right: Presets List (14px) */}
                    <div className="relative w-full border-t border-[#222222] sm:w-[190px] sm:shrink-0 sm:border-t-0 sm:border-l border-[#222222] p-2 flex flex-col gap-0.5">
                      {DATE_PRESETS.map((preset) => {
                        const isSelected = activePreset === preset.label;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleSelectPreset(preset.label, preset.minutes)}
                            className={`flex w-full px-2.5 py-1.5 text-[14px] rounded-md items-center justify-between text-left transition-colors cursor-pointer font-sans ${
                              isSelected
                                ? 'bg-[#1f1f1f] text-white font-medium'
                                : 'text-[#b0b0b0] hover:text-white hover:bg-[#161616]'
                            }`}
                          >
                            <span>{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start & End Inputs (14px) */}
                  <div className="border-t border-[#222222] p-3 flex flex-col gap-2">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {/* Start */}
                      <div className="flex min-w-0 flex-col w-full sm:w-1/2">
                        <label className="text-[#8c8c8c] text-[14px] mb-1 font-sans">Start</label>
                        <div className="flex items-center h-9 px-2.5 rounded-lg bg-[#141414] border border-[#262626] focus-within:border-[#2f80ed] transition-colors gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
                            <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z" />
                          </svg>
                          <input
                            type="text"
                            value={formatDateTime(rangeStart)}
                            onChange={() => {}}
                            placeholder="yyyy-MM-dd HH:mm"
                            className="w-full bg-transparent text-[14px] text-white outline-none font-sans"
                          />
                        </div>
                      </div>

                      {/* End */}
                      <div className="flex min-w-0 flex-col w-full sm:w-1/2">
                        <label className="text-[#8c8c8c] text-[14px] mb-1 font-sans">End</label>
                        <div className="flex items-center h-9 px-2.5 rounded-lg bg-[#141414] border border-[#262626] focus-within:border-[#2f80ed] transition-colors gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
                            <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z" />
                          </svg>
                          <input
                            type="text"
                            value={formatDateTime(rangeEnd)}
                            onChange={() => {}}
                            placeholder="yyyy-MM-dd HH:mm"
                            className="w-full bg-transparent text-[14px] text-white outline-none font-sans"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Bar: Timezone + Apply button (14px) */}
                  <div className="border-t border-[#222222] p-3 flex flex-wrap items-center justify-between gap-2 bg-[#0c0c0c]">
                    <div className="flex items-center gap-1.5 text-[14px] text-[#8c8c8c] hover:text-white transition-colors font-sans">
                      <span className="truncate max-w-[280px]">{userTimezone}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-[#666666]">
                        <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
                      </svg>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyDateRange}
                      className="h-9 px-6 rounded-lg bg-[#2f80ed] hover:bg-[#2563eb] text-white text-[14px] font-medium transition-colors cursor-pointer shadow-sm ml-auto font-sans"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
        <div className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
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
        <div className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
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
        <div className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
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
        <div className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
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
        <div className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
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
        <div className="analytics-card relative flex flex-col justify-between rounded-lg bg-[#0e0e0e] border border-[#222222] hover:border-[#383838] transition-colors h-[241px] overflow-hidden">
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
    </section>
  );
};
