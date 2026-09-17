import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

export function csrfProtection(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();

    // Safe methods do not require CSRF
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next();
    }

    // Skip CSRF for API bearer tokens (server-to-server) or public auth setup/login
    if (c.get('isApiAuth')) {
      return next();
    }

    const path = c.req.path;
    if (path.startsWith('/api/auth/') || path.startsWith('/api/internal/')) {
      return next();
    }

    const cookieToken = getCookie(c, 'csrf_token');
    const headerToken = c.req.header('X-CSRF-Token');

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return c.json({ success: false, message: 'Invalid or missing CSRF token' }, 403);
    }

    await next();
  };
}
