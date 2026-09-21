import { db } from '../db/client.js';
import { Hono } from 'hono';
import {
  getAllProcesses,
  getProcessById,
  createProcess,
  updateProcess,
  deleteProcess,
} from '../db/processes.js';
import { logAudit } from '../db/logs.js';
import { Monitor } from '../lib/monitor.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const processRouter = new Hono();

processRouter.use('*', requireAuth());

// Fetch process status with live metrics
let statusCache: { data: any[]; sys_load: string | number; timestamp: number } | null = null;
const CACHE_TTL_MS = 500;

processRouter.get('/', requirePermission('processes_view'), async (c) => {
  const now = Date.now();
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL || '1000', 10);

  if (statusCache && now - statusCache.timestamp < CACHE_TTL_MS) {
    return c.json({
      success: true,
      data: statusCache.data,
      sys_load: statusCache.sys_load,
      poll_interval_ms: pollIntervalMs
    });
  }

  const processes = await getAllProcesses();
  const sysLoad = Monitor.getSysLoad();

  const enriched = await Promise.all(
    processes.map(async (proc) => {
      const activePid = Monitor.isRunning(proc);

      if (activePid) {
        const metrics = await Monitor.getMetrics(activePid);
        return {
          ...proc,
          status: 'running',
          pid: activePid,
          cpu: metrics.cpu,
          mem: metrics.mem,
          uptime: metrics.uptime,
        };
      } else if (proc.status === 'running') {
          // Process died unexpectedly
          if (proc.auto_restart) {
            const newPid = Monitor.startProcess(proc);
            if (newPid) {
              const restartedProc = { ...proc, pid: newPid, status: 'running' as const, restart_count: proc.restart_count + 1 };
              await updateProcess(proc.id, restartedProc);
              return { ...restartedProc, cpu: '0.0%', mem: '0 MB', uptime: '00:00:00' };
            }
          }
          
          await updateProcess(proc.id, { pid: null, status: 'stopped' });
          return {
            ...proc,
            status: 'stopped',
            pid: null,
            cpu: '0.0%',
            mem: '0 MB',
            uptime: '00:00:00',
          };
        } else {
        return {
          ...proc,
          status: proc.status === 'crashed' ? 'crashed' : 'stopped',
          pid: null,
          cpu: 0,
          mem: '0 MB',
          uptime: '00:00:00',
        };
      }
    })
  );

  statusCache = { data: enriched, sys_load: sysLoad, timestamp: Date.now() };
    return c.json({
      success: true,
      data: enriched,
      sys_load: sysLoad,
      poll_interval_ms: pollIntervalMs
    });
});



// Get telemetry bounds
processRouter.get('/telemetry/bounds', requirePermission('processes_view'), async (c) => {
  try {
    const result = await db.execute({
      sql: `SELECT MIN(timestamp) as min_time FROM telemetry_logs`,
      args: []
    });
    return c.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[API] Telemetry bounds error:', err);
    return c.json({ success: false, message: 'Failed to fetch bounds' }, 500);
  }
});

// Get telemetry logs
processRouter.get('/telemetry', requirePermission('processes_view'), async (c) => {
  try {
    const minutes = parseInt(c.req.query('minutes') || '0', 10);
    const start = c.req.query('start');
    const end = c.req.query('end');
    
    let result;
    if (start && end) {
      result = await db.execute({
        sql: `SELECT cpu, memory_mb, sys_load, active_procs, restarts, timestamp 
              FROM telemetry_logs 
              WHERE timestamp >= datetime(?) AND timestamp <= datetime(?)
              ORDER BY timestamp ASC`,
        args: [start, end]
      });
    } else {
      const min = minutes > 0 ? minutes : 1440;
      result = await db.execute({
        sql: `SELECT cpu, memory_mb, sys_load, active_procs, restarts, timestamp 
              FROM telemetry_logs 
              WHERE timestamp >= datetime('now', '-' || ? || ' minutes')
              ORDER BY timestamp ASC`,
        args: [min]
      });
    }
    return c.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API] Telemetry fetch error:', err);
    return c.json({ success: false, message: 'Failed to fetch telemetry' }, 500);
  }
});

