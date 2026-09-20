import { Context, Next } from 'hono';

const store = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 300; // 300 requests per minute

export function rateLimiter() {
  return async (c: Context, next: Next) => {
    // Only rate limit API routes
    if (!c.req.path.startsWith('/api')) {
      return next();
    }

    // Identify client by IP (or fallback)
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const now = Date.now();

    let record = store.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + WINDOW_MS };
    }

    record.count++;
    store.set(ip, record);

    if (record.count > MAX_REQUESTS) {
      c.header('Retry-After', String(Math.ceil((record.resetTime - now) / 1000)));
      return c.json({ success: false, message: 'Too many requests, please try again later.' }, 429);
    }

    // Clean up old entries periodically to prevent memory leaks on low RAM systems
    if (Math.random() < 0.01) {
      for (const [key, val] of store.entries()) {
        if (now > val.resetTime) {
          store.delete(key);
        }
      }
    }

    await next();
  };
}
