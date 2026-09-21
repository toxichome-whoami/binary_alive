import { Hono } from 'hono';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  disableUser,
  enableUser,
  setTotpSecret,
} from '../db/users.js';
import { deleteUserSessions } from '../db/sessions.js';
import { logAudit } from '../db/logs.js';
import { hashPassword } from '../lib/crypto.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import type { Permissions } from '../types/index.js';
import { notifyUserPermissionsUpdated, notifyUserDisabled, broadcastUsersRefresh } from '../websocket.js';

function enforcePermissionConstraints(perms: any): any {
  const p = { ...perms };
  if (!p.users_view) {
    p.users_create = false; p.users_edit = false; p.users_disable = false; p.users_delete = false; p.users_reset_2fa = false;
  }
  if (!p.api_keys_view) {
    p.api_keys_create = false; p.api_keys_edit = false; p.api_keys_disable = false; p.api_keys_delete = false;
  }
  if (!p.processes_view) {
    p.processes_start = false; p.processes_stop = false; p.processes_restart = false;
    p.processes_create = false; p.processes_edit = false; p.processes_delete = false;
  }
  if (!p.settings_view) {
    p.settings_maintenance = false; p.settings_captcha = false; p.settings_ai = false;
  }
  if (!p.terminal_access) {
    p.terminal_unrestricted = false;
  }
  if (!p.ai_access) {
    p.ai_data_read = false; p.ai_data_write = false;
  }
  return p;
}

export const userRouter = new Hono();

// List users with pagination (needs to be available for dashboard or just use users_edit)
userRouter.get('/', requireAuth(), requirePermission('users_view'), async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const result = await listUsers(page, limit);
  return c.json({ success: true, data: result });
});

// Create user
userRouter.post('/', requireAuth(), requirePermission('users_create'), async (c) => {
  const currentUser = c.get('user');
  const body = await c.req.json();
  const username = (body.username || '').trim();
  const email = (body.email || '').trim() || null;
  const password = body.password || '';
  const permissions: Permissions = body.permissions || {
    users_view: false, users_create: false, users_edit: false, users_disable: false, users_delete: false, users_reset_2fa: false,
    api_keys_view: false, api_keys_create: false, api_keys_edit: false, api_keys_disable: false, api_keys_delete: false,
    processes_view: false, processes_start: false, processes_stop: false, processes_restart: false, processes_create: false, processes_edit: false, processes_delete: false,
    logs_view_audit: false, logs_view_login: false, logs_view_terminal: false,
    settings_view: false, settings_edit: false, settings_security: false,
    terminal_access: false, terminal_unrestricted: false,
  };

  if (!username || !password) {
    return c.json({ success: false, message: 'Username and password required' }, 400);
  }

  // Privilege escalation check
  if (currentUser.role !== 'owner') {
    for (const [key, val] of Object.entries(permissions)) {
      if (val && !(currentUser.permissions as any)[key]) {
        return c.json({ success: false, message: `You cannot grant the '${key}' permission because you do not have it.` }, 403);
      }
    }
  }

  const hash = await hashPassword(password);
  try {
    const id = await createUser(username, hash, 'member', JSON.stringify(permissions), email);
    await logAudit(currentUser.id, currentUser.username, 'create_user', `Created user: ${username}`);
    broadcastUsersRefresh(id);
    return c.json({ success: true, data: { id } });
  } catch (err: any) {
    return c.json({ success: false, message: 'Username already exists.' }, 400);
  }
});

