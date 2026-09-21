import { runAutorestart, logTelemetryData } from './lib/cron.js';
import { Hono } from 'hono';
import dotenv from 'dotenv';
import { initDatabase } from './db/schema.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { ipWhitelist } from './middleware/ipWhitelist.js';
import { authMiddleware } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { rateLimiter } from './middleware/rateLimiter.js';

import { authRouter } from './routes/auth.js';
import { processRouter } from './routes/processes.js';
import { userRouter } from './routes/users.js';
import { apiTokensRouter } from './routes/api_tokens.js';
import { logRouter } from './routes/logs.js';
import { terminalRouter } from './routes/terminal.js';
import { settingsRouter } from './routes/settings.js';
import { totpRouter } from './routes/totp.js';
import { internalRouter } from './routes/internal.js';
import { handleTerminalConnection, ptyMap, killTerminal } from './routes/terminal_ws.js';


dotenv.config();

export const app = new Hono();

import { initWebSocket, connectedUsers, broadcastUserStatusChange, broadcastUsersRefresh, startProcessStatsBroadcaster } from './websocket.js';
import { getCookie } from 'hono/cookie';
import { getUserById } from './db/users.js';
import { getSession } from './db/sessions.js';

const wsParts = initWebSocket(app);
startProcessStatsBroadcaster();

app.get(
  '/api/ws',
  wsParts.upgradeWebSocket((c) => {
    return {
      onOpen: async (_event, ws) => {
        // We use cookie for auth, but allow anonymous connections for login page settings updates
        const sid = getCookie(c, 'session_id');
        let userId = -1;
        let user = null;

        if (sid) {
          const session = await getSession(sid);
          if (session && new Date(session.expires_at) > new Date()) {
            const maybeUser = await getUserById(session.user_id);
            const isLocked = maybeUser?.locked_until ? new Date(maybeUser.locked_until) > new Date() : false;
            if (maybeUser && !isLocked) {
              user = maybeUser;
              userId = user.id;
            }
          }
        }

        if (userId === -1) {
          userId = -Math.floor(Math.random() * 1000000000) - 1; // Negative ID for anonymous
        }

        // @ts-ignore
        ws.userId = userId;
        // @ts-ignore
        ws.user = user;

        let userSockets = connectedUsers.get(userId);
        if (!userSockets) {
          userSockets = new Set();
          connectedUsers.set(userId, userSockets);
          // Only broadcast online status if it's a real user
          if (user) {
            broadcastUserStatusChange(userId, true);
            broadcastUsersRefresh();
          }
        }
        userSockets.add(ws);

        // Send initial presence state to the newly connected user
        const onlineUserMap: Record<number, boolean> = {};
        for (const uid of connectedUsers.keys()) {
          onlineUserMap[uid] = true;
        }
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'PRESENCE_SYNC', users: onlineUserMap }));
        }
      },
      onClose: (_event, ws) => {
        // @ts-ignore
        const userId = ws.userId;
        if (userId) {
          const userSockets = connectedUsers.get(userId);
          if (userSockets) {
            userSockets.delete(ws);
            if (userSockets.size === 0) {
              connectedUsers.delete(userId);
              if (userId > 0) {
                broadcastUserStatusChange(userId, false);
              }
            }
          }
        }
      },
    };
  })
);

// Global Middlewares
app.use('*', securityHeaders());
app.use('*', ipWhitelist());
app.use('*', authMiddleware());
app.use('*', csrfProtection());
app.use('*', rateLimiter());

import { aiRouter } from './routes/ai.js';

// API Routes
app.route('/api/auth', authRouter);
app.route('/api/processes', processRouter);
app.route('/api/users', userRouter);
app.route('/api/api-tokens', apiTokensRouter);
app.route('/api/logs', logRouter);
app.route('/api/terminal', terminalRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/2fa', totpRouter);
app.route('/api/internal', internalRouter);
app.route('/api/ai', aiRouter);


app.get('/api/terminal/ws', wsParts.upgradeWebSocket((c) => {
  return {
    onOpen: async (_event, ws) => {
      const sid = getCookie(c, 'session_id');
      if (!sid) return ws.close(1008, 'Unauthorized');
      
      const session = await getSession(sid);
      if (!session || new Date(session.expires_at) < new Date()) return ws.close(1008, 'Unauthorized');
      
      const user = await getUserById(session.user_id);
      if (!user) return ws.close(1008, 'Forbidden');
      
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return ws.close(1008, 'Account locked');
      }

      const { getSetting } = await import('./db/settings.js');
      const maintenance = await getSetting('maintenance_mode', '0');
      if (maintenance === '1' && user.role !== 'owner' && (!user.permissions || !user.permissions.settings_maintenance)) {
        return ws.close(1008, 'Maintenance Mode');
      }
      
      handleTerminalConnection(ws, user);
    },
    onMessage: (event, ws) => {
      const ptyProcess = ptyMap.get(ws.raw || ws);
      if (ptyProcess) {
        try {
          const parsed = JSON.parse(event.data.toString());
          if (parsed.type === 'data') {
            ptyProcess.write(parsed.data);
          } else if (parsed.type === 'resize') {
            ptyProcess.resize(parsed.cols, parsed.rows);
          }
        } catch (e) {
          ptyProcess.write(event.data.toString());
        }
      }
    },
    onClose: (event, ws) => {
      killTerminal(ws.raw || ws);
    }
  };
}));


// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'online',
    system: 'Binary Alive 2.0 (Unified Vite Engine)',
    time: new Date().toISOString(),
  });
});

// 404 handler for API routes
app.notFound((c) => {
  return c.json({ success: false, message: 'API route not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json({ success: false, message: err.message || 'Internal Server Error' }, 500);
});

let isInitialized = false;
export async function initApp(): Promise<void> {
  if (isInitialized) return;
  await initDatabase();
  
  // Internal background cron supervisor
  // TODO (DEVELOPER): This is currently set to 7 seconds (7000ms) for TESTING PURPOSES ONLY! 
  // BEFORE PRODUCTION, this MUST be updated back to 30000ms (30 seconds) to prevent excessive CPU usage!
  const autoRestartInterval = parseInt(process.env.AUTO_RESTART_INTERVAL_MS || '30000', 10);
  setInterval(async () => {
    await runAutorestart();
    await logTelemetryData();
  }, autoRestartInterval);

  isInitialized = true;
}
