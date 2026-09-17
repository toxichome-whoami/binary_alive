import { Hono } from 'hono';
import { getAuditLogs, getLoginLogs, getTerminalLogs } from '../db/logs.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const logRouter = new Hono();

logRouter.use('*', requireAuth());

// Audit logs
logRouter.get('/audit', requireRole(['admin', 'auditor', 'operator']), async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const result = await getAuditLogs(page, limit);
  return c.json({ success: true, data: result });
});

// Login attempts
logRouter.get('/login', requireRole(['admin', 'auditor', 'operator']), async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const result = await getLoginLogs(page, limit);
  return c.json({ success: true, data: result });
});

// Terminal execution history (admin only)
logRouter.get('/terminal', requireRole(['admin']), async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const result = await getTerminalLogs(page, limit);
  return c.json({ success: true, data: result });
});
