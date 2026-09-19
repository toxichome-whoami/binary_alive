import { Hono } from 'hono';
import { getSetting, setSetting } from '../db/settings.js';
import { logAudit } from '../db/logs.js';
import { ConfigService } from '../lib/config.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const settingsRouter = new Hono();

// Get current settings
settingsRouter.get('/', requireAuth(), requirePermission('settings_view'), async (c) => {
  const captcha = await getSetting('enable_captcha', '1');
  const maintenance = await getSetting('maintenance_mode', '0');
  const aiProvider = await getSetting('ai_provider', 'Needle AI');
  const aiModel = await getSetting('ai_model', 'needle-rag-v1');
  const aiBaseUrl = await getSetting('ai_base_url', 'https://api.needle-ai.com/v1');
  const aiApiKey = await getSetting('ai_api_key', '');
  const cfg = ConfigService.get();

  return c.json({
    success: true,
    data: {
      enable_captcha: captcha === '1',
      maintenance_mode: maintenance === '1',
      ai_provider: aiProvider || 'Needle AI',
      ai_model: aiModel || 'needle-rag-v1',
      ai_base_url: aiBaseUrl || '',
      has_ai_key: !!aiApiKey,
      version: cfg.system.version || '2.4.1',
    },
  });
});

// Toggle Settings
settingsRouter.post('/toggle', requireAuth(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { key, enabled } = body;
  
  const validKeys = ['enable_captcha', 'maintenance_mode'];
  if (!validKeys.includes(key)) {
    return c.json({ success: false, message: 'Invalid setting key' }, 400);
  }

  if (key === 'maintenance_mode' && !user.permissions?.settings_edit) {
    return c.json({ success: false, message: 'Missing permission: settings_edit' }, 403);
  }

  if (key === 'enable_captcha' && !user.permissions?.settings_security) {
    return c.json({ success: false, message: 'Missing permission: settings_security' }, 403);
  }

  const val = enabled ? '1' : '0';
  await setSetting(key, val);
  
  await logAudit(
    user.id,
    user.username,
    'toggle_setting',
    `Setting ${key} changed to ${enabled ? 'enabled' : 'disabled'}`
  );

  return c.json({ success: true, message: `Setting updated successfully.` });
});

// Update AI Model Settings
settingsRouter.post('/ai', requireAuth(), async (c) => {
  const user = c.get('user');
  if (!user.permissions?.settings_edit) {
    return c.json({ success: false, message: 'Missing permission: settings_edit' }, 403);
  }

  const { provider, model, base_url, api_key } = await c.req.json();

  if (provider) await setSetting('ai_provider', String(provider).trim());
  if (model) await setSetting('ai_model', String(model).trim());
  if (base_url !== undefined) await setSetting('ai_base_url', String(base_url).trim());
  if (api_key && api_key !== '••••••••••••••••') {
    await setSetting('ai_api_key', String(api_key).trim());
  }

  await logAudit(
    user.id,
    user.username,
    'update_ai_settings',
    `Configured AI provider: ${provider || 'Needle AI'} (Model: ${model || 'needle-rag-v1'})`
  );

  return c.json({ success: true, message: 'AI model configuration saved.' });
});
