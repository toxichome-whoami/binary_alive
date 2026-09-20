import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { addAiHistory, getAiHistory, deleteAiHistory } from '../db/ai.js';
import { broadcastAiHistoryUpdated } from '../websocket.js';
import type { User } from '../../types/index.js';

const aiRouter = new Hono<{ Variables: { user: User } }>();

// Endpoint for sending a chat message
aiRouter.post('/chat', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const message = body.message;

    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Invalid message' }, 400);
    }

    // Generate mock response
    const mockResponse = `I am a mock AI assistant. I received your message: "${message}".`;

    // Save to DB
    const id = await addAiHistory(user.id, message, mockResponse);

    // Broadcast to owner
    broadcastAiHistoryUpdated();

    return c.json({
      success: true,
      data: {
        id,
        user_id: user.id,
        message,
        response: mockResponse,
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Error in /chat:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// Endpoint for owner to view all AI histories
aiRouter.get('/history', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ success: false, error: 'Access Denied' }, 403);

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    const result = await getAiHistory(limit, offset);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Error in /history:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// Endpoint for owner to delete an AI history record
aiRouter.delete('/history/:id', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ success: false, error: 'Access Denied' }, 403);

    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
      return c.json({ success: false, error: 'Invalid ID' }, 400);
    }

    const success = await deleteAiHistory(id);
    if (success) {
      broadcastAiHistoryUpdated();
      return c.json({ success: true });
    } else {
      return c.json({ success: false, error: 'Record not found' }, 404);
    }
  } catch (err: any) {
    console.error('Error in delete /history/:id:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export { aiRouter };
