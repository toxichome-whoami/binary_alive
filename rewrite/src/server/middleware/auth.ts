import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSession, touchSession } from '../db/sessions.js';
import { getUserById, getUserByApiToken } from '../db/users.js';
import { hashApiToken } from '../lib/crypto.js';
import type { Role, User } from '../types/index.js';

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
        const user = await getUserByApiToken(hash);
        if (user) {
          c.set('user', user);
          c.set('isApiAuth', true);
          return next();
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
          await touchSession(sessionId);
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

export function requireRole(allowedRoles: Role[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || !allowedRoles.includes(user.role)) {
      return c.json({ success: false, message: 'Forbidden - Insufficient permissions' }, 403);
    }
    await next();
  };
}
