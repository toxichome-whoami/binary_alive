import { createNodeWebSocket } from '@hono/node-ws';


// We'll initialize this later by passing the Hono app instance
let upgradeWebSocket: any;
let injectWebSocket: any;

export function initWebSocket(app: any) {
  const wsParts = createNodeWebSocket({ app });
  upgradeWebSocket = wsParts.upgradeWebSocket;
  injectWebSocket = wsParts.injectWebSocket;
  return wsParts;
}

export function getUpgradeWebSocket() {
  if (!upgradeWebSocket) throw new Error('WebSocket not initialized');
  return upgradeWebSocket;
}

export function getInjectWebSocket() {
  if (!injectWebSocket) throw new Error('WebSocket not initialized');
  return injectWebSocket;
}

// Presence store: userId -> Set of WebSocket connections
export const connectedUsers = new Map<number, Set<any>>();

export function broadcastUserStatusChange(userId: number, isOnline: boolean) {
  const payload = JSON.stringify({ type: 'PRESENCE_CHANGE', userId, isOnline });
  // Broadcast to all admins who have users_view permission
  // Wait, we can't easily check permissions of connected users unless we attach user objects to the WS.
  
  for (const [, sockets] of connectedUsers.entries()) {
    // For now, we broadcast to everyone connected (they are authenticated at least)
    for (const ws of sockets) {
      console.log('WS readyState:', ws.readyState);
            if (ws.readyState === 1) { // 1 = OPEN
        console.log('Broadcasting PROCESS_STATS to owner/viewer');
            ws.send(payload);
      }
    }
  }
}

export function notifyUserPermissionsUpdated(userId: number, newPermissions: any) {
  const sockets = connectedUsers.get(userId);
  if (sockets) {
    const payload = JSON.stringify({ type: 'PERMISSIONS_UPDATED', permissions: newPermissions });
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

export function notifyUserDisabled(userId: number) {
  const sockets = connectedUsers.get(userId);
  if (sockets) {
    const payload = JSON.stringify({ type: 'USER_DISABLED' });
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

export function broadcastSettingUpdated(key: string, value: string) {
  const payload = JSON.stringify({ type: 'SETTING_UPDATED', key, value });
  for (const [, sockets] of connectedUsers.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}
// Extra lines removed



import { getUserById } from './db/users.js';
import { getAllProcesses } from './db/processes.js';
import { Monitor } from './lib/monitor.js';

let isBroadcasting = false;

export function startProcessStatsBroadcaster() {
  if (isBroadcasting) return;
  isBroadcasting = true;

  setInterval(async () => {
    try {
      const processes = await getAllProcesses();
      const sysLoad = Monitor.getSysLoad();
      
      const enriched = await Promise.all(
        processes.map(async (proc) => {
          const activePid = Monitor.isRunning(proc);
          if (activePid) {
            const metrics = await Monitor.getMetrics(activePid);
            return {
              ...proc,
              status: 'running',
              pid: activePid,
              cpu: metrics.cpu,
              mem: metrics.mem,
              uptime: metrics.uptime,
            };
          }
          return {
            ...proc,
            status: 'stopped',
            pid: undefined,
            cpu: undefined,
            mem: undefined,
            uptime: undefined,
          };
        })
      );

      const payload = JSON.stringify({
        type: 'PROCESS_STATS',
        data: enriched,
        sys_load: sysLoad
      });

      for (const [userId, sockets] of connectedUsers.entries()) {
        for (const ws of sockets) {
          try {
            ws.send(payload);
          } catch (e) {
            console.error('Failed to send WS payload', e);
          }
        }
      }
    } catch (err) {
      console.error('Error broadcasting process stats:', err);
    }
  }, 1000);
}

export function broadcastUsersRefresh(targetUserId?: number) {
  const payload = JSON.stringify({ type: 'USERS_REFRESH', targetUserId });
  for (const [, sockets] of connectedUsers.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

export function broadcastAiHistoryUpdated() {
  const payload = JSON.stringify({ type: 'AI_HISTORY_UPDATED' });
  for (const [, sockets] of connectedUsers.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

