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
      if (ws.readyState === 1) { // 1 = OPEN
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
