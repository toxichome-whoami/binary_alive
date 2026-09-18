import { useEffect } from 'react';
import { useAuthStore, DEV_ADMIN } from '../store/authStore';
import { authApi } from '../api/auth';

export function useAuth() {
  const { user, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const res = await authApi.me();
        if (isMounted && res.success && res.data?.user) {
          setUser(res.data.user);
        }
      } catch {
        // Retain dev admin
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [setUser, setLoading]);

  return { user: user || DEV_ADMIN, isLoading: false };
}
