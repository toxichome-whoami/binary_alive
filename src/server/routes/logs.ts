import { Hono } from 'hono';
import { getAuditLogs, getLoginLogs, getTerminalLogs, getLogMetrics, getLogBounds } from '../db/logs.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const logRouter = new Hono();

logRouter.use('*', requireAuth());

// Audit logs
logRouter.get('/audit', requirePermission('logs_view_audit'), async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20', 10)), 100);
  const search = c.req.query('search') || '';
  const sort = c.req.query('sort') || 'timestamp';
  const dir = c.req.query('dir') || 'desc';
  const start = c.req.query('start');
  const end = c.req.query('end');
  const result = await getAuditLogs(page, limit, search, sort, dir, start, end);
  return c.json({ success: true, data: result });
});

// Login attempts
logRouter.get('/login', requirePermission('logs_view_login'), async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20', 10)), 100);
  const search = c.req.query('search') || '';
  const sort = c.req.query('sort') || 'timestamp';
  const dir = c.req.query('dir') || 'desc';
  const start = c.req.query('start');
  const end = c.req.query('end');
  const result = await getLoginLogs(page, limit, search, sort, dir, start, end);
  return c.json({ success: true, data: result });
});

// Terminal execution history (admin only)
logRouter.get('/terminal', requirePermission('logs_view_terminal'), async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20', 10)), 100);
  const search = c.req.query('search') || '';
  const sort = c.req.query('sort') || 'timestamp';
  const dir = c.req.query('dir') || 'desc';
  const start = c.req.query('start');
  const end = c.req.query('end');
  const result = await getTerminalLogs(page, limit, search, sort, dir, start, end);
  return c.json({ success: true, data: result });
});


// Metrics
logRouter.get('/metrics', requirePermission('logs_view_audit'), async (c) => {
  const start = c.req.query('start');
  const end = c.req.query('end');
  const result = await getLogMetrics(start, end);
  return c.json({ success: true, data: result });
});

logRouter.get('/bounds', requirePermission('logs_view_audit'), async (c) => {
  const result = await getLogBounds();
  return c.json({ success: true, data: result });
});
