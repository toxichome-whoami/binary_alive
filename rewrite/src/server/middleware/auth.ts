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
          const timeout = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60', 10);
          await touchSession(sessionId, timeout);
          c.set('user', user);
          c.set('isApiAuth', false);
          return next();
        }
      }
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
