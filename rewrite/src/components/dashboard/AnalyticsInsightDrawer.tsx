import React, { useEffect, useState } from 'react';

interface AnalyticsInsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HostInsight {
  host: string;
  color: string;
  count: string;
  pct: number;
}

const INSIGHT_HOSTS: HostInsight[] = [
  { host: 'axiom.toxichome.cc', color: 'rgb(238, 183, 32)', count: '243.04k', pct: 98.0581 },
  { host: 'cpcalendars.toxichome.top', color: 'rgb(232, 100, 157)', count: '1.01k', pct: 0.406288 },
  { host: 'webmail.toxichome.top', color: 'rgb(80, 195, 182)', count: '967', pct: 0.390149 },
  { host: 'api.toxichome.top', color: 'rgb(66, 144, 240)', count: '959', pct: 0.386921 },
  { host: 'toxichome.top', color: 'rgb(141, 88, 238)', count: '514', pct: 0.20738 },
];

const ALL_RANKED_HOSTS = [
  { host: 'axiom.toxichome.cc', pct: 98.0581, count: '243.04k' },
  { host: 'cpcalendars.toxichome.top', pct: 0.406288, count: '1.01k' },
  { host: 'webmail.toxichome.top', pct: 0.390149, count: '967' },
  { host: 'api.toxichome.top', pct: 0.386921, count: '959' },
  { host: 'toxichome.top', pct: 0.20738, count: '514' },
  { host: 'mail.toxichome.top', pct: 0.122653, count: '304' },
  { host: 'toxichome.cc', pct: 0.0831134, count: '206' },
  { host: 'watch.toxichome.cc', pct: 0.0810961, count: '201' },
  { host: 'autoconfig.toxichome.top', pct: 0.0282424, count: '70' },
  { host: 'www.axiom.toxichome.cc', pct: 0.027032, count: '67' },
  { host: 'cpanel.toxichome.top', pct: 0.0262251, count: '65' },
  { host: 'api.toxichome.cc', pct: 0.0225939, count: '56' },
];

