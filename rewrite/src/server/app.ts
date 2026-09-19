import { Hono } from 'hono';
import dotenv from 'dotenv';
import { initDatabase } from './db/schema.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { ipWhitelist } from './middleware/ipWhitelist.js';
import { authMiddleware } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';

import { authRouter } from './routes/auth.js';
import { processRouter } from './routes/processes.js';
import { userRouter } from './routes/users.js';
import { apiTokensRouter } from './routes/api_tokens.js';
import { logRouter } from './routes/logs.js';
import { terminalRouter } from './routes/terminal.js';
import { settingsRouter } from './routes/settings.js';
import { totpRouter } from './routes/totp.js';
import { internalRouter } from './routes/internal.js';

dotenv.config();

export const app = new Hono();

// Global Middlewares
app.use('*', securityHeaders());
app.use('*', ipWhitelist());
app.use('*', authMiddleware());
app.use('*', csrfProtection());

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
  isInitialized = true;
}