// Get single process
processRouter.get('/:id', requirePermission('processes_edit'), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const process = await getProcessById(id);
  if (!process) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }
  return c.json({ success: true, data: { process } });
});

// Create new process
processRouter.post('/', requirePermission('processes_edit'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.name || !body.command) {
    return c.json({ success: false, message: 'Name and command are required.' }, 400);
  }

  const id = await createProcess({
    name: body.name.trim(),
    group_name: (body.group_name || 'Default').trim(),
    command: body.command.trim(),
    working_dir: body.working_dir?.trim(),
    log_file: body.log_file?.trim(),
  });

  await logAudit(user.id, user.username, 'add_process', `Registered binary: ${body.name}`);
  return c.json({ success: true, data: { id } });
});

// Update process
processRouter.put('/:id', requirePermission('processes_edit'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  const existing = await getProcessById(id);
  if (!existing) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }

  await updateProcess(id, {
    name: body.name ? body.name.trim() : existing.name,
    group_name: body.group_name ? body.group_name.trim() : existing.group_name,
    command: body.command ? body.command.trim() : existing.command,
    working_dir: body.working_dir !== undefined ? body.working_dir.trim() : existing.working_dir,
    log_file: body.log_file !== undefined ? body.log_file.trim() : existing.log_file,
  });

  await logAudit(user.id, user.username, 'edit_process', `Updated process: ${existing.name}`);
  return c.json({ success: true, message: 'Process configuration updated.' });
});

// Delete process
processRouter.delete('/:id', requirePermission('processes_edit'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);

  const existing = await getProcessById(id);
  if (!existing) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }

  // If running, kill it before removing
  const activePid = Monitor.isRunning(existing);
  if (activePid) {
    Monitor.stopProcess(activePid);
  }

  await deleteProcess(id);
  await logAudit(user.id, user.username, 'delete_process', `Deleted process: ${existing.name}`);
  return c.json({ success: true, message: 'Process deleted.' });
});

// Bulk process control
processRouter.post('/bulk/control', requirePermission('processes_view'), async (c) => {
  const user = c.get('user');
  const { ids, cmd } = await c.req.json();

  if (cmd === 'start' && user.role !== 'owner' && !user.permissions.processes_start) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'stop' && user.role !== 'owner' && !user.permissions.processes_stop) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'restart' && user.role !== 'owner' && !user.permissions.processes_restart) return c.json({ success: false, message: 'Forbidden' }, 403);

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, message: 'No processes selected' }, 400);
  }

  const results: Record<number, { success: boolean; pid?: number }> = {};

  for (const id of ids) {
    const proc = await getProcessById(id);
    if (!proc) continue;

    if (cmd === 'start') {
      let newPid = Monitor.startProcess(proc);
      if (!newPid) {
        await updateProcess(id, { status: 'crashed' });
        results[id] = { success: false };
      } else {
        await updateProcess(id, { pid: newPid, status: 'running' });
        results[id] = { success: true, pid: newPid };
      }
    } else if (cmd === 'stop') {
      const activePid = Monitor.isRunning(proc);
      if (activePid) Monitor.stopProcess(activePid);
      await updateProcess(id, { pid: null, status: 'stopped' });
      results[id] = { success: true };
    } else if (cmd === 'restart') {
      const activePid = Monitor.isRunning(proc);
      if (activePid) Monitor.stopProcess(activePid);
      let newPid = Monitor.startProcess(proc);
      if (!newPid) {
        await updateProcess(id, { status: 'crashed' });
        results[id] = { success: false };
      } else {
        await updateProcess(id, {
          pid: newPid,
          status: 'running',
          last_restart: new Date().toISOString(),
          restart_count: (proc.restart_count || 0) + 1,
        });
        results[id] = { success: true, pid: newPid };
      }
    }
  }

  await logAudit(user.id, user.username, 'bulk_process_control', `Bulk ${cmd} executed on ${Object.keys(results).length} processes`);
  return c.json({ success: true, data: { results } });
});

