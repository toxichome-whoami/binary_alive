import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const res = await authApi.me();
        if (isMounted && res.success && res.data?.user) {
          setUser(res.data.user);
        } else if (isMounted) {
          setUser(null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (isLoading) {
      checkAuth();
    }

    return () => {
      isMounted = false;
    };
  }, [setUser, setLoading, isLoading]);

  return { user, isLoading };
}
