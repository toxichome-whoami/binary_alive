import * as pty from 'node-pty';
import os from 'os';
import { logAudit } from '../db/logs.js';

export const ptyMap = new Map<any, pty.IPty>();

export function handleTerminalConnection(ws: any, user: any) {
  // We only allow users with terminal_access
  if (!user || (!user.permissions?.terminal_access && user.role !== 'owner')) {
    ws.send('\r\nError: You do not have permission to access the terminal.\r\n');
    ws.close();
    return;
  }

  const isWin = os.platform() === 'win32';
  const shell = isWin ? 'powershell.exe' : 'bash';
  const args = isWin ? ['-NoLogo'] : [];
  
  // Set up initial environment
  const env = { ...process.env };
  
  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: env as any,
    });
  } catch (err: any) {
    console.error("PTY SPAWN ERROR:", err);
    ws.send(JSON.stringify({ type: 'data', data: '\r\nFailed to spawn terminal: ' + err.message + '\r\n' }));
    ws.close();
    return;
  }

  ptyMap.set(ws.raw || ws, ptyProcess);

  // Log the session start
  logAudit(user.id, user.username, 'terminal_session_start', `Started interactive ${shell} session`).catch(console.error);

  ptyProcess.onData((data) => {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify({ type: 'data', data }));
    }
  });
}
