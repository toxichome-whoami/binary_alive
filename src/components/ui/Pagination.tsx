import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  onPageChange,
  isLoading = false,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#0e0e0e] border-t border-[#222222] text-[13px] select-none">
      <div className="text-[#8c8c8c] text-[13px]">
        Page <span className="font-medium font-mono text-white">{page}</span> of{' '}
        <span className="font-medium font-mono text-white">{totalPages}</span>{' '}
        <span className="text-[#666666]">
          ({total} total records)
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#262626] bg-transparent text-[13px] font-medium text-[#cccccc] hover:text-white hover:bg-[#141414] hover:border-[#383838] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#262626] bg-transparent text-[13px] font-medium text-[#cccccc] hover:text-white hover:bg-[#141414] hover:border-[#383838] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