// Update user details
userRouter.put('/:id', requireAuth(), requirePermission('users_edit'), async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const isMaster = target.role === 'owner';

  // Master Admin security rules
  if (isMaster && currentUser.role !== 'owner') {
    return c.json({ success: false, message: 'Only the Owner can modify the owner account.' }, 403);
  }

  const updates: { username?: string; email?: string | null; passwordHash?: string; permissions?: string; locked_until?: string | null; failed_attempts?: number } = {};
  if (body.username && body.username.trim() !== target.username) {
    updates.username = body.username.trim();
  }
  if (body.email !== undefined) {
    const trimmedEmail = body.email.trim() || null;
    if (trimmedEmail !== target.email) {
      updates.email = trimmedEmail;
    }
  }
  if (body.password) {
    updates.passwordHash = await hashPassword(body.password);
  }
  if (body.permissions && !isMaster) {
    if (targetId !== currentUser.id) {
      if (currentUser.role !== 'owner') {
        const existingPerms = typeof target.permissions === 'string' ? JSON.parse(target.permissions) : (target.permissions || {});
        const effectivePerms: any = {};
        for (const [key, val] of Object.entries(body.permissions)) {
          if (!(currentUser.permissions as any)[key]) {
             effectivePerms[key] = !!existingPerms[key];
          } else {
             effectivePerms[key] = !!val;
          }
        }
        updates.permissions = JSON.stringify(enforcePermissionConstraints(effectivePerms));
      } else {
        updates.permissions = JSON.stringify(enforcePermissionConstraints(body.permissions));
      }
    }
  }
  if (body.is_disabled !== undefined) {
    if (isMaster && body.is_disabled) {
      return c.json({ success: false, message: 'The Owner account cannot be disabled.' }, 403);
    }
    if (target.id === currentUser.id && body.is_disabled) {
      return c.json({ success: false, message: 'You cannot disable your own account.' }, 403);
    }
    updates.locked_until = body.is_disabled ? '2099-12-31T23:59:59.000Z' : null;
    if (!body.is_disabled) {
      updates.failed_attempts = 0;
    }
    if (body.is_disabled) {
      await deleteUserSessions(targetId);
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateUser(targetId, updates);
    const actionDesc = body.is_disabled !== undefined
      ? `${body.is_disabled ? 'Disabled' : 'Enabled'} account: ${target.username}`
      : `Updated user: ${target.username}`;
    await logAudit(currentUser.id, currentUser.username, 'edit_user', actionDesc);

    if (updates.permissions) {
      notifyUserPermissionsUpdated(targetId, body.permissions);
      broadcastUsersRefresh(targetId);
    }
    if (body.is_disabled !== undefined) {
      if (body.is_disabled) {
        notifyUserDisabled(targetId);
      }
      broadcastUsersRefresh(targetId);
    }
  }

  return c.json({ success: true, message: 'User updated successfully.' });
});

// Disable user account
userRouter.post('/:id/disable', requireAuth(), requirePermission('users_disable'), async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  if (target.role === 'owner') {
    return c.json({ success: false, message: 'The Owner account cannot be disabled.' }, 403);
  }

  if (targetId === currentUser.id) {
    return c.json({ success: false, message: 'You cannot disable your own account.' }, 403);
  }

  await disableUser(targetId);
  await deleteUserSessions(targetId);
  await logAudit(currentUser.id, currentUser.username, 'disable_user', `Disabled account: ${target.username}`);
  notifyUserDisabled(targetId);
      broadcastUsersRefresh(targetId);
  return c.json({ success: true, message: `Account "${target.username}" has been disabled.` });
});

// Enable user account
userRouter.post('/:id/enable', requireAuth(), requirePermission('users_disable'), async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  await enableUser(targetId);
  await logAudit(currentUser.id, currentUser.username, 'enable_user', `Enabled account: ${target.username}`);
  broadcastUsersRefresh();
  return c.json({ success: true, message: `Account "${target.username}" has been enabled.` });
});

// Delete user
userRouter.delete('/:id', requireAuth(), requirePermission('users_delete'), async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  if (target.role === 'owner') {
    return c.json({ success: false, message: 'The Owner account cannot be deleted.' }, 403);
  }

  if (targetId === currentUser.id) {
    return c.json({ success: false, message: 'You cannot delete your own account.' }, 403);
  }

  await deleteUser(targetId);
  await logAudit(currentUser.id, currentUser.username, 'delete_user', `Deleted user: ${target.username}`);
  notifyUserDisabled(targetId);
      broadcastUsersRefresh(targetId);
  return c.json({ success: true, message: 'User deleted.' });
});

// Force remove 2FA
userRouter.delete('/:id/2fa', requireAuth(), requirePermission('users_reset_2fa'), async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  if (target.role === 'owner' && currentUser.role !== 'owner') {
    return c.json({ success: false, message: 'Only the Owner can modify the owner account.' }, 403);
  }

  await setTotpSecret(targetId, null);
  await logAudit(currentUser.id, currentUser.username, 'disable_2fa', `Admin removed 2FA for ${target.username}`);
  broadcastUsersRefresh();

  return c.json({ success: true, message: '2FA disabled for user.' });
});
