<?php
/**
 * includes/ProcessManager.php
 * High-performance cross-platform process supervisor and metrics collector.
 * Automatically utilizes Linux kernel /proc and posix signals in production (cPanel),
 * and native PowerShell/tasklist when running locally on Windows.
 */

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

class ProcessManager {
    /** @var array<int, array{cpu: string, mem: string, uptime: string}>|null In-memory cache of batch metrics */
    private static $batchMetricsCache = null;

    public static function isWindows() {
        return PHP_OS_FAMILY === 'Windows';
    }

    /**
     * Check if the native supervisor background daemon is running.
     *
     * @return bool
     */
    public static function isDaemonRunning() {
        $pidFile = __DIR__ . '/../db/.daemon.pid';
        if (!file_exists($pidFile)) {
            return false;
        }

        $pid = (int)trim((string)@file_get_contents($pidFile));
        if ($pid <= 0) {
            return false;
        }

        if (self::isWindows()) {
            $out = @shell_exec("tasklist /FI \"PID eq $pid\" /FO CSV /NH 2>nul");
            if ($out && strpos($out, "\"$pid\"") !== false) {
                return true;
            }
        } else {
            if (function_exists('posix_kill')) {
                if (@posix_kill($pid, 0)) {
                    return true;
                }
            } elseif (is_dir("/proc/$pid")) {
                return true;
            } else {
                $out = @shell_exec("ps -p $pid -o pid= --no-headers");
                if (!empty(trim((string)$out))) {
                    return true;
                }
            }
        }

        @unlink($pidFile);
        return false;
    }

    /**
     * Launch the native background supervisor daemon detached.
     *
     * @return bool
     */
    public static function startDaemon() {
        if (self::isDaemonRunning()) {
            return true;
        }

        $phpBin = PHP_BINARY;
        $daemonScript = realpath(__DIR__ . '/../daemon.php');
        $workDir = realpath(__DIR__ . '/..');

        if (self::isWindows()) {
            $psCmd = "Start-Process -FilePath " . escapeshellarg($phpBin) . " -ArgumentList " . escapeshellarg($daemonScript) . " -WorkingDirectory " . escapeshellarg($workDir) . " -WindowStyle Hidden";
            @shell_exec("powershell -NoProfile -ExecutionPolicy Bypass -Command \"$psCmd\"");
        } else {
            @shell_exec("nohup " . escapeshellarg($phpBin) . " " . escapeshellarg($daemonScript) . " > /dev/null 2>&1 &");
        }

        usleep(400000);
        return self::isDaemonRunning();
    }

    /**
     * Stop the native background supervisor daemon.
     *
     * @return bool
     */
    public static function stopDaemon() {
        $pidFile = __DIR__ . '/../db/.daemon.pid';
        if (file_exists($pidFile)) {
            $pid = (int)trim((string)@file_get_contents($pidFile));
            if ($pid > 0) {
                self::stopProcess($pid);
            }
            @unlink($pidFile);
        }
        return true;
    }

    /**
     * Check if a process is alive.
     *
     * @param array $process Process record from database
     * @return int|false Returns PID if running, false otherwise
     */
    public static function isRunning($process) {
        $expectedPid = !empty($process['pid']) ? (int)$process['pid'] : null;

        // Windows Environment
        if (self::isWindows()) {
            if ($expectedPid && $expectedPid > 0) {
                $out = @shell_exec("tasklist /FI \"PID eq $expectedPid\" /FO CSV /NH 2>nul");
                if ($out && strpos($out, "\"$expectedPid\"") !== false) {
                    return $expectedPid;
                }
            }

            // Fallback: check if the executable name is running
            if (!empty($process['command'])) {
                $cmdParts = explode(' ', trim($process['command']));
                $first = basename(str_replace(['"', "'"], '', $cmdParts[0]));
                if (!preg_match('/\.(exe|bat|cmd)$/i', $first)) {
                    $first .= '.exe';
                }
                $out = @shell_exec("tasklist /FI \"IMAGENAME eq $first\" /FO CSV /NH 2>nul");
                if ($out && strpos($out, "\"$first\"") !== false) {
                    $lines = explode("\n", trim($out));
                    if (!empty($lines[0])) {
                        $cols = str_getcsv($lines[0]);
                        if (!empty($cols[1]) && is_numeric($cols[1])) {
                            return (int)$cols[1];
                        }
                    }
                }
            }

            return false;
        }

        // Linux Environment
        if ($expectedPid && $expectedPid > 0) {
            // 1. Fast path: posix_kill
            if (function_exists('posix_kill')) {
                if (@posix_kill($expectedPid, 0)) {
                    if (self::verifyCommandMatch($expectedPid, $process['command'])) {
                        return $expectedPid;
                    }
                }
            }
            // 2. Fast path: /proc
            elseif (is_dir("/proc/$expectedPid")) {
                if (self::verifyCommandMatch($expectedPid, $process['command'])) {
                    return $expectedPid;
                }
            }
            // 3. Fallback
            else {
                $output = @shell_exec("ps -p $expectedPid -o pid= --no-headers");
                if (!empty(trim((string)$output))) {
                    return $expectedPid;
                }
            }
        }

        // Process was not found by stored PID; attempt fallback lookup by command string
        if (!empty($process['command'])) {
            $cmd = escapeshellarg($process['command']);
            $output = @shell_exec("ps aux | grep $cmd | grep -v grep | awk '{print $2}'");
            if ($output) {
                $lines = explode("\n", trim($output));
                $foundPid = (int)trim($lines[0] ?? '');
                if ($foundPid > 0) {
                    return $foundPid;
                }
            }
        }

        return false;
    }

