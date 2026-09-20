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

import { initWebSocket, connectedUsers, broadcastUserStatusChange, startProcessStatsBroadcaster } from './websocket.js';
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
        // We use cookie for auth
        const sid = getCookie(c, 'session_id');
        if (!sid) {
          ws.close(1008, 'Unauthorized');
          return;
        }
        
        const session = await getSession(sid);
        if (!session || new Date(session.expires_at) < new Date()) {
          ws.close(1008, 'Unauthorized');
          return;
        }
        
        const user = await getUserById(session.user_id);
        const isLocked = user?.locked_until ? new Date(user.locked_until) > new Date() : false;
        if (!user || isLocked) {
          ws.close(1008, 'Forbidden');
          return;
        }

        const userId = user.id;
        // @ts-ignore
        ws.userId = userId;
        // @ts-ignore
        ws.user = user;

        let userSockets = connectedUsers.get(userId);
        if (!userSockets) {
          userSockets = new Set();
          connectedUsers.set(userId, userSockets);
          // Only broadcast if this is the first connection for this user
          broadcastUserStatusChange(userId, true);
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
              broadcastUserStatusChange(userId, false);
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
app.get('/api/debug-ws', (c) => {
  return c.json({ connectedUsersSize: connectedUsers.size });
});


app.get('/api/terminal/ws', wsParts.upgradeWebSocket((c) => {
  return {
    onOpen: async (_event, ws) => {
      const sid = getCookie(c, 'session_id');
      if (!sid) return ws.close(1008, 'Unauthorized');
      
      const session = await getSession(sid);
      if (!session || new Date(session.expires_at) < new Date()) return ws.close(1008, 'Unauthorized');
      
      const user = await getUserById(session.user_id);
      if (!user) return ws.close(1008, 'Forbidden');
      
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
