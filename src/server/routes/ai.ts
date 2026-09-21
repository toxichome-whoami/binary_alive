import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { addAiHistory, getAiHistory, deleteAiHistory, getMyAiHistory } from '../db/ai.js';
import { getSetting } from '../db/settings.js';
import { broadcastAiHistoryUpdated } from '../websocket.js';
import type { User } from '../../types/index.js';

const aiRouter = new Hono<{ Variables: { user: User } }>();

// Endpoint for sending a chat message
aiRouter.post('/chat', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const message = body.message;
    const history = Array.isArray(body.history) ? body.history : [];
    console.log('[AI] Message:', message);

    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Invalid message' }, 400);
    }

    const aiBaseUrl = (await getSetting('ai_base_url')) || 'https://api.openai.com/v1';
    const aiApiKey = (await getSetting('ai_api_key')) || '';
    const aiModel = (await getSetting('ai_model')) || 'gemini-2.5-flash';

    if (!aiApiKey) {
      return c.json({ success: false, error: 'AI API Key is not configured.' }, 400);
    }

    const systemPrompt = `You are an expert AI assistant built directly into the Binary Alive platform. 
Your primary goal is to help users use, configure, and understand Binary Alive.
You must absolutely refuse to answer any questions or engage in conversations that are NOT related to Binary Alive, server management, processes, API keys, or platform settings.

Here is essential context about Binary Alive's UI and features:
- To add a process: Navigate to the Dashboard, click the blue "+ Add process" button. This opens the "Add process" drawer. Here, the user can configure the Process Name, Command to execute, Working Directory, Auto-Restart policy, and CPU limits. Click "Add process" to save.
- To manage API keys: Navigate to the "API Keys" page from the sidebar to create, edit, or revoke API keys.
- To view logs: Navigate to the "Logs" page to view system or process-specific logs.
- To use the Terminal: Navigate to the "Terminal" page to open a web-based SSH terminal for server management.
- To configure Settings: Navigate to "Settings" to configure 2FA, AI models, Maintenance Mode, and CAPTCHA.

Provide precise, accurate instructions using this exact terminology. If a user asks about general topics, coding (unrelated to the platform), weather, general knowledge, etc., politely tell them that you can only assist with Binary Alive related tasks.`;

    const mappedHistory = history.map((msg: any) => ({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: String(msg.content)
    }));

    let responseText = '';
    try {
      const completion = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...mappedHistory,
            { role: 'user', content: message }
          ]
        })
      });

      if (!completion.ok) {
        const errorData = await completion.json().catch(() => ({}));
        console.error('AI API error:', errorData);
        return c.json({ success: false, error: 'Failed to communicate with AI provider.' }, 500);
      }

      const responseJson = await completion.json();
      responseText = responseJson.choices?.[0]?.message?.content || 'I could not generate a response.';
    } catch (e: any) {
       console.error('AI API fetch error:', e.message);
       return c.json({ success: false, error: 'Failed to communicate with AI provider.' }, 500);
    }

    // Save to DB
    const id = await addAiHistory(user.id, message, responseText);

    // Broadcast to owner
    broadcastAiHistoryUpdated();

    return c.json({
      success: true,
      data: {
        id,
        user_id: user.id,
        message,
        response: responseText,
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Error in /chat:', err.message);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// Endpoint for user to view their own AI history
aiRouter.get('/my-history', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    const result = await getMyAiHistory(user.id, limit, offset);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Error in /my-history:', err);
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
