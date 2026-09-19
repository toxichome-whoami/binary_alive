import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSession, touchSession } from '../db/sessions.js';
import { getUserById } from '../db/users.js';
import { getApiTokenByHash, updateApiTokenLastUsed } from '../db/api_tokens.js';
import { hashApiToken } from '../lib/crypto.js';
import type { User, Permissions } from '../types/index.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    isApiAuth: boolean;
  }
}

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // 1. Check Bearer Token header
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const hash = hashApiToken(token);
        const apiToken = await getApiTokenByHash(hash);
        if (apiToken) {
          // Check if disabled
          if (apiToken.is_disabled) {
            return c.json({ success: false, message: 'API Key is disabled.' }, 403);
          }
          // Check expiry
          if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
            return c.json({ success: false, message: 'API Token has expired' }, 401);
          }
          const user = await getUserById(apiToken.user_id);
          if (user) {
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
              return c.json({ success: false, message: 'Account is disabled.' }, 403);
            }
            // Determine effective permissions: token permission AND user permission
            const effectivePermissions: Partial<Permissions> = {};
            for (const key of Object.keys(apiToken.permissions)) {
              const k = key as keyof Permissions;
              if (user.role === 'owner') {
                 effectivePermissions[k] = apiToken.permissions[k];
              } else {
                 effectivePermissions[k] = apiToken.permissions[k] && user.permissions[k];
              }
            }
            user.permissions = effectivePermissions as Permissions;
            
            await updateApiTokenLastUsed(apiToken.id);
            c.set('user', user);
            c.set('isApiAuth', true);
            return next();
          }
        }
      }
    }

    // 2. Check Session Cookie
    const sessionId = getCookie(c, 'session_id');
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        const user = await getUserById(session.user_id);
        if (user) {
          if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return c.json({ success: false, message: 'Account is disabled.' }, 403);
          }
          await touchSession(sessionId);
          c.set('user', user);
          c.set('isApiAuth', false);
          return next();
        }
      }
    }

    // 3. Fallback to mock dev user in development
    if (process.env.NODE_ENV !== 'production' && !c.get('user')) {
      const devUser: User = {
        id: 1,
        username: 'admin',
        password_hash: '$2b$10$T1KqHnN0X4520qR13Qf9g.Wc3dF15f/O5Q4Y7D1B9Xb5zUqY5qEOW', // mock bcrypt hash for "admin"
        role: 'owner',
        permissions: {
          users_create: true,
          users_edit: true,
          users_delete: true,
          users_reset_2fa: true,
          users_view: true,
          users_disable: true,
          api_keys_view: true,
          api_keys_create: true,
          api_keys_edit: true,
          api_keys_disable: true,
          api_keys_delete: true,
          processes_view: true,
          processes_start: true,
          processes_stop: true,
          processes_restart: true,
          processes_create: true,
          processes_edit: true,
          processes_delete: true,
          logs_view_audit: true,
          logs_view_login: true,
          logs_view_terminal: true,
          settings_view: true,
          settings_edit: true,
          settings_security: true,
          terminal_access: true,
          terminal_unrestricted: true
        },
        
        totp_secret: null,
        created_at: new Date().toISOString(),
        failed_attempts: 0,
        locked_until: null
      };
      c.set('user', devUser);
      c.set('isApiAuth', false);
    }

    await next();
  };
}

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized - Please sign in' }, 401);
    }
    await next();
  };
}

export function requirePermission(permissionKey: keyof User['permissions']): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, message: 'Forbidden - Insufficient permissions' }, 403);
    }
    if (user.role !== 'owner' && !user.permissions[permissionKey]) {
      return c.json({ success: false, message: 'Forbidden - Insufficient permissions' }, 403);
    }
    await next();
  };
}
