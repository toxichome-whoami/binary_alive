import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  listApiTokensForUser,
  listAllApiTokens,
  createApiToken,
  updateApiToken,
  disableApiToken,
  enableApiToken,
  deleteApiToken,
} from '../db/api_tokens.js';
import { generateApiToken } from '../lib/crypto.js';
import { logAudit } from '../db/logs.js';


export const apiTokensRouter = new Hono();

// Apply auth middleware to all routes
apiTokensRouter.use('*', requireAuth());

// List tokens for the current user
apiTokensRouter.get('/', requirePermission('api_keys_view'), async (c) => {
  const user = c.get('user');
  const tokens = await listApiTokensForUser(user.id);
  
  // Omit the token hash for security
  const safeTokens = tokens.map(({ token_hash, ...rest }) => rest);
  
  return c.json({ success: true, data: safeTokens });
});

// List all tokens (Owner only, for Admin view)
apiTokensRouter.get('/all', requirePermission('api_keys_view'), async (c) => {
  const user = c.get('user');
  if (user.role !== 'owner') {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  
  const tokens = await listAllApiTokens();
  const safeTokens = tokens.map(({ token_hash, ...rest }) => rest);
  
  return c.json({ success: true, data: safeTokens });
});

// Create a new token
apiTokensRouter.post('/', requirePermission('api_keys_create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { name, permissions, expires_at } = body;
  
  if (!name || name.trim() === '') {
    return c.json({ success: false, message: 'Token name is required' }, 400);
  }
  
  // Ensure we don't grant permissions the user doesn't have
  let effectivePermissions: any = {};
  if (permissions) {
    for (const key of Object.keys(permissions)) {
      if (user.role === 'owner') {
        effectivePermissions[key] = !!permissions[key];
      } else {
        effectivePermissions[key] = !!permissions[key] && !!(user.permissions as any)[key];
      }
    }
  }
  
  const { raw, hash } = generateApiToken();
  const id = await createApiToken(
    user.id,
    name.trim(),
    hash,
    JSON.stringify(effectivePermissions),
    expires_at || null
  );
  
  await logAudit(user.id, user.username, 'create_api_token', `Created token: ${name}`);
  
  return c.json({
    success: true,
    data: {
      id,
      token: raw, // Send the raw token only once
    }
  });
});

// Update a token (name or permissions)
apiTokensRouter.put('/:id', requirePermission('api_keys_edit'), async (c) => {
  const user = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  
  // Need to ensure the user owns the token or is owner
  // We'll just fetch from list to be simple and safe, or write a dedicated getById
  const tokens = user.role === 'owner' ? await listAllApiTokens() : await listApiTokensForUser(user.id);
  const targetToken = tokens.find(t => t.id === targetId);
  
  if (!targetToken) {
    return c.json({ success: false, message: 'Token not found or unauthorized' }, 404);
  }
  
  const updates: any = {};
  if (body.name && body.name.trim() !== '') {
    updates.name = body.name.trim();
  }
  
  if (body.permissions) {
    const effectivePermissions: any = {};
    for (const key of Object.keys(body.permissions)) {
      if (user.role === 'owner') {
        effectivePermissions[key] = !!body.permissions[key];
      } else {
        effectivePermissions[key] = !!body.permissions[key];
        if (!(user.permissions as any)[key]) {
           effectivePermissions[key] = false;
        }
      }
    }
    updates.permissions = JSON.stringify(effectivePermissions);
  }
  
  if (Object.keys(updates).length > 0) {
    await updateApiToken(targetId, updates);
    await logAudit(user.id, user.username, 'edit_api_token', `Updated token: ${targetToken.name}`);
  }
  
  return c.json({ success: true, message: 'Token updated' });
});

// Disable an API token
apiTokensRouter.post('/:id/disable', requirePermission('api_keys_disable'), async (c) => {
  const user = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  
  const tokens = user.role === 'owner' ? await listAllApiTokens() : await listApiTokensForUser(user.id);
  const targetToken = tokens.find(t => t.id === targetId);
  
  if (!targetToken) {
    return c.json({ success: false, message: 'Token not found or unauthorized' }, 404);
  }
  
  await disableApiToken(targetId);
  await logAudit(user.id, user.username, 'disable_api_token', `Disabled token: ${targetToken.name}`);
  
  return c.json({ success: true, message: `API Key "${targetToken.name}" has been disabled.` });
});

// Enable an API token
apiTokensRouter.post('/:id/enable', requirePermission('api_keys_disable'), async (c) => {
  const user = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  
  const tokens = user.role === 'owner' ? await listAllApiTokens() : await listApiTokensForUser(user.id);
  const targetToken = tokens.find(t => t.id === targetId);
  
  if (!targetToken) {
    return c.json({ success: false, message: 'Token not found or unauthorized' }, 404);
  }
  
  await enableApiToken(targetId);
  await logAudit(user.id, user.username, 'enable_api_token', `Enabled token: ${targetToken.name}`);
  
  return c.json({ success: true, message: `API Key "${targetToken.name}" has been enabled.` });
});

// Delete a token
apiTokensRouter.delete('/:id', requirePermission('api_keys_delete'), async (c) => {
  const user = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  
  const tokens = user.role === 'owner' ? await listAllApiTokens() : await listApiTokensForUser(user.id);
  const targetToken = tokens.find(t => t.id === targetId);
  
  if (!targetToken) {
    return c.json({ success: false, message: 'Token not found or unauthorized' }, 404);
  }
  
  await deleteApiToken(targetId);
  await logAudit(user.id, user.username, 'delete_api_token', `Revoked token: ${targetToken.name}`);
  
  return c.json({ success: true, message: 'Token revoked' });
});
