import { db } from '../db/client.js';
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
        const lastRestart = p.last_restart ? new Date(p.last_restart).getTime() : 0;
        if (Date.now() - lastRestart < 60000) {
           console.log(`[AutoRestart] Backing off restart for "${p.name}" (too soon).`);
           continue;
        }

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

  return { checked: desiredRunning ? desiredRunning.length : 0, restarted };
}


export async function logTelemetryData(): Promise<void> {
  try {
    // Retention prune
    await db.execute("DELETE FROM telemetry_logs WHERE timestamp < datetime('now', '-30 days')");
    await db.execute("DELETE FROM audit_logs WHERE timestamp < datetime('now', '-30 days')");
    await db.execute("DELETE FROM login_attempts WHERE timestamp < datetime('now', '-30 days')");

    const processes = await getAllProcesses();
    let cpuSum = 0;
    let memSum = 0;
    let activeProcs = 0;
    let restarts = 0;

    for (const p of processes) {
      restarts += p.restart_count || 0;
      const activePid = Monitor.isRunning(p);
      if (activePid) {
        activeProcs++;
        const metrics = await Monitor.getMetrics(activePid);
        
        const cpuVal = typeof metrics.cpu === 'number' ? metrics.cpu : parseFloat(String(metrics.cpu).replace('%', ''));
        if (!isNaN(cpuVal)) cpuSum += cpuVal;
        
        let memStr = String(metrics.mem || '0 MB');
        let num = parseFloat(memStr);
        if (!isNaN(num)) {
          if (memStr.toLowerCase().includes('gb')) num *= 1024;
          memSum += num;
        }
      }
    }

    const sysLoad = parseFloat(Monitor.getSysLoad()) || 0;

    await db.execute({
      sql: `INSERT INTO telemetry_logs (cpu, memory_mb, sys_load, active_procs, restarts) VALUES (?, ?, ?, ?, ?)`,
      args: [cpuSum, memSum, sysLoad, activeProcs, restarts],
    });
  } catch (err) {
    console.error('[Telemetry] Failed to log:', err);
  }
}
