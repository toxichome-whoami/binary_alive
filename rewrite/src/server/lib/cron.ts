import { getAllProcesses, updateProcess } from '../db/processes.js';
import { cleanupExpiredSessions } from '../db/sessions.js';
import { logAudit } from '../db/logs.js';
import { Monitor } from './monitor.js';

export async function runAutorestart(): Promise<{ checked: number; restarted: number }> {
  let restarted = 0;

  try {
    const processes = await getAllProcesses();
    const desiredRunning = processes.filter((p) => p.status === 'running' && p.auto_restart);

    for (const p of desiredRunning) {
      const activePid = Monitor.isRunning(p);

      if (!activePid) {
        console.log(`[AutoRestart] Process "${p.name}" is dead! Attempting automatic restart...`);
        const newPid = Monitor.startProcess(p);

        if (newPid) {
          await updateProcess(p.id, {
            pid: newPid,
            restart_count: p.restart_count + 1,
            last_restart: new Date().toISOString(),
          });
          await logAudit(
            null,
            'CRON',
            'auto_restart',
            `Auto-restarted crashed process "${p.name}" with PID ${newPid}`
          );
          restarted++;
        }
      } else if (p.pid !== activePid) {
        // Sync PID if changed out of band
        await updateProcess(p.id, { pid: activePid });
      }
    }

    // Periodically remove stale expired sessions from Turso
    await cleanupExpiredSessions();
  } catch (err) {
    console.error('[AutoRestart] Error during cycle:', err);
  }

  return { checked: 0, restarted };
}
