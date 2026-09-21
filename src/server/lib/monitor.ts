import pidusage from 'pidusage';
import { spawn, execSync, exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ProcessRecord } from '../types/index.js';

export class Monitor {
  private static metricsCache = new Map<number, { cpu: string; mem: string; startTimeMs: number; timestamp: number }>();
  public static isRunning(proc: ProcessRecord): number | false {
    if (proc.pid) {
      try {
        const isWindows = os.platform() === 'win32';
        if (isWindows) {
          const out = execSync(`tasklist /FI "PID eq ${proc.pid}" /NH`).toString();
          if (out.includes(String(proc.pid))) {
            const commandParts = proc.command.trim().split(' ');
            const executable = commandParts[0];
            const baseName = path.basename(executable).toLowerCase();
            const outLower = out.toLowerCase();
            
            // Check if the image name matches to prevent PID recycling false-positives
            if (outLower.includes(baseName) || baseName === 'node.js' || baseName === 'node') {
              return proc.pid;
            }
          }
        } else {
          const out = execSync(`ps -p ${proc.pid} -o pid= --no-headers`).toString().trim();
          if (out) {
            return proc.pid;
          }
        }
      } catch {
        // PID is dead
      }
    }

    // Fallback search by command string on Linux/Unix
    if (os.platform() !== 'win32' && proc.command) {
      try {
        const escaped = proc.command.replace(/'/g, "'\\''");
        const out = execSync(`ps aux | grep '${escaped}' | grep -v grep | awk '{print $2}'`)
          .toString()
          .trim();
        const firstPid = parseInt(out.split('\n')[0], 10);
        if (!isNaN(firstPid) && firstPid > 0) {
          return firstPid;
        }
      } catch {
        // Command not found in ps table
      }
    }

    return false;
  }

  public static async getMetrics(pid: number): Promise<{ cpu: string; mem: string; uptime: string }> {
    if (!pid || pid <= 0) {
      return { cpu: '0', mem: '0 MB', uptime: '00:00:00' };
    }
    const formatUptime = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    };

    const cached = this.metricsCache.get(pid);
    if (cached && Date.now() - cached.timestamp < 2500) {
      return {
        cpu: cached.cpu,
        mem: cached.mem,
        uptime: formatUptime(Date.now() - cached.startTimeMs)
      };
    }

    try {
      const stats = await pidusage(pid);
      
      const cpu = Math.max(0, stats.cpu).toFixed(1);
      let memoryBytes = Math.max(0, stats.memory);
      
      // On Windows, fix Total Working Set to match Task Manager's Private Working Set
      if (process.platform === 'win32') {
        try {
          // Task Manager's default "Memory" column actually aligns with PagedMemorySize64 / PrivateMemorySize64 for many native binaries
          const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Process -Id ${pid}).PagedMemorySize64"`);
          const privateMem = parseInt(stdout.trim(), 10);
          if (!isNaN(privateMem) && privateMem > 0) {
            memoryBytes = privateMem;
          }
        } catch (err) {
          // Silent fallback
        }
      }
      
      const memMb = (memoryBytes / 1024 / 1024).toFixed(1) + ' MB';
      
      // Calculate uptime formatted as HH:mm:ss
      const uptimeMs = Math.max(0, stats.elapsed || 0);
      
      const startTimeMs = Date.now() - uptimeMs;
      this.metricsCache.set(pid, { cpu, mem: memMb, startTimeMs, timestamp: Date.now() });
      return { cpu, mem: memMb, uptime: formatUptime(uptimeMs) };
    } catch {
      // ignore
    }
    return { cpu: '0', mem: '0 MB', uptime: '00:00:00' };
  }

  public static startProcess(p: ProcessRecord): number | false {
    try {
      const dir = p.working_dir && fs.existsSync(p.working_dir) ? p.working_dir : process.cwd();
      const logFile = p.log_file || (process.platform === 'win32' ? 'NUL' : '/dev/null');

      let outFd: number | 'ignore' = 'ignore';
      try {
        outFd = fs.openSync(logFile, 'a');
      } catch {
        outFd = 'ignore';
      }

      const commandParts = p.command.trim().split(' ');
      const executable = commandParts[0];
      const args = commandParts.slice(1);

      const child = spawn(executable, args, {
        cwd: dir,
        shell: false,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', outFd, outFd],
      });

      if (child.pid) {
        child.unref();
        return child.pid;
      }
    } catch (err) {
      console.error('[Monitor] Failed to start process:', err);
    }
    return false;
  }

  public static stopProcess(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      try {
        execSync(`kill -9 ${pid}`);
        return true;
      } catch {
        return false;
      }
    }
  }

  public static getSysLoad(): string {
    try {
      if (fs.existsSync('/proc/loadavg')) {
        const content = fs.readFileSync('/proc/loadavg', 'utf8');
        const first = content.split(' ')[0];
        if (first) return Number(first).toFixed(2);
      }
      const load = os.loadavg();
      if (load && load.length > 0 && !isNaN(load[0])) {
        return load[0].toFixed(2);
      }
    } catch {
      // Fallback
    }
    return '---';
  }
}
