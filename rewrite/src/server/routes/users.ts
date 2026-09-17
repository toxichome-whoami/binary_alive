import { Hono } from 'hono';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  setApiToken,
  setTotpSecret,
} from '../db/users.js';
import { logAudit } from '../db/logs.js';
import { hashPassword, generateApiToken } from '../lib/crypto.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { Role } from '../types/index.js';

export const userRouter = new Hono();

userRouter.use('*', requireAuth(), requireRole(['admin']));

// List users with pagination
userRouter.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const result = await listUsers(page, limit);
  return c.json({ success: true, data: result });
});

// Create user
userRouter.post('/', async (c) => {
  const currentUser = c.get('user');
  const body = await c.req.json();
  const username = (body.username || '').trim();
  const password = body.password || '';
  const role = (body.role || 'viewer') as Role;

  if (!username || !password) {
    return c.json({ success: false, message: 'Username and password required' }, 400);
  }

  // Only Master Admin can create other Admin accounts
  if (role === 'admin' && currentUser.id !== 1) {
    return c.json({ success: false, message: 'Only the Master Administrator can create other admin accounts.' }, 403);
  }

  const hash = await hashPassword(password);
  try {
    const id = await createUser(username, hash, role);
    await logAudit(currentUser.id, currentUser.username, 'create_user', `Created user: ${username} (${role})`);
    return c.json({ success: true, data: { id } });
  } catch (err: any) {
    return c.json({ success: false, message: 'Username already exists.' }, 400);
  }
});

// Update user details
userRouter.put('/:id', async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const isMaster = target.id === 1;
  const isSelf = target.id === currentUser.id;

  // Master Admin security rules
  if (isMaster && currentUser.id !== 1) {
    return c.json({ success: false, message: 'Only the Master Administrator can modify the master account.' }, 403);
  }

  if (isMaster && body.role && body.role !== 'admin') {
    return c.json({ success: false, message: 'The Master Administrator role cannot be changed.' }, 403);
  }

  if (currentUser.id !== 1 && target.role === 'admin' && !isSelf) {
    return c.json({ success: false, message: 'Only the Master Administrator can modify other admin accounts.' }, 403);
  }

  if (currentUser.id !== 1 && body.role === 'admin' && target.role !== 'admin') {
    return c.json({ success: false, message: 'Only the Master Administrator can grant the admin role.' }, 403);
  }

  const updates: { username?: string; passwordHash?: string; role?: Role } = {};
  if (body.username && body.username.trim() !== target.username) {
    updates.username = body.username.trim();
  }
  if (body.password) {
    updates.passwordHash = await hashPassword(body.password);
  }
  if (body.role && body.role !== target.role) {
    updates.role = body.role as Role;
  }

  if (Object.keys(updates).length > 0) {
    await updateUser(targetId, updates);
    await logAudit(currentUser.id, currentUser.username, 'edit_user', `Updated user: ${target.username}`);
  }

  return c.json({ success: true, message: 'User updated successfully.' });
});

// Delete user
userRouter.delete('/:id', async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  if (targetId === 1) {
    return c.json({ success: false, message: 'The Master Administrator account cannot be deleted.' }, 403);
  }

  if (targetId === currentUser.id) {
    return c.json({ success: false, message: 'You cannot delete your own account.' }, 403);
  }

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  if (currentUser.id !== 1 && target.role === 'admin') {
    return c.json({ success: false, message: 'Only the Master Administrator can delete other admin accounts.' }, 403);
  }

  await deleteUser(targetId);
  await logAudit(currentUser.id, currentUser.username, 'delete_user', `Deleted user: ${target.username}`);
  return c.json({ success: true, message: 'User deleted.' });
});

// Generate API Token
userRouter.post('/:id/token', async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const { raw, hash } = generateApiToken();
  await setApiToken(targetId, hash);
  await logAudit(currentUser.id, currentUser.username, 'generate_api_token', `Generated token for ${target.username}`);

  return c.json({
    success: true,
    data: { token: raw },
  });
});

// Revoke API Token
userRouter.delete('/:id/token', async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  await setApiToken(targetId, null);
  await logAudit(currentUser.id, currentUser.username, 'delete_api_token', `Revoked token for ${target.username}`);

  return c.json({ success: true, message: 'API token revoked.' });
});

// Force remove 2FA
userRouter.delete('/:id/2fa', async (c) => {
  const currentUser = c.get('user');
  const targetId = parseInt(c.req.param('id'), 10);

  const target = await getUserById(targetId);
  if (!target) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  await setTotpSecret(targetId, null);
  await logAudit(currentUser.id, currentUser.username, 'disable_2fa', `Admin removed 2FA for ${target.username}`);

  return c.json({ success: true, message: '2FA disabled for user.' });
});
