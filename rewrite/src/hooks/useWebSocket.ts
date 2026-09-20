import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWsStore } from '../store/wsStore';
import { useProcessStore } from '../store/processStore';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;

export function useWebSocketInit() {
  const user = useAuthStore((s) => s.user);
  const setConnected = useWsStore((s) => s.setConnected);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Unmount');
        wsRef.current = null;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      setConnected(false);
    };
  }, []);

  // Connect/disconnect based on login state (user.id, not the whole user object)
  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Logged out');
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }

    // Already connected — don't reconnect just because permissions changed
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    let reconnectAttempts = 0;

    const connect = () => {
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      )
        return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'USER_DISABLED') {
            // Read fresh from store — never stale
            useAuthStore.getState().setUser(null);
            window.location.href = '/login';
          } else if (data.type === 'USERS_REFRESH') {
            window.dispatchEvent(new CustomEvent('users-refresh', { detail: data }));
          } else if (data.type === 'PERMISSIONS_UPDATED') {
            const fresh = useAuthStore.getState().user;
            if (fresh) {
              useAuthStore.getState().setUser({ ...fresh, permissions: data.permissions });
              // Also refresh the users table so permission counts update for the admin
              window.dispatchEvent(new CustomEvent('users-refresh', { detail: { targetUserId: fresh.id } }));
            }
          } else if (data.type === 'PROCESS_STATS') {
            useProcessStore.getState().setStats(data.data, data.sys_load);
          } else if (data.type === 'PRESENCE_CHANGE') {
            useWsStore.getState().setOnlineStatus(data.userId, data.isOnline);
          } else if (data.type === 'PRESENCE_SYNC') {
            useWsStore.getState().setOnlineUsers(data.users);
          } else if (data.type === 'SETTING_UPDATED') {
            window.dispatchEvent(new CustomEvent('settings-refresh', { detail: data }));
            if (data.key === 'maintenance_mode' && data.value === '1') {
              const u = useAuthStore.getState().user;
              if (u && u.role !== 'owner' && !u.permissions?.settings_maintenance) {
                 useAuthStore.getState().setUser(null);
                 window.location.href = '/login';
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse WS message', err);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;

        // Don't auto-reconnect on clean close or auth failure
        if (event.code !== 1000 && event.code !== 1008) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectAttempts++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        timeoutRef.current = setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.close(1000, 'Background suspend');
          }
        }, 30000);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Only re-run when user logs in/out — NOT on every user object change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