export const AnalyticsInsightDrawer: React.FC<AnalyticsInsightDrawerProps> = ({ isOpen, onClose }) => {
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const [chartHover, setChartHover] = useState<{
    svgX: number;
    clientX: number;
    time: string;
    axiomVal: string;
    cpcalendarsVal: string;
    webmailVal: string;
    apiVal: string;
    toxichomeVal: string;
  } | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, relX));
    const pct = clampedX / rect.width;

    const now = new Date();
    const pointTime = new Date(now.getTime() - (1 - pct) * 24 * 60 * 60 * 1000);
    const day = pointTime.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[pointTime.getMonth()];
    const hh = String(pointTime.getHours()).padStart(2, '0');
    const mm = String(pointTime.getMinutes()).padStart(2, '0');
    const ss = String(pointTime.getSeconds()).padStart(2, '0');
    const timeStr = `${day} ${month}, ${hh}:${mm}:${ss}`;

    const svgX = pct * 860;

    // Peak calculation for axiom
    const peakPct = 0.69;
    const spikeWidth = 0.04;
    const dist = Math.abs(pct - peakPct);

    const peak2Pct = 0.82;
    const spike2Width = 0.03;
    const dist2 = Math.abs(pct - peak2Pct);

    let axiomCount = 4;
    if (dist <= spikeWidth) {
      const factor = 1 - dist / spikeWidth;
      axiomCount = Math.round(4 + factor * 142800);
    } else if (dist2 <= spike2Width) {
      const factor = 1 - dist2 / spike2Width;
      axiomCount = Math.round(4 + factor * 32000);
    } else {
      axiomCount = Math.round(4 + Math.sin(pct * 20) * 3);
    }

    const axiomStr = axiomCount >= 1000 ? `${(axiomCount / 1000).toFixed(2)}k` : `${axiomCount}`;
    const cpcalendarsStr = `${Math.max(0, Math.round(15 + Math.sin(pct * 15) * 8))}`;
    const webmailStr = `${Math.max(0, Math.round(12 + Math.cos(pct * 18) * 6))}`;
    const apiStr = `${Math.max(0, Math.round(11 + Math.sin(pct * 22) * 5))}`;
    const toxichomeStr = `${Math.max(0, Math.round(6 + Math.cos(pct * 12) * 4))}`;

    setChartHover({
      svgX,
      clientX: clampedX,
      time: timeStr,
      axiomVal: axiomStr,
      cpcalendarsVal: cpcalendarsStr,
      webmailVal: webmailStr,
      apiVal: apiStr,
      toxichomeVal: toxichomeStr,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Layer Container */}
      <div className="relative w-full max-w-[960px] h-full flex flex-col p-1.5 sm:p-3 pointer-events-auto z-10 animate-in slide-in-from-right duration-200 ease-out">
        {/* LayerCard matching conter.html */}
        <div
          className="rounded-lg ring-1 ring-[#262626] shadow-2xl bg-[#141414] flex w-full max-h-full flex-col overflow-hidden p-1.5 rounded-t-xl sm:rounded-[8px] border border-[#222222]"
          data-sentry-element="LayerCard"
        >
          {/* LayerDialogHeader */}
          <div
            className="relative flex items-center justify-between pl-3.5 pt-2 pb-3.5 pr-12 border-b border-[#1f1f1f]"
            data-sentry-component="LayerDialogHeader"
          >
            <h1 className="text-[#f3f4f6] text-base font-medium" id="base-ui-:r1sh:">
              Web Traffic
            </h1>
            <div className="absolute right-1.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-grid place-items-center size-6.5 rounded-lg bg-transparent hover:bg-[#222222] transition-colors cursor-pointer p-0 text-[#8c8c8c] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6821f]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                </svg>
              </button>
            </div>
          </div>

          {/* DrawerBase.Content / LayerDialogBody */}
          <div className="flex min-h-0 w-full flex-1 flex-col">
            <div
              className="relative flex flex-col gap-2 overflow-hidden rounded-lg bg-[#0c0c0c] p-4 text-inherit ring-1 ring-[#1f1f1f] px-4 py-4 min-h-0 flex-1 overflow-y-auto overscroll-contain"
              data-sentry-component="LayerDialogBody"
            >
              {/* Description */}
              <p className="text-[#8c8c8c] text-sm/[inherit]">
                Trend and leading contributors for the selected timeframe.
              </p>

              <div className="mt-3">
                <div className="flex flex-col gap-4" data-sentry-component="AnalyticsInsightRoot">
                  {/* Card 1: Requests by host over time (AnalyticsInsightTrend) */}
                  <div className="min-h-80" data-sentry-component="AnalyticsInsightTrend">
                    <div className="min-h-0 h-full">
                      <div
                        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-[#0e0e0e] ring-1 ring-[#222222] transition-colors hover:ring-[#2f2f2f]"
                        data-sentry-component="ChartCardStandard"
                      >
                        {/* Header */}
                        <div className="flex items-start gap-3 px-4 pt-3 pb-0.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <div className="min-w-0 truncate text-xs font-medium text-[#8c8c8c]" title="Requests by host over time">
                                Requests by host over time
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chart Body */}
                        <div className="min-h-0 flex-1 flex-col px-5 pt-0.5 pb-5">
                          <div className="flex h-full min-h-0 flex-col gap-2">
                            {/* Legend */}
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 select-none">
                              {INSIGHT_HOSTS.map((item) => {
                                const isDimmed = activeHost && activeHost !== item.host;
                                return (
                                  <div
                                    key={item.host}
                                    onClick={() => setActiveHost(activeHost === item.host ? null : item.host)}
                                    className={`flex min-h-6 max-w-[220px] items-center gap-1.5 overflow-hidden rounded-sm pr-0.5 text-xs select-none cursor-pointer transition-opacity ${
                                      isDimmed ? 'opacity-35' : 'opacity-100 hover:opacity-90'
                                    }`}
                                  >
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                      ></span>
                                      <span className="min-w-0 truncate text-[#8c8c8c]">{item.host}</span>
                                    </span>
                                    <span className="shrink-0 tabular-nums text-white font-medium ml-1">
                                      {item.count}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Multi-series Timeseries Line Chart */}
                            <div className="min-h-0 flex-1 mt-2">
                              <div
                                className="relative w-full h-[228px] cursor-crosshair select-none"
                                onMouseMove={handleChartMouseMove}
                                onMouseLeave={() => setChartHover(null)}
                              >
                                <svg
                                  className="w-full h-full block"
                                  viewBox="0 0 860 210"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient id="axiom-fill" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#eeb720" stopOpacity="0.25" />
                                      <stop offset="100%" stopColor="#eeb720" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>

                                  {/* Horizontal Grid lines */}
                                  <line x1="0" y1="20" x2="820" y2="20" stroke="#1c1c1c" strokeWidth="1" />
                                  <line x1="0" y1="65" x2="820" y2="65" stroke="#1c1c1c" strokeWidth="1" />
                                  <line x1="0" y1="110" x2="820" y2="110" stroke="#1c1c1c" strokeWidth="1" />
                                  <line x1="0" y1="155" x2="820" y2="155" stroke="#1c1c1c" strokeWidth="1" />
                                  <line x1="0" y1="195" x2="820" y2="195" stroke="#262626" strokeWidth="1" />

                                  {/* Series 0: axiom.toxichome.cc (gold #eeb720) with area & spike */}
                                  <path
                                    d="M 0,195 L 520,195 L 565,188 L 590,30 L 605,188 L 640,195 L 685,195 L 705,145 L 725,195 L 755,195 L 770,188 L 785,195 L 820,195 Z"
                                    fill="url(#axiom-fill)"
                                    opacity={activeHost && activeHost !== 'axiom.toxichome.cc' ? 0.2 : 1}
                                  />
                                  <path
                                    d="M 0,195 L 520,195 L 565,188 L 590,30 L 605,188 L 640,195 L 685,195 L 705,145 L 725,195 L 755,195 L 770,188 L 785,195 L 820,195"
                                    fill="none"
                                    stroke="rgb(238, 183, 32)"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    opacity={activeHost && activeHost !== 'axiom.toxichome.cc' ? 0.25 : 1}
                                  />

                                  {/* Series 1: cpcalendars.toxichome.top (pink #e8649d) */}
                                  <path
                                    d="M 0,193 Q 200,192 400,194 T 600,193 T 820,194"
                                    fill="none"
                                    stroke="rgb(232, 100, 157)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    opacity={activeHost && activeHost !== 'cpcalendars.toxichome.top' ? 0.25 : 1}
                                  />

                                  {/* Series 2: webmail.toxichome.top (teal #50c3b6) */}
                                  <path
                                    d="M 0,194 Q 250,193 500,194 T 820,193"
                                    fill="none"
                                    stroke="rgb(80, 195, 182)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    opacity={activeHost && activeHost !== 'webmail.toxichome.top' ? 0.25 : 1}
                                  />

                                  {/* Series 3: api.toxichome.top (blue #4290f0) */}
                                  <path
                                    d="M 0,194.5 Q 300,193.5 600,194 T 820,194"
                                    fill="none"
                                    stroke="rgb(66, 144, 240)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    opacity={activeHost && activeHost !== 'api.toxichome.top' ? 0.25 : 1}
                                  />

                                  {/* Series 4: toxichome.top (purple #8d58ee) */}
                                  <path
                                    d="M 0,194.8 L 820,194.8"
                                    fill="none"
                                    stroke="rgb(141, 88, 238)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    opacity={activeHost && activeHost !== 'toxichome.top' ? 0.25 : 1}
                                  />

                                  {/* Hover guideline and dots */}
                                  {chartHover && (
                                    <>
                                      <line
                                        x1={chartHover.svgX}
                                        y1="20"
                                        x2={chartHover.svgX}
                                        y2="195"
                                        stroke="#666666"
                                        strokeWidth="1"
                                        strokeDasharray="3 3"
                                      />
                                      {/* Tracking circle on gold curve */}
                                      <circle
                                        cx={chartHover.svgX}
                                        cy={
                                          Math.abs(chartHover.svgX - 590) < 30
                                            ? 30 + Math.abs(chartHover.svgX - 590) * 5
                                            : Math.abs(chartHover.svgX - 705) < 20
                                            ? 145 + Math.abs(chartHover.svgX - 705) * 2.5
                                            : 195
                                        }
                                        r="4"
                                        fill="rgb(238, 183, 32)"
                                        stroke="#ffffff"
                                        strokeWidth="1.5"
                                      />
                                    </>
                                  )}
                                </svg>

                                {/* Right Y-Axis labels */}
                                <div className="absolute right-0 top-0 bottom-0 pointer-events-none select-none text-[10.5px] text-[#8c8c8c] text-right font-normal">
                                  <span className="absolute right-1 -translate-y-1/2 tabular-nums" style={{ top: '9.5%' }}>
                                    250k
                                  </span>
                                  <span className="absolute right-1 -translate-y-1/2 tabular-nums" style={{ top: '31%' }}>
                                    200k
                                  </span>
                                  <span className="absolute right-1 -translate-y-1/2 tabular-nums" style={{ top: '52.5%' }}>
                                    100k
                                  </span>
                                  <span className="absolute right-1 -translate-y-1/2 tabular-nums" style={{ top: '74%' }}>
                                    50k
                                  </span>
                                  <span className="absolute right-1 -translate-y-1/2 tabular-nums" style={{ top: '93%' }}>
                                    0
                                  </span>
                                </div>

                                {/* Interactive Hover Tooltip */}
                                {chartHover && (
                                  <div
                                    className="absolute pointer-events-none z-30 transition-transform duration-75 ease-out"
                                    style={{
                                      left: chartHover.clientX > 480 ? `${chartHover.clientX - 230}px` : `${chartHover.clientX + 16}px`,
                                      top: '15px',
                                    }}
                                  >
                                    <div className="bg-[#121212] rounded-lg shadow-2xl shadow-black/80 border border-[#2a2a2a] p-2.5 min-w-[210px] select-none text-xs">
                                      <div className="font-semibold text-white mb-1.5 tabular-nums pb-1 border-b border-[#222222]">
                                        {chartHover.time}
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: 'rgb(238, 183, 32)' }} />
                                            <span className="text-[#d4d4d8] truncate">axiom.toxichome.cc</span>
                                          </div>
                                          <span className="font-semibold text-white tabular-nums">{chartHover.axiomVal}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: 'rgb(232, 100, 157)' }} />
                                            <span className="text-[#8c8c8c] truncate">cpcalendars.toxichome.top</span>
                                          </div>
                                          <span className="font-semibold text-white tabular-nums">{chartHover.cpcalendarsVal}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: 'rgb(80, 195, 182)' }} />
                                            <span className="text-[#8c8c8c] truncate">webmail.toxichome.top</span>
                                          </div>
                                          <span className="font-semibold text-white tabular-nums">{chartHover.webmailVal}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: 'rgb(66, 144, 240)' }} />
                                            <span className="text-[#8c8c8c] truncate">api.toxichome.top</span>
                                          </div>
                                          <span className="font-semibold text-white tabular-nums">{chartHover.apiVal}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: 'rgb(141, 88, 238)' }} />
                                            <span className="text-[#8c8c8c] truncate">toxichome.top</span>
                                          </div>
                                          <span className="font-semibold text-white tabular-nums">{chartHover.toxichomeVal}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Top hosts (AnalyticsInsightBreakdown) */}
                  <div className="min-h-72" data-sentry-component="AnalyticsInsightBreakdown">
                    <div className="h-full min-h-72">
                      <div
                        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-[#0e0e0e] ring-1 ring-[#222222] transition-colors hover:ring-[#2f2f2f]"
                        data-sentry-component="ChartCardStandard"
                      >
                        {/* Header */}
                        <div className="flex items-start gap-3 px-4 pt-3 pb-0.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <div className="min-w-0 truncate text-xs font-medium text-[#8c8c8c]" title="Top hosts">
                                Top hosts
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ranked List Body matching conter.html */}
                        <div className="min-h-0 flex-1 flex-col overflow-hidden">
                          <div
                            className="w-full py-1"
                            data-sentry-component="RankedListChartBody"
                          >
                            <ol className="ml-0">
                              {ALL_RANKED_HOSTS.map((item) => (
                                <li
                                  key={item.host}
                                  data-slot="ranked-list-row"
                                  className="relative grid list-none cursor-default items-center gap-x-3 px-4 py-1.5 hover:bg-[#161616]/70 transition-colors"
                                  style={{
                                    gridTemplateColumns: 'minmax(0px, 3fr) minmax(0px, 2fr) minmax(8rem, max-content)',
                                  }}
                                >
                                  {/* Col 1: Host Link */}
                                  <span className="truncate text-sm font-medium text-white" title={item.host}>
                                    <a
                                      data-kumo-component="Link"
                                      className="text-[#f6821f] hover:text-[#f6821f]/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                      href={`https://${item.host}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {item.host}
                                    </a>
                                  </span>

                                  {/* Col 2: Proportion Bar */}
                                  <div className="flex w-full items-center" style={{ height: '20px' }}>
                                    <div
                                      className="h-1.5 w-full rounded-full bg-[#1c1c1c]"
                                      data-sentry-component="ProportionBar"
                                    >
                                      <div
                                        className="h-1.5 rounded-full bg-[#f6821f]"
                                        style={{ width: `${Math.max(item.pct, 0.4)}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Col 3: Tabular Count */}
                                  <span className="text-right text-sm whitespace-nowrap tabular-nums text-white font-medium">
                                    {item.count}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
