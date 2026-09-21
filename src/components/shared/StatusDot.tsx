import React from 'react';

interface StatusDotProps {
  status: 'running' | 'stopped' | 'crashed';
  showLabel?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, showLabel = true }) => {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        {showLabel && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Running</span>}
      </span>
    );
  }

  if (status === 'crashed') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-600"></span>
        {showLabel && <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Crashed</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
      {showLabel && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stopped</span>}
    </span>
  );
};
