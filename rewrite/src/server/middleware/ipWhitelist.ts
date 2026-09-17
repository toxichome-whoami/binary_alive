import type { MiddlewareHandler } from 'hono';
import { ConfigService } from '../lib/config.js';

export function ipWhitelist(): MiddlewareHandler {
  return async (c, next) => {
    const config = ConfigService.get();
    const allowedIps = config.security.allowed_ips || [];

    if (allowedIps.length > 0) {
      const clientIp =
        c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.req.header('x-real-ip') ||
        '127.0.0.1';

      if (!allowedIps.includes(clientIp)) {
        return c.json({ success: false, message: 'Forbidden: IP address not authorized.' }, 403);
      }
    }

    await next();
  };
}
