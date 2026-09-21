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
      } catch (err: any) {
        if (isMounted) {
          if (err?.status === 401 || err?.status === 403) {
            setUser(null);
          }
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

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetUserId = customEvent.detail?.targetUserId;
      // If the event specifically targets someone else, don't refetch our own auth state
      if (targetUserId && targetUserId !== useAuthStore.getState().user?.id) {
        return;
      }
      checkAuth();
    };

    window.addEventListener('users-refresh', handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener('users-refresh', handleRefresh);
    };
  }, [setUser, setLoading, isLoading]);

  return { user, isLoading };
}
