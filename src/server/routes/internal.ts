import { Hono } from 'hono';
import { runAutorestart } from '../lib/cron.js';

export const internalRouter = new Hono();

internalRouter.post('/cron', async (c) => {
  const cronSecret = process.env.CRON_SECRET || 'change-me-to-a-secure-random-token';
  const provided = c.req.header('X-Cron-Secret');

  if (!provided || provided !== cronSecret) {
    return c.json({ success: false, message: 'Unauthorized cron trigger' }, 403);
  }

  const result = await runAutorestart();
  return c.json({
    success: true,
    message: 'Cron cycle finished',
    data: result,
  });
});
