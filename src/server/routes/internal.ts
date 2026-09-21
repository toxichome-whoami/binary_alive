import { Hono } from 'hono';
import crypto from 'crypto';
import { runAutorestart } from '../lib/cron.js';

export const internalRouter = new Hono();

internalRouter.post('/cron', async (c) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    return c.json({ success: false, message: 'CRON_SECRET is not properly configured.' }, 500);
  }

  const provided = c.req.header('X-Cron-Secret');
  
  if (!provided || provided.length !== cronSecret.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(cronSecret))) {
    return c.json({ success: false, message: 'Unauthorized cron trigger' }, 403);
  }

  const result = await runAutorestart();
  return c.json({
    success: true,
    message: 'Cron cycle finished',
    data: result,
  });
});
