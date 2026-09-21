import React, { useState, useMemo, useRef, useEffect } from 'react';
import { processesApi } from '../../api/processes';


export const DATE_PRESETS = [
  { label: 'Live (60s)', minutes: 0 },
  { label: 'Last 30 minutes', minutes: 30 },
  { label: 'Last 1 hour', minutes: 60 },
  { label: 'Last 6 hours', minutes: 360 },
  { label: 'Last 12 hours', minutes: 720 },
  { label: 'Last 24 hours', minutes: 1440 },
  { label: 'Last 7 days', minutes: 10080 },
  { label: 'Last 30 days', minutes: 43200 },
];

export interface DateRangePickerProps {
  selectedRangeLabel?: string;
  onRangeChange?: (label: string, start?: Date, end?: Date) => void;
  className?: string;
  minDate?: Date | null;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  selectedRangeLabel: initialLabel = 'Live (60s)',
  onRangeChange,
  className = '',
  minDate = null,
}) => {
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedRangeLabel, setSelectedRangeLabel] = useState(initialLabel);
  const [activePreset, setActivePreset] = useState(initialLabel);
  
  const [customRangeQuery, setCustomRangeQuery] = useState('');

  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(() => {
    if (initialLabel === 'Live (60s)') return null;
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d;
  });
  const [rangeEnd, setRangeEnd] = useState<Date | null>(() => {
    if (initialLabel === 'Live (60s)') return null;
    return new Date();
  });

  // Close when clicking outside
  useEffect(() => {
    if (!showDatePicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDatePicker]);

  const formatDateTime = (d: Date | null) => {
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSelectPreset = (label: string, minutes: number) => {
    setActivePreset(label);
    if (label === 'Live (60s)') {
      setRangeStart(null);
      setRangeEnd(null);
      setSelectedRangeLabel('Live (60s)');
      setShowDatePicker(false);
      onRangeChange?.('Live (60s)', undefined, undefined);
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    setRangeStart(start);
    setRangeEnd(end);
    setCurrentMonthDate(end);
    
    setSelectedRangeLabel(label);
    setShowDatePicker(false);
    onRangeChange?.(label, start, end);
  };


  const handleDayClick = (dayDate: Date) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dayDate > today) return;
    if (minDate && dayDate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return;

    setActivePreset('');
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dayDate);
      setRangeEnd(null as any);
    } else {
      if (dayDate < rangeStart) {
        const newEnd = new Date(rangeStart);
        newEnd.setHours(23, 59, 59, 999);
        setRangeEnd(newEnd);
        setRangeStart(dayDate);
      } else {
        const newEnd = new Date(dayDate);
        newEnd.setHours(23, 59, 59, 999);
        setRangeEnd(newEnd);
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
    Boolean(rangeStart && d.toDateString() === rangeStart.toDateString());

  const isSelectedEnd = (d: Date) =>
    Boolean(rangeEnd && d.toDateString() === rangeEnd.toDateString());

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
    let newLabel = selectedRangeLabel;
    if (activePreset) {
      newLabel = activePreset;
    } else if (rangeStart && rangeEnd) {
      const startStr = rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = rangeEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      newLabel = `${startStr} – ${endStr}`;
    } else if (rangeStart) {
      newLabel = rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    setSelectedRangeLabel(newLabel);
    setShowDatePicker(false);
    onRangeChange?.(newLabel, rangeStart || undefined, rangeEnd || undefined);
  };

  return (
    <div className={`relative ${className}`} ref={datePickerRef}>
      <button
        type="button"
        onClick={() => setShowDatePicker((prev) => !prev)}
        className={`flex items-center gap-2 h-9 px-3 text-[14px] font-normal rounded-lg transition-colors cursor-pointer shrink-0 border font-sans ${
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
        <div className="absolute right-0 top-11 z-50 flex flex-col rounded-[8px] bg-[#0c0c0c] border border-[#262626] shadow-2xl p-1.5 w-[490px] sm:w-[500px] max-w-[calc(100vw-32px)] select-none font-sans animate-in fade-in">
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
                      const trimmed = customRangeQuery.trim();
                      setSelectedRangeLabel(trimmed);
                      setShowDatePicker(false);
                      onRangeChange?.(trimmed);
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
              {/* Left: Calendar */}
              <div className="flex-1 min-w-0 p-3 sm:p-3.5 select-none">
                {/* Nav bar: Month name on left, arrows on right */}
                <div className="flex items-center justify-between pb-2 pt-0.5 px-0.5">
                  <span className="text-[14px] font-medium text-white font-sans">
                    {currentMonthDate.toLocaleString('default', { month: 'long' })} {currentMonthDate.getFullYear()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-7 h-7 flex items-center justify-center rounded text-[#8c8c8c] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                      aria-label="Previous Month"
                      title="Previous month"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-7 h-7 flex items-center justify-center rounded text-[#8c8c8c] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                      aria-label="Next Month"
                      title="Next month"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Month Grid Table */}
                <table role="grid" className="w-full border-collapse table-fixed">
                  <thead>
                    <tr>
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                        <th key={d} className="h-8 text-[13px] font-medium text-[#666666] text-center font-sans">
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
                              
                              {(() => {
                                let isDisabled = false;
                                const todayDate = new Date();
                                const todayStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                                const itemStart = new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate());
                                
                                if (itemStart > todayStart) isDisabled = true;
                                
                                if (minDate) {
                                  const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                                  if (itemStart < minDay) isDisabled = true;
                                }
                                
                                if (isDisabled) {
                                  textClass = 'text-[#333333]';
                                  return (
                                    <button
                                      type="button"
                                      disabled
                                      className={`w-full h-8 sm:h-8.5 flex items-center justify-center text-[13px] cursor-not-allowed font-sans ${textClass}`}
                                    >
                                      {item.dayNum}
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleDayClick(item.date)}
                                    className={`w-full h-8 sm:h-8.5 flex items-center justify-center text-[13px] transition-colors cursor-pointer font-sans ${cellBg} ${roundedClass} ${
                                      !isStart && !isEnd && !inRange ? 'hover:bg-[#1f1f1f]' : ''
                                    } ${textClass} ${today && !isStart && !isEnd ? 'ring-1 ring-[#555555]' : ''}`}
                                  >
                                    {item.dayNum}
                                  </button>
                                );
                              })()}

                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right: Presets List */}
              <div className="relative w-full border-t sm:w-[154px] sm:shrink-0 sm:border-t-0 sm:border-l border-[#222222] p-1.5 flex flex-col gap-0.5 justify-center">
                {DATE_PRESETS.map((preset) => {
                  const isSelected = activePreset === preset.label;
                  let isDisabled = false;
                  if (minDate && preset.minutes > 0) {
                    const presetStart = new Date(Date.now() - preset.minutes * 60 * 1000);
                    if (presetStart < minDate) {
                      isDisabled = true;
                    }
                  }
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectPreset(preset.label, preset.minutes)}
                      className={`flex w-full px-2.5 py-1.5 text-[14px] rounded-md items-center justify-between text-left transition-colors font-sans whitespace-nowrap ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed text-[#555]'
                          : isSelected
                            ? 'bg-[#1f1f1f] text-white font-medium cursor-pointer'
                            : 'text-[#a0a0a0] hover:text-white hover:bg-[#161616] cursor-pointer'
                      }`}
                      title={isDisabled ? 'No data available for this range' : ''}
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
                      readOnly
                      placeholder="yyyy-MM-dd HH:mm"
                      className="w-full bg-transparent text-[14px] text-white outline-none font-sans cursor-default opacity-80"
                    />
                  </div>
                </div>

                {/* End */}
                <div className="flex min-w-0 flex-col w-full sm:w-1/2">
                  <label className="text-[#8c8c8c] text-[14px] mb-1 font-sans">End</label>
                  <div className="flex items-center h-9 px-2.5 rounded-lg bg-[#141414] border border-[#262626] focus-within:border-[#2f80ed] transition-colors gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256" className="text-[#8c8c8c] shrink-0">
                      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132Zm96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z" />
                    </svg>
                      <input
                        type="text"
                        value={formatDateTime(rangeEnd)}
                        readOnly
                        placeholder="yyyy-MM-dd HH:mm"
                        className="w-full bg-transparent text-[14px] text-white outline-none font-sans cursor-default opacity-80"
                      />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Bar: Timezone + Apply button (14px) */}
            <div className="border-t border-[#222222] p-3 flex flex-wrap items-center justify-between gap-2 bg-[#0c0c0c]">
              <div className="flex items-center gap-1.5 text-[14px] text-[#8c8c8c] font-sans">
                <span className="truncate max-w-[280px]">Local Time: {userTimezone}</span>
              </div>
              <button
                type="button"
                onClick={handleApplyDateRange}
                className="group relative flex shrink-0 items-center justify-center h-9 px-6 rounded-lg font-medium text-white shadow-xs outline-none cursor-pointer overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] ml-auto font-sans"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                <span className="relative flex items-center gap-1.5 text-[14px]">
                  Apply
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
