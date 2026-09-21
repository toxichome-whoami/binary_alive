import * as pty from 'node-pty';
import os from 'os';
import { exec, spawn } from 'child_process';
import { logAudit } from '../db/logs.js';

export const ptyMap = new Map<any, pty.IPty>();

export function killTerminal(wsKey: any) {
  const ptyProcess = ptyMap.get(wsKey);
  if (!ptyProcess) return;

  const pid = ptyProcess.pid;
  if (os.platform() === 'win32' && Number.isInteger(pid)) {
    // Forcefully kill the process tree on Windows to prevent orphaned powershell/conhost leaks
    spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
    try { ptyProcess.kill(); } catch (e) {}
  } else {
    try { ptyProcess.kill(); } catch (e) {}
  }
  
  ptyMap.delete(wsKey);
}

export function handleTerminalConnection(ws: any, user: any) {
  // We strictly require terminal_unrestricted because PTY provides full shell access
  if (!user || (!user.permissions?.terminal_unrestricted && user.role !== 'owner')) {
    ws.send('\r\nError: You do not have permission to access the terminal.\r\n');
    ws.close();
    return;
  }

  const isWin = os.platform() === 'win32';
  const shell = isWin ? 'powershell.exe' : 'bash';
  const args = isWin ? ['-NoLogo'] : [];
  
  // Scrub environment variables to prevent leaking Turso tokens, Secret Keys, etc.
  const env = { 
    PATH: process.env.PATH, 
    HOME: os.homedir(), 
    LANG: 'C.UTF-8' 
  };
  
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

  ptyProcess.onExit(({ exitCode, signal }) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'data', data: `\r\n[Process exited with code ${exitCode}]\r\n` }));
      ws.close();
    }
    ptyMap.delete(ws.raw || ws);
  });
}