// Single process control (start/stop/restart)
processRouter.post('/:id/control', requirePermission('processes_view'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const { cmd } = await c.req.json();

  if (cmd === 'start' && user.role !== 'owner' && !user.permissions.processes_start) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'stop' && user.role !== 'owner' && !user.permissions.processes_stop) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'restart' && user.role !== 'owner' && !user.permissions.processes_restart) return c.json({ success: false, message: 'Forbidden' }, 403);

  const proc = await getProcessById(id);
  if (!proc) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }

  let newPid: number | false = false;

  if (cmd === 'start') {
    newPid = Monitor.startProcess(proc);
    if (!newPid) {
      await updateProcess(id, { status: 'crashed' });
      return c.json({ success: false, message: 'Process failed to start' }, 500);
    }
    await updateProcess(id, { pid: newPid, status: 'running' });
    await logAudit(user.id, user.username, 'process_start', `Started process: ${proc.name}`);
    return c.json({ success: true, data: { pid: newPid } });
  }

  if (cmd === 'stop') {
    const activePid = Monitor.isRunning(proc);
    if (activePid) {
      Monitor.stopProcess(activePid);
    }
    await updateProcess(id, { pid: null, status: 'stopped' });
    const minutes = parseInt(c.req.query('minutes') || '0', 10);
    const start = c.req.query('start');
    const end = c.req.query('end');
    
    let result;
    if (start && end) {
      result = await db.execute({
        sql: `SELECT cpu, memory_mb, sys_load, active_procs, restarts, timestamp 
              FROM telemetry_logs 
              WHERE timestamp >= datetime(?) AND timestamp <= datetime(?)
              ORDER BY timestamp ASC`,
        args: [start, end]
      });
    } else {
      const min = minutes > 0 ? minutes : 1440;
      result = await db.execute({
        sql: `SELECT cpu, memory_mb, sys_load, active_procs, restarts, timestamp 
              FROM telemetry_logs 
              WHERE timestamp >= datetime('now', '-' || ? || ' minutes')
              ORDER BY timestamp ASC`,
        args: [min]
      });
    }
    return c.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API] Telemetry fetch error:', err);
    return c.json({ success: false, message: 'Failed to fetch telemetry' }, 500);
  }
});

// Get single process
processRouter.get('/:id', requirePermission('processes_edit'), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const process = await getProcessById(id);
  if (!process) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }
  return c.json({ success: true, data: { process } });
});

// Create new process
processRouter.post('/', requirePermission('processes_edit'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.name || !body.command) {
    return c.json({ success: false, message: 'Name and command are required.' }, 400);
  }

  const id = await createProcess({
    name: body.name.trim(),
    group_name: (body.group_name || 'Default').trim(),
    command: body.command.trim(),
    working_dir: body.working_dir?.trim(),
    log_file: body.log_file?.trim(),
  });

  await logAudit(user.id, user.username, 'add_process', `Registered binary: ${body.name}`);
  return c.json({ success: true, data: { id } });
});

// Update process
processRouter.put('/:id', requirePermission('processes_edit'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  const existing = await getProcessById(id);
  if (!existing) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }

  await updateProcess(id, {
    name: body.name ? body.name.trim() : existing.name,
    group_name: body.group_name ? body.group_name.trim() : existing.group_name,
    command: body.command ? body.command.trim() : existing.command,
    working_dir: body.working_dir !== undefined ? body.working_dir.trim() : existing.working_dir,
    log_file: body.log_file !== undefined ? body.log_file.trim() : existing.log_file,
  });

  await logAudit(user.id, user.username, 'edit_process', `Updated process: ${existing.name}`);
  return c.json({ success: true, message: 'Process configuration updated.' });
});

// Delete process
processRouter.delete('/:id', requirePermission('processes_edit'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);

  const existing = await getProcessById(id);
  if (!existing) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }

  // If running, kill it before removing
  const activePid = Monitor.isRunning(existing);
  if (activePid) {
    Monitor.stopProcess(activePid);
  }

  await deleteProcess(id);
  await logAudit(user.id, user.username, 'delete_process', `Deleted process: ${existing.name}`);
  return c.json({ success: true, message: 'Process deleted.' });
});

