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

const tokenLastUsedCache = new Map<number, number>();
function throttleUpdateApiTokenLastUsed(id: number) {
  const now = Date.now();
  const last = tokenLastUsedCache.get(id) || 0;
  if (now - last > 5 * 60 * 1000) {
    tokenLastUsedCache.set(id, now);
    updateApiTokenLastUsed(id).catch(() => {});
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
          if (apiToken.is_disabled || (apiToken.expires_at && new Date(apiToken.expires_at) < new Date())) {
            return c.json({ success: false, message: 'Unauthorized - Invalid or expired token' }, 401);
          }
          const user = await getUserById(apiToken.user_id);
          if (user) {
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
              const isPermanentlyDisabled = new Date(user.locked_until).getFullYear() === 2099;
              return c.json({ 
                success: false, 
                message: isPermanentlyDisabled 
                  ? 'Your account has been disabled by an administrator.' 
                  : 'Your account is temporarily locked due to too many failed attempts.' 
              }, 403);
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
            const isPermanentlyDisabled = new Date(user.locked_until).getFullYear() === 2099;
            return c.json({ 
              success: false, 
              message: isPermanentlyDisabled 
                ? 'Your account has been disabled by an administrator.' 
                : 'Your account is temporarily locked due to too many failed attempts.' 
            }, 403);
          }
          const { ConfigService } = await import('../lib/config.js');
          const timeout = ConfigService.get().security.session_timeout_minutes;
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
    
    // Check maintenance mode
    const { getSetting } = await import('../db/settings.js');
    const maintenance = await getSetting('maintenance_mode', '0');
    const canBypassMaintenance = user.role === 'owner' || user.permissions?.settings_maintenance;
    
    if (maintenance === '1' && !canBypassMaintenance) {
      return c.json({ success: false, message: 'System is currently under maintenance.' }, 503);
    }
    
    await next();
  };
}

export function requirePermission(permissionKey: keyof User['permissions']): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    const isApiAuth = c.get('isApiAuth');
    if (!user) {
      return c.json({ success: false, message: 'Forbidden - Insufficient permissions' }, 403);
    }
    
    // If it's an API token, ALWAYS check the effective permissions, even for owners.
    if (isApiAuth) {
      if (!user.permissions || !user.permissions[permissionKey]) {
        return c.json({ success: false, message: 'Forbidden - Token lacks required permission' }, 403);
      }
      return await next();
    }

    if (user.role !== 'owner' && (!user.permissions || !user.permissions[permissionKey])) {
      return c.json({ success: false, message: 'Forbidden - Insufficient permissions' }, 403);
    }
    await next();
  };
}
