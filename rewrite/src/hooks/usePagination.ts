import { useState, useCallback } from 'react';

export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(initialLimit);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    setPage,
    limit,
    setLimit,
    reset,
  };
}