    /**
     * Verify that a running PID matches the expected command string.
     *
     * @param int $pid
     * @param string $expectedCommand
     * @return bool
     */
    private static function verifyCommandMatch($pid, $expectedCommand) {
        $cmdlineFile = "/proc/$pid/cmdline";
        if (is_readable($cmdlineFile)) {
            $cmdline = @file_get_contents($cmdlineFile);
            if ($cmdline !== false) {
                $cmdline = str_replace("\0", " ", $cmdline);
                $cleanExpected = trim(explode(' ', $expectedCommand)[0] ?? '');
                if ($cleanExpected !== '' && strpos($cmdline, basename($cleanExpected)) !== false) {
                    return true;
                }
            }
        }
        return true;
    }

    /**
     * Pre-fetch metrics for all running processes in a single batch subshell command.
     *
     * @return void
     */
    public static function preloadBatchMetrics() {
        if (self::$batchMetricsCache !== null) {
            return;
        }

        self::$batchMetricsCache = [];

        if (self::isWindows()) {
            return; // Handled per-process on Windows
        }

        $output = @shell_exec("ps -eo pid,%cpu,rss,etime --no-headers");
        if (!$output) {
            return;
        }

        $lines = explode("\n", trim($output));
        foreach ($lines as $line) {
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) >= 4) {
                $pid = (int)$parts[0];
                $cpu = $parts[1];
                $rssKb = (int)$parts[2];
                $etime = $parts[3];

                self::$batchMetricsCache[$pid] = [
                    'cpu' => $cpu,
                    'mem' => round($rssKb / 1024, 1) . ' MB',
                    'uptime' => $etime
                ];
            }
        }
    }

    /**
     * Get resource metrics for a specific PID.
     *
     * @param int|null $pid
     * @return array{cpu: mixed, mem: mixed, uptime: string}
     */
    public static function getMetrics($pid) {
        if (!$pid || $pid <= 0) {
            return ['cpu' => 0, 'mem' => '0 MB', 'uptime' => '00:00:00'];
        }

        $pid = (int)$pid;

        // Windows Environment
        if (self::isWindows()) {
            $out = @shell_exec("tasklist /FI \"PID eq $pid\" /FO CSV /NH 2>nul");
            if ($out && preg_match('/"([^"]+)"\s*$/', trim($out), $m)) {
                $memStr = str_replace([',', ' '], '', $m[1]);
                $memKb = (int)$memStr;
                $memMb = round($memKb / 1024, 1) . ' MB';
                return ['cpu' => '0.0', 'mem' => $memMb, 'uptime' => 'active'];
            }
            return ['cpu' => 0, 'mem' => '0 MB', 'uptime' => '00:00:00'];
        }

        // Use batch cache if preloaded
        if (self::$batchMetricsCache !== null && isset(self::$batchMetricsCache[$pid])) {
            return self::$batchMetricsCache[$pid];
        }

        // Direct /proc check on Linux
        if (is_readable("/proc/$pid/status")) {
            $status = @file_get_contents("/proc/$pid/status");
            if ($status && preg_match('/VmRSS:\s+(\d+)\s+kB/', $status, $m)) {
                $memMb = round(((int)$m[1]) / 1024, 1) . ' MB';
                return ['cpu' => '0.0', 'mem' => $memMb, 'uptime' => 'active'];
            }
        }

        // Fallback single ps execution
        $output = @shell_exec("ps -p $pid -o %cpu,rss,etime --no-headers");
        if ($output) {
            $parts = preg_split('/\s+/', trim($output));
            if (count($parts) >= 3) {
                $rss_kb = (int)$parts[1];
                return [
                    'cpu' => $parts[0],
                    'mem' => round($rss_kb / 1024, 1) . ' MB',
                    'uptime' => $parts[2]
                ];
            }
        }

        return ['cpu' => 0, 'mem' => '0 MB', 'uptime' => '00:00:00'];
    }

    /**
     * Start a monitored process in the background.
     *
     * @param array $process
     * @return int|false Returns new PID or false on failure
     */
    public static function startProcess($process) {
        $cmd = $process['command'];
        $dir = !empty($process['working_dir']) && is_dir($process['working_dir']) ? $process['working_dir'] : __DIR__ . '/..';
        $log = !empty($process['log_file']) ? $process['log_file'] : null;

        // Windows Execution
        if (self::isWindows()) {
            $cleanDir = rtrim($dir, "\\/");
            $parts = explode(' ', trim($cmd), 2);
            $exePart = str_replace(['"', "'"], '', $parts[0]);
            $argsPart = $parts[1] ?? '';

            // Check if binary has .exe extension or exists with .exe in working directory
            $targetExe = $exePart;
            if (!preg_match('/\.(exe|bat|cmd|ps1)$/i', $exePart)) {
                $candidate = $cleanDir . DIRECTORY_SEPARATOR . $exePart . '.exe';
                if (file_exists($candidate)) {
                    $targetExe = $candidate;
                }
            } elseif (!file_exists($targetExe) && file_exists($cleanDir . DIRECTORY_SEPARATOR . $exePart)) {
                $targetExe = $cleanDir . DIRECTORY_SEPARATOR . $exePart;
            }

            $b64Exe = base64_encode($targetExe);
            $b64Args = base64_encode($argsPart);
            $b64Dir = base64_encode($cleanDir);

            $psScript = "\$procExe = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('$b64Exe')); " .
                        "\$procArgs = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('$b64Args')); " .
                        "\$procDir = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('$b64Dir')); " .
                        "\$sp = @{ FilePath = \$procExe; WorkingDirectory = \$procDir; WindowStyle = 'Hidden'; PassThru = \$true }; " .
                        "if (\$procArgs -ne '') { \$sp['ArgumentList'] = \$procArgs }; " .
                        "\$p = Start-Process @sp; " .
                        "Write-Output \$p.Id";

            $output = @shell_exec("powershell -NoProfile -ExecutionPolicy Bypass -Command \"$psScript\"");
            $pid = (int)trim((string)$output);
            return ($pid > 0) ? $pid : false;
        }

        // Linux Execution
        $sanitizedCmd = escapeshellcmd($cmd);
        $logTarget = !empty($log) ? $log : '/dev/null';
        $fullCmd = "nohup $sanitizedCmd > " . escapeshellarg($logTarget) . " 2>&1 & echo $!";

        $descriptorspec = [
            0 => ["file", "/dev/null", "r"],
            1 => ["pipe", "w"],
            2 => ["file", "/dev/null", "w"]
        ];

        $proc = @proc_open($fullCmd, $descriptorspec, $pipes, $dir);
        if (is_resource($proc)) {
            $pid = trim((string)stream_get_contents($pipes[1]));
            fclose($pipes[1]);
            proc_close($proc);
            $cleanPid = (int)$pid;
            return $cleanPid > 0 ? $cleanPid : false;
        }

        return false;
    }

    /**
     * Stop a monitored process cleanly.
     *
     * @param int $pid
     * @return bool
     */
    public static function stopProcess($pid) {
        $pid = (int)$pid;
        if ($pid <= 0) {
            return false;
        }

        // Windows Execution
        if (self::isWindows()) {
            @shell_exec("taskkill /F /T /PID $pid 2>nul");
            return true;
        }

        // Linux Execution
        if (function_exists('posix_kill')) {
            @posix_kill($pid, 15); // SIGTERM
            usleep(50000);
            if (!@posix_kill($pid, 0)) {
                return true;
            }
            @posix_kill($pid, 9); // SIGKILL
            return true;
        }

        @shell_exec("kill -9 $pid 2>/dev/null");
        return true;
    }

    /**
     * Get system-wide load average and memory stats.
     *
     * @return array{load: string, mem_usage: string}
     */
    public static function getSystemMetrics() {
        $sysLoad = '---';
        if (function_exists('sys_getloadavg')) {
            $loadArr = @sys_getloadavg();
            if ($loadArr && isset($loadArr[0])) {
                $sysLoad = round($loadArr[0], 2);
            }
        }
        if ($sysLoad === '---' && is_readable('/proc/loadavg')) {
            $loadData = @file_get_contents('/proc/loadavg');
            if ($loadData) {
                $parts = explode(' ', trim($loadData));
                if (isset($parts[0])) {
                    $sysLoad = round((float)$parts[0], 2);
                }
            }
        }

        $memUsage = '---';
        if (is_readable('/proc/meminfo')) {
            $meminfo = @file_get_contents('/proc/meminfo');
            if ($meminfo) {
                preg_match('/MemTotal:\s+(\d+)\s+kB/', $meminfo, $totalMatch);
                preg_match('/MemAvailable:\s+(\d+)\s+kB/', $meminfo, $availMatch);
                if (!empty($totalMatch[1]) && !empty($availMatch[1])) {
                    $totalMb = round((int)$totalMatch[1] / 1024);
                    $usedMb = round(((int)$totalMatch[1] - (int)$availMatch[1]) / 1024);
                    $memUsage = "{$usedMb} / {$totalMb} MB";
                }
            }
        }

        return [
            'load' => (string)$sysLoad,
            'mem_usage' => $memUsage
        ];
    }
}
