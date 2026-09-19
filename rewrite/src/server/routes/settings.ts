import { Hono } from 'hono';
import { getSetting, setSetting } from '../db/settings.js';
import { logAudit } from '../db/logs.js';
import { ConfigService } from '../lib/config.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const settingsRouter = new Hono();

// Get current settings
settingsRouter.get('/', requireAuth(), requirePermission('settings_view'), async (c) => {
  const captcha = await getSetting('enable_captcha', '1');
  const cfg = ConfigService.get();

  return c.json({
    success: true,
    data: {
      enable_captcha: captcha === '1',
      version: cfg.system.version || '2.4.1',
    },
  });
});

// Toggle CAPTCHA
settingsRouter.post('/captcha', requireAuth(), requirePermission('settings_security'), async (c) => {
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