// Bulk process control
processRouter.post('/bulk/control', requirePermission('processes_view'), async (c) => {
  const user = c.get('user');
  const { ids, cmd } = await c.req.json();

  if (cmd === 'start' && user.role !== 'owner' && !user.permissions.processes_start) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'stop' && user.role !== 'owner' && !user.permissions.processes_stop) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'restart' && user.role !== 'owner' && !user.permissions.processes_restart) return c.json({ success: false, message: 'Forbidden' }, 403);

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, message: 'No processes selected' }, 400);
  }

  const results: Record<number, { success: boolean; pid?: number }> = {};

  for (const id of ids) {
    const proc = await getProcessById(id);
    if (!proc) continue;

    if (cmd === 'start') {
      let newPid = Monitor.startProcess(proc);
      if (!newPid) {
        await updateProcess(id, { status: 'crashed' });
        results[id] = { success: false };
      } else {
        await updateProcess(id, { pid: newPid, status: 'running' });
        results[id] = { success: true, pid: newPid };
      }
    } else if (cmd === 'stop') {
      const activePid = Monitor.isRunning(proc);
      if (activePid) Monitor.stopProcess(activePid);
      await updateProcess(id, { pid: null, status: 'stopped' });
      results[id] = { success: true };
    } else if (cmd === 'restart') {
      const activePid = Monitor.isRunning(proc);
      if (activePid) Monitor.stopProcess(activePid);
      let newPid = Monitor.startProcess(proc);
      if (!newPid) {
        await updateProcess(id, { status: 'crashed' });
        results[id] = { success: false };
      } else {
        await updateProcess(id, {
          pid: newPid,
          status: 'running',
          last_restart: new Date().toISOString(),
          restart_count: (proc.restart_count || 0) + 1,
        });
        results[id] = { success: true, pid: newPid };
      }
    }
  }

  await logAudit(user.id, user.username, 'bulk_process_control', `Bulk ${cmd} executed on ${Object.keys(results).length} processes`);
  return c.json({ success: true, data: { results } });
});

// Single process control (start/stop/restart)
processRouter.post('/:id/control', requirePermission('processes_view'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const { cmd } = await c.req.json();

  if (cmd === 'start' && user.role !== 'owner' && !user.permissions.processes_start) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'stop' && user.role !== 'owner' && !user.permissions.processes_stop) return c.json({ success: false, message: 'Forbidden' }, 403);
  if (cmd === 'restart' && user.role !== 'owner' && !user.permissions.processes_restart) return c.json({ success: false, message: 'Forbidden' }, 403);

  const proc = await getProcessById(id);
  if (!proc) {
    return c.json({ success: false, message: 'Process not found' }, 404);
  }

  let newPid: number | false = false;

  if (cmd === 'start') {
    newPid = Monitor.startProcess(proc);
    if (!newPid) {
      await updateProcess(id, { status: 'crashed' });
      return c.json({ success: false, message: 'Process failed to start' }, 500);
    }
    await updateProcess(id, { pid: newPid, status: 'running' });
    await logAudit(user.id, user.username, 'process_start', `Started process: ${proc.name}`);
    return c.json({ success: true, data: { pid: newPid } });
  }

  if (cmd === 'stop') {
    const activePid = Monitor.isRunning(proc);
    if (activePid) {
      Monitor.stopProcess(activePid);
    }
    await updateProcess(id, { pid: null, status: 'stopped' });
    await logAudit(user.id, user.username, 'process_stop', `Stopped process: ${proc.name}`);
    return c.json({ success: true });
  }

  if (cmd === 'restart') {
    const activePid = Monitor.isRunning(proc);
    if (activePid) {
      Monitor.stopProcess(activePid);
    }
    newPid = Monitor.startProcess(proc);
    if (!newPid) {
      await updateProcess(id, { status: 'crashed' });
      return c.json({ success: false, message: 'Process failed to restart' }, 500);
    }
    await updateProcess(id, {
      pid: newPid,
      status: 'running',
      last_restart: new Date().toISOString(),
      restart_count: (proc.restart_count || 0) + 1,
    });
    await logAudit(user.id, user.username, 'process_restart', `Restarted process: ${proc.name}`);
    return c.json({ success: true, data: { pid: newPid } });
  }

  return c.json({ success: false, message: 'Invalid command option' }, 400);
});
