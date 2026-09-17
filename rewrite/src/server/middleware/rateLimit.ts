import type { MiddlewareHandler } from 'hono';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginRateLimits = new Map<string, RateLimitRecord>();

// Clean up expired items every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginRateLimits.entries()) {
    if (now > val.resetAt) {
      loginRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function loginRateLimiter(maxAttempts = 5, windowMinutes = 15): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      '127.0.0.1';

    const now = Date.now();
    const record = loginRateLimits.get(ip);

    if (record && now < record.resetAt) {
      if (record.attempts >= maxAttempts) {
        return c.json(
          {
            success: false,
            message: `Too many failed login attempts. IP temporarily locked for ${Math.ceil(
              (record.resetAt - now) / 60000
            )} minutes.`,
          },
          429
        );
      }
    }

    await next();

    // If login was unsuccessful (status 401 or failed json response), increment
    if (c.res.status === 401) {
      const current = loginRateLimits.get(ip);
      if (!current || now > current.resetAt) {
        loginRateLimits.set(ip, {
          attempts: 1,
          resetAt: now + windowMinutes * 60 * 1000,
        });
      } else {
        current.attempts++;
      }
    }
  };
}
