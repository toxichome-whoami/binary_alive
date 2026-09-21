import { useState, useCallback } from 'react';

export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(initialLimit);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  const setPageClamped = useCallback((p: number | ((prev: number) => number)) => {
    setPage(prev => {
      const next = typeof p === 'function' ? p(prev) : p;
      return Math.max(1, next);
    });
  }, []);

  const setLimitClamped = useCallback((l: number | ((prev: number) => number)) => {
    setLimit(prev => {
      const next = typeof l === 'function' ? l(prev) : l;
      return Math.min(100, Math.max(1, next));
    });
    setPage(1); // Reset page on limit change
  }, []);

  return {
    page,
    setPage: setPageClamped,
    limit,
    setLimit: setLimitClamped,
    reset,
  };
}
