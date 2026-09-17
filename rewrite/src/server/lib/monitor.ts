import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import type { ProcessRecord } from '../types/index.js';

export class Monitor {
  public static isRunning(proc: ProcessRecord): number | false {
    if (proc.pid) {
      try {
        const isWindows = os.platform() === 'win32';
        if (isWindows) {
          const out = execSync(`tasklist /FI "PID eq ${proc.pid}" /NH`).toString();
          if (out.includes(String(proc.pid))) {
            return proc.pid;
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

  public static getMetrics(pid: number): { cpu: string; mem: string; uptime: string } {
    if (!pid || pid <= 0) {
      return { cpu: '0', mem: '0 MB', uptime: '00:00:00' };
    }

    try {
      if (process.platform === 'win32') {
        return { cpu: '0', mem: '10 MB', uptime: '00:00:00' };
      }

      const out = execSync(`ps -p ${pid} -o %cpu,rss,etime --no-headers`).toString().trim();
      const parts = out.split(/\s+/);
      if (parts.length >= 3) {
        const rssKb = parseInt(parts[1], 10) || 0;
        const memMb = (rssKb / 1024).toFixed(1) + ' MB';
        return {
          cpu: parts[0] || '0',
          mem: memMb,
          uptime: parts[2] || '00:00:00',
        };
      }
    } catch {
      // Process likely terminated
    }

    return { cpu: '0', mem: '0 MB', uptime: '00:00:00' };
  }

  public static startProcess(p: ProcessRecord): number | false {
    try {
      const dir = p.working_dir && fs.existsSync(p.working_dir) ? p.working_dir : process.cwd();
      const logFile = p.log_file || '/dev/null';

      let outFd: number | 'ignore' = 'ignore';
      try {
        outFd = fs.openSync(logFile, 'a');
      } catch {
        outFd = 'ignore';
      }

      const child = spawn(p.command, {
        cwd: dir,
        shell: true,
        detached: true,
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
