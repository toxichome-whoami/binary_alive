import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { addAiHistory, getAiHistory, deleteAiHistory, getMyAiHistory, getAiHistoryBounds } from '../db/ai.js';
import { getSetting, setSetting, getAllSettings } from '../db/settings.js';
import { broadcastAiHistoryUpdated, broadcastUsersRefresh, broadcastSettingUpdated, broadcastApiKeysRefresh } from '../websocket.js';
import { getAllProcesses, getProcessById, createProcess, updateProcess, deleteProcess } from '../db/processes.js';
import { listUsers, createUser, updateUser, disableUser, enableUser, deleteUser, setTotpSecret, getUserById } from '../db/users.js';
import { listAllApiTokens, createApiToken, disableApiToken, deleteApiToken } from '../db/api_tokens.js';
import { generateApiToken, hashPassword } from '../lib/crypto.js';
import { Monitor } from '../lib/monitor.js';
import type { User } from '../../types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const aiRouter = new Hono<{ Variables: { user: User } }>();

aiRouter.post('/chat', requireAuth(), requirePermission('ai_access'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const message = body.message?.toString().slice(0, 4000);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Invalid message' }, 400);
    }

    const aiBaseUrl = (await getSetting('ai_base_url')) || 'https://api.openai.com/v1';
    const aiApiKey = (await getSetting('ai_api_key')) || '';
    const aiModel = (await getSetting('ai_model')) || 'gemini-2.5-flash';

    if (!aiApiKey) {
      return c.json({ success: false, error: 'AI API Key is not configured.' }, 400);
    }

    const context = body.context || {};
    const currentPage = context.currentPage || 'Unknown';
    const userRole = user.role;
    let perms = 'None';
    if (user.role === 'owner') {
      perms = 'All Permissions (Owner)';
    } else if (user.permissions && typeof user.permissions === 'object') {
      perms = Object.keys(user.permissions).filter(k => (user.permissions as any)[k] === true).join(', ') || 'None';
    }

    const systemPrompt = `You are Binary Alive's elite super-admin AI agent.
Current Page: ${currentPage}
Username: ${user.username} (ID: ${user.id})
User Role: ${userRole}
Permissions: ${perms}

RULES:
1. You have tools to manage ALL resources (processes, users, api_keys, settings, terminal).
2. DO NOT modify AI settings (\`ai_model\`, \`ai_api_key\`, \`ai_base_url\`).
3. Only use tools if explicitly asked.
4. TO SAVE TOKENS: Keep your final answers to a maximum of 1 or 2 short sentences. Do not use filler words. If a tool succeeds, just say "Done" or "Updated successfully" without explaining what you did. Never print JSON arrays.
5. PRO-TIP: When organizing files or doing complex OS tasks via terminal, try to batch multiple commands using && or script them to accomplish tasks in fewer steps to avoid hitting your turn limits.`;

    const mappedHistory = history.map((msg: any) => ({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: String(msg.content)
    }));

    const tools = [
      { type: 'function', function: { name: 'list_processes', description: 'Lists all processes.', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'get_analytics', description: 'Returns system load and processes stats.', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'add_process', description: 'Creates a process.', parameters: { type: 'object', properties: { name: { type: 'string' }, command: { type: 'string' }, working_dir: { type: 'string' } }, required: ['name', 'command'] } } },
      { type: 'function', function: { name: 'edit_process', description: 'Edits process.', parameters: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, command: { type: 'string' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'start_process', description: 'Starts process.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'stop_process', description: 'Stops process.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'restart_process', description: 'Restarts process.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'delete_process', description: 'Deletes process.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      
      { type: 'function', function: { name: 'list_users', description: 'Lists users and their active permissions.', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'create_user', description: 'Creates user.', parameters: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' }, role: { type: 'string', enum: ['admin','manager','viewer'] } }, required: ['username', 'password', 'role'] } } },
      { type: 'function', function: { name: 'update_user', description: 'Edits user.', parameters: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, role: { type: 'string' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'disable_user', description: 'Locks user.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'enable_user', description: 'Unlocks user.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'delete_user', description: 'Deletes user.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'reset_2fa', description: 'Disables 2FA for user.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },

      { type: 'function', function: { name: 'list_api_keys', description: 'Lists API keys and their active permissions.', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'create_api_key', description: 'Creates API key.', parameters: { type: 'object', properties: { name: { type: 'string' }, user_id: { type: 'integer' } }, required: ['name', 'user_id'] } } },
      { type: 'function', function: { name: 'delete_api_key', description: 'Deletes API key.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      { type: 'function', function: { name: 'disable_api_key', description: 'Disables API key.', parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } } },
      
      { type: 'function', function: { name: 'get_settings', description: 'Lists platform settings.', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'update_setting', description: 'Updates setting.', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } } },
      { type: 'function', function: { name: 'run_terminal_command', description: 'Runs a shell command on host.', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } }
    ];

    let messages = [
      { role: 'system', content: systemPrompt },
      ...mappedHistory,
      { role: 'user', content: message }
    ] as any[];

    let responseText = '';
    let isDone = false;
    let loopCount = 0;

    const hasPerm = (p: string) => user.role === 'owner' || (user.permissions && (user.permissions as any)[p] === true);

    const requireTargetNotOwner = async (targetId: number) => {
      const target = await getUserById(targetId);
      if (!target) throw new Error('User not found');
      if (target.role === 'owner' && target.id !== user.id) throw new Error('Cannot modify another owner account');
      return target;
    };

      let parsedUrl;
      try {
        parsedUrl = new URL(aiBaseUrl);
      } catch (e) {
        return c.json({ success: false, error: 'Invalid AI Base URL' }, 400);
      }
      const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|::1$)/.test(parsedUrl.hostname) || parsedUrl.hostname === 'localhost';
      if (/^169\.254\./.test(parsedUrl.hostname)) {
         return c.json({ success: false, error: 'Access to metadata endpoints is forbidden' }, 403);
      }

      const headers: any = { 'Content-Type': 'application/json' };
      if (aiApiKey && !isPrivate) {
        headers['Authorization'] = `Bearer ${aiApiKey}`;
      }

      while (!isDone && loopCount < 20) {
        loopCount++;
        const completion = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: aiModel, messages, tools, temperature: 0.3 }),
          redirect: 'manual',
          signal: AbortSignal.timeout(15000)
        });

      if (!completion.ok) {
        const errorText = await completion.text().catch(() => 'No text');
        return c.json({ success: false, error: `AI API Error: ${completion.status} - ${errorText}` }, 500);
      }

      const responseJson = await completion.json();
      const msg = responseJson.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
          messages.push(msg);
          
          for (const tc of msg.tool_calls) {
            let toolResult = '';
            try {
              const args = JSON.parse(tc.function.arguments || '{}');
              const fn = tc.function.name;
              
              if (fn === 'list_processes') {
                if (!hasPerm('processes_view')) throw new Error('Forbidden');
                const procs = await getAllProcesses();
                toolResult = JSON.stringify(procs.map((p: any) => ({ id: p.id, name: p.name, status: p.status })));
              } 
              else if (fn === 'get_analytics') {
                if (!hasPerm('processes_view')) throw new Error('Forbidden');
                const procs = await getAllProcesses();
                toolResult = JSON.stringify({ total: procs.length, running: procs.filter((p: any) => p.status === 'running').length, load: Monitor.getSysLoad() });
              }
              else if (fn === 'add_process') {
                if (!hasPerm('processes_create')) throw new Error('Forbidden');
                const id = await createProcess({ name: args.name, command: args.command, working_dir: args.working_dir || '' });
                toolResult = JSON.stringify({ success: true, id });
              }
              else if (fn === 'edit_process') {
                if (!hasPerm('processes_edit')) throw new Error('Forbidden');
                await updateProcess(args.id, { name: args.name, command: args.command });
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'start_process') {
                if (!hasPerm('processes_start')) throw new Error('Forbidden');
                const proc = await getProcessById(args.id);
                if (!proc) throw new Error('Not found');
                const newPid = Monitor.startProcess(proc);
                if (!newPid) {
                  await updateProcess(args.id, { status: 'crashed' });
                  throw new Error('Process failed to spawn');
                }
                await updateProcess(args.id, { pid: newPid, status: 'running' });
                toolResult = JSON.stringify({ success: true, pid: newPid });
              }
              else if (fn === 'stop_process') {
                if (!hasPerm('processes_stop')) throw new Error('Forbidden');
                const proc = await getProcessById(args.id);
                if (!proc) throw new Error('Not found');
                const activePid = Monitor.isRunning(proc);
                if (activePid) Monitor.stopProcess(activePid);
                await updateProcess(args.id, { pid: null, status: 'stopped' });
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'restart_process') {
                if (!hasPerm('processes_restart')) throw new Error('Forbidden');
                const proc = await getProcessById(args.id);
                if (!proc) throw new Error('Not found');
                const activePid = Monitor.isRunning(proc);
                if (activePid) Monitor.stopProcess(activePid);
                const newPid = Monitor.startProcess(proc);
                if (!newPid) {
                  await updateProcess(args.id, { status: 'crashed' });
                  throw new Error('Process failed to respawn');
                }
                await updateProcess(args.id, { pid: newPid, status: 'running' });
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'delete_process') {
                if (!hasPerm('processes_delete')) throw new Error('Forbidden');
                await deleteProcess(args.id);
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'list_users') {
                if (user.role !== 'owner' && !hasPerm('users_view')) throw new Error('Forbidden');
                const users = await listUsers(1, 100);
                toolResult = JSON.stringify(users.data.map((u: any) => ({id: u.id, username: u.username, role: u.role, locked: !!u.locked_until, permissions: Object.keys(u.permissions || {}).filter(p => u.permissions[p])})));
              }
              else if (fn === 'create_user') {
                if (user.role !== 'owner' && !hasPerm('users_create')) throw new Error('Forbidden');
                if (args.role === 'owner') throw new Error('Forbidden: AI cannot create owner accounts.');
                if (!args.password || args.password.length < 8) throw new Error('Password must be at least 8 characters.');
                
                const hash = await hashPassword(args.password);
                const id = await createUser(args.username, hash, args.role as any);
                broadcastUsersRefresh();
                toolResult = JSON.stringify({ success: true, id });
              }
              else if (fn === 'update_user') {
                if (user.role !== 'owner' && !hasPerm('users_edit')) throw new Error('Forbidden');
                await requireTargetNotOwner(args.id);
                const updates: any = {};
                if (args.username) updates.username = args.username;
                if (args.email) updates.email = args.email;
                if (args.role) {
                  if (args.role === 'owner') throw new Error('Forbidden: AI cannot assign owner role.');
                  updates.role = args.role;
                }
                if (args.password) updates.passwordHash = await hashPassword(args.password);
                await updateUser(args.id, updates);
                broadcastUsersRefresh(args.id);
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'disable_user') {
                if (user.role !== 'owner' && !hasPerm('users_disable')) throw new Error('Forbidden');
                await requireTargetNotOwner(args.id);
                await disableUser(args.id);
                broadcastUsersRefresh(args.id);
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'enable_user') {
                if (user.role !== 'owner' && !hasPerm('users_edit')) throw new Error('Forbidden');
                await requireTargetNotOwner(args.id);
                await enableUser(args.id);
                broadcastUsersRefresh(args.id);
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'delete_user') {
                if (user.role !== 'owner' && !hasPerm('users_delete')) throw new Error('Forbidden');
                await requireTargetNotOwner(args.id);
                await deleteUser(args.id);
                broadcastUsersRefresh();
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'reset_2fa') {
                if (user.role !== 'owner' && !hasPerm('users_reset_2fa')) throw new Error('Forbidden');
                await requireTargetNotOwner(args.id);
                await setTotpSecret(args.id, null);
                broadcastUsersRefresh(args.id);
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'list_api_keys') {
                if (!hasPerm('api_keys_view')) throw new Error('Forbidden');
                const keys = await listAllApiTokens();
                toolResult = JSON.stringify(keys.map((k: any) => ({id: k.id, name: k.name, user_id: k.user_id, is_disabled: k.is_disabled, permissions: Object.keys(k.permissions || {}).filter(p => k.permissions[p])})));
              }
              else if (fn === 'create_api_key') {
                if (!hasPerm('api_keys_create')) throw new Error('Forbidden');
                if (user.role !== 'owner' && args.user_id !== user.id) {
                  throw new Error('You can only create API keys for yourself.');
                }
                const { raw, hash } = generateApiToken();
                const id = await createApiToken(args.user_id, args.name, hash, '{}');
                broadcastApiKeysRefresh();
                toolResult = JSON.stringify({ success: true, token: raw, id });
              }
              else if (fn === 'delete_api_key') {
                if (!hasPerm('api_keys_delete')) throw new Error('Forbidden');
                if (user.role !== 'owner') {
                  const tokens = await listAllApiTokens();
                  const t = tokens.find((x: any) => x.id === args.id);
                  if (!t || t.user_id !== user.id) throw new Error('You can only delete your own API keys.');
                }
                await deleteApiToken(args.id);
                broadcastApiKeysRefresh();
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'disable_api_key') {
                if (!hasPerm('api_keys_disable')) throw new Error('Forbidden');
                if (user.role !== 'owner') {
                  const tokens = await listAllApiTokens();
                  const t = tokens.find((x: any) => x.id === args.id);
                  if (!t || t.user_id !== user.id) throw new Error('You can only disable your own API keys.');
                }
                await disableApiToken(args.id);
                broadcastApiKeysRefresh();
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'get_settings') {
                if (user.role !== 'owner' && !hasPerm('settings_view')) throw new Error('Forbidden: Missing settings_view');
                const st = await getAllSettings();
                delete st['ai_api_key']; // obfuscate
                toolResult = JSON.stringify(st);
              }
              else if (fn === 'update_setting') {
                const safeKey = String(args.key || '').trim().toLowerCase();
                
                if (safeKey.startsWith('ai_')) {
                  throw new Error('Hardcoded safeguard: The AI cannot modify its own configuration.');
                }
                
                const allowedSettings = ['maintenance_mode', 'enable_captcha'];
                if (!allowedSettings.includes(safeKey)) {
                  throw new Error(`AI can only modify these settings: ${allowedSettings.join(', ')}`);
                }
                
                if (args.value !== '0' && args.value !== '1') {
                  throw new Error('Value must be "0" or "1" for these settings.');
                }
                
                if (safeKey === 'maintenance_mode') {
                  if (user.role !== 'owner' && !hasPerm('settings_maintenance')) throw new Error('Missing settings_maintenance permission');
                } else if (safeKey === 'enable_captcha') {
                  if (user.role !== 'owner' && !hasPerm('settings_captcha')) throw new Error('Missing settings_captcha permission');
                }
                
                await setSetting(safeKey, args.value);
                broadcastSettingUpdated(safeKey, args.value);
                toolResult = JSON.stringify({ success: true });
              }
              else if (fn === 'run_terminal_command') {
                if (user.role !== 'owner' && !hasPerm('terminal_unrestricted')) throw new Error('Forbidden: Requires terminal_unrestricted permission');
                // Cap AI execution to 5 seconds and 128KB buffer to prevent DoS
                const { stdout, stderr } = await execAsync(args.command, { timeout: 5000, maxBuffer: 128 * 1024 });
                toolResult = JSON.stringify({ stdout: stdout.slice(0, 5000), stderr: stderr.slice(0, 5000) });
              }
              else {
                toolResult = `Unknown tool: ${fn}`;
              }
            } catch (err: any) {
              toolResult = `Error: ${err.message}`;
            }
            messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: toolResult });
          }
      } else {
          responseText = msg.content || '';
          isDone = true;
      }
    }

      if (!responseText.trim()) {
        responseText = loopCount >= 20 
          ? "I reached my internal processing limit. Check if the action succeeded." 
          : "Done.";
      }

    const id = await addAiHistory(user.id, message, responseText);
    broadcastAiHistoryUpdated();

      return c.json({ 
        success: true, 
        data: { id, user_id: user.id, message, response: responseText, created_at: new Date().toISOString() }
      });
    } catch (err: any) {
      console.error('AI Chat Error:', err);
      return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
    }
});

aiRouter.get('/my-history', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '50', 10)), 100);
    const result = await getMyAiHistory(user.id, limit, (page - 1) * limit);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

aiRouter.get('/history', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ success: false, error: 'Access Denied' }, 403);
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '50', 10)), 100);
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const result = await getAiHistory(limit, (page - 1) * limit, startDate, endDate);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

aiRouter.delete('/history/:id', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ success: false, error: 'Access Denied' }, 403);
    const id = parseInt(c.req.param('id'));
    const success = await deleteAiHistory(id);
    if (success) {
      broadcastAiHistoryUpdated();
      return c.json({ success: true });
    }
    return c.json({ success: false, error: 'Record not found' }, 404);
  } catch (err: any) {
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

aiRouter.get('/bounds', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ success: false, error: 'Access Denied' }, 403);
    const bounds = await getAiHistoryBounds();
    return c.json({ success: true, data: bounds });
  } catch (err: any) {
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export { aiRouter };
