import { Hono } from 'hono';
import { getSetting, setSetting } from '../db/settings.js';
import { logAudit } from '../db/logs.js';
import { ConfigService } from '../lib/config.js';
import { db } from '../db/client.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const settingsRouter = new Hono();

settingsRouter.use('*', requireAuth(), requireRole(['admin']));

// Get current settings
settingsRouter.get('/', async (c) => {
  const captcha = await getSetting('enable_captcha', '1');
  const cfg = ConfigService.get();

  return c.json({
    success: true,
    data: {
      enable_captcha: captcha === '1',
      version: cfg.system.version || '2.0.0',
    },
  });
});

// Toggle CAPTCHA
settingsRouter.post('/captcha', async (c) => {
  const user = c.get('user');
  const { enabled } = await c.req.json();
  const val = enabled ? '1' : '0';

  await setSetting('enable_captcha', val);
  await logAudit(
    user.id,
    user.username,
    'toggle_captcha',
    `Captcha set to ${enabled ? 'enabled' : 'disabled'}`
  );

  return c.json({ success: true, message: `Login CAPTCHA ${enabled ? 'enabled' : 'disabled'}.` });
});

// Export Config
settingsRouter.get('/export/config', async (c) => {
  const user = c.get('user');
  const cfg = ConfigService.get();

  await logAudit(user.id, user.username, 'export_data', 'Type: config');
  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', 'attachment; filename="binary_alive_config.json"');
  return c.json(cfg);
});

// Export Database tables as JSON dump
settingsRouter.get('/export/db', async (c) => {
  const user = c.get('user');

  const users = await db.execute('SELECT id, username, role, totp_secret, created_at FROM users');
  const processes = await db.execute('SELECT * FROM processes');
  const auditLogs = await db.execute('SELECT * FROM audit_logs');
  const settings = await db.execute('SELECT * FROM settings');

  const dump = {
    exported_at: new Date().toISOString(),
    users: users.rows,
    processes: processes.rows,
    audit_logs: auditLogs.rows,
    settings: settings.rows,
  };

  await logAudit(user.id, user.username, 'export_data', 'Type: database_dump');
  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', 'attachment; filename="binary_alive_turso_dump.json"');
  return c.json(dump);
});

// Import Config
settingsRouter.post('/import/config', async (c) => {
  const user = c.get('user');
  const body = await c.req.parseBody();
  const file = body['config_file'];

  if (!file || typeof file === 'string') {
    return c.json({ success: false, message: 'No configuration file provided' }, 400);
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON format');
    }

    ConfigService.save(parsed);
    await logAudit(user.id, user.username, 'import_data', 'Type: config');

    return c.json({ success: true, message: 'Configuration successfully imported and saved.' });
  } catch (err: any) {
    return c.json({ success: false, message: `Import error: ${err.message}` }, 400);
  }
});
