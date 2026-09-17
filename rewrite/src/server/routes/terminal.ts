import { Hono } from 'hono';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logAudit } from '../db/logs.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const terminalRouter = new Hono();

terminalRouter.use('*', requireAuth(), requireRole(['admin']));

// In-memory working directory per user
const userCwdMap = new Map<number, string>();

terminalRouter.post('/', async (c) => {
  const user = c.get('user');
  const { cmd } = await c.req.json();
  const trimmed = (cmd || '').trim();

  if (!trimmed) {
    return c.json({ success: false, message: 'No command provided' }, 400);
  }

  if (trimmed.length > 2000) {
    return c.json({ success: false, message: 'Command too long (max 2000 characters)' }, 400);
  }

  await logAudit(user.id, user.username, 'terminal_command', `Command: ${trimmed}`);

  let currentCwd = userCwdMap.get(user.id) || os.homedir() || process.cwd();

  // Intercept `cd` command to change directory
  const cdMatch = trimmed.match(/^cd\s*(.*)$/);
  if (cdMatch) {
    let target = cdMatch[1].trim();
    if (!target || target === '~') {
      target = os.homedir();
    }
    // Remove surrounding quotes
    target = target.replace(/^['"](.*)['"]$/, '$1');

    const resolved = path.isAbsolute(target) ? target : path.resolve(currentCwd, target);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      userCwdMap.set(user.id, resolved);
      return c.json({
        success: true,
        output: '',
        exit_code: 0,
        timed_out: false,
        cwd: resolved,
      });
    } else {
      return c.json({
        success: true,
        output: `cd: ${target}: No such file or directory`,
        exit_code: 1,
        timed_out: false,
        cwd: currentCwd,
      });
    }
  }

  // Execute shell command with a 30-second timeout
  const timeoutMs = 30000;

  return new Promise<Response>((resolve) => {
    let timedOut = false;

    // Force stderr into stdout on Unix
    const finalCmd = process.platform !== 'win32' ? `/bin/bash -c ${JSON.stringify(trimmed + ' 2>&1')}` : trimmed;

    const child = exec(
      finalCmd,
      {
        cwd: currentCwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error && error.killed) {
          timedOut = true;
        }

        const combinedOutput = stdout || stderr || (error ? error.message : '');
        const exitCode = error && error.code !== undefined ? error.code : 0;

        resolve(
          c.json({
            success: true,
            output: combinedOutput,
            exit_code: exitCode,
            timed_out: timedOut,
            cwd: currentCwd,
          })
        );
      }
    );

    // Stdin is closed immediately for non-interactive execution
    child.stdin?.end();
  });
});
