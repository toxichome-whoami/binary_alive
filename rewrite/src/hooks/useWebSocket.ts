import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWsStore } from '../store/wsStore';
import { useProcessStore } from '../store/processStore';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;

export function useWebSocketInit() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setConnected = useWsStore((s) => s.setConnected);
  const setOnlineStatus = useWsStore((s) => s.setOnlineStatus);
  const setOnlineUsers = useWsStore((s) => s.setOnlineUsers);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }

    let reconnectAttempts = 0;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
      
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
            setUser(null); // Force immediate logout
            window.location.href = '/login';
          } 
          else if (data.type === 'PERMISSIONS_UPDATED') {
            setUser({ ...user, permissions: data.permissions });
          }
          else if (data.type === 'PROCESS_STATS') {
            useProcessStore.getState().setStats(data.data, data.sys_load);
          }
          else if (data.type === 'PRESENCE_CHANGE') {
            setOnlineStatus(data.userId, data.isOnline);
          }
          else if (data.type === 'PRESENCE_SYNC') {
            setOnlineUsers(data.users);
          }
        } catch (err) {
          console.error('Failed to parse WS message', err);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;
        
        // Don't auto-reconnect if it was a normal closure (e.g. background suspend) or auth failure (1008)
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
        // Suspend logic: disconnect after 30 seconds of being in the background
        timeoutRef.current = setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.close(1000, 'Background suspend');
          }
        }, 30000);
      } else {
        // Clear suspend timer if we focus back before 30 seconds
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        // Instantly reconnect if we were disconnected
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Unmount');
        wsRef.current = null;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setConnected(false);
    };
  }, [user]); // user object change handles login/logout boundary
}
