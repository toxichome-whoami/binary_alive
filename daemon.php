<?php
/**
 * daemon.php
 * Native background supervisor daemon for Binary Alive.
 * Continuously monitors and auto-restarts managed processes every 2 seconds.
 * Works natively on Windows and Linux without requiring cron.
 * 
 * CLI Usage:
 *   php daemon.php            (Run in foreground)
 *   php daemon.php --start    (Launch detached in background)
 *   php daemon.php --stop     (Stop running background daemon)
 *   php daemon.php --status   (Check daemon status)
 */

require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/ProcessManager.php';

$pidFile = __DIR__ . '/db/.daemon.pid';
$lockFile = __DIR__ . '/db/.daemon.lock';

$arg = $argv[1] ?? '';

// 1. Status check
if ($arg === '--status') {
    if (ProcessManager::isDaemonRunning()) {
        $pid = trim((string)@file_get_contents($pidFile));
        echo "Binary Alive daemon is active (PID: $pid)" . PHP_EOL;
        exit(0);
    } else {
        echo "Binary Alive daemon is stopped." . PHP_EOL;
        exit(1);
    }
}

// 2. Stop daemon
if ($arg === '--stop') {
    if (ProcessManager::isDaemonRunning()) {
        $pid = (int)trim((string)@file_get_contents($pidFile));
        ProcessManager::stopProcess($pid);
        @unlink($pidFile);
        echo "Binary Alive daemon stopped (PID: $pid)." . PHP_EOL;
        exit(0);
    } else {
        @unlink($pidFile);
        echo "Binary Alive daemon is not running." . PHP_EOL;
        exit(0);
    }
}

// 3. Start detached in background
if ($arg === '--start') {
    if (ProcessManager::isDaemonRunning()) {
        $pid = trim((string)@file_get_contents($pidFile));
        echo "Binary Alive daemon is already running (PID: $pid)." . PHP_EOL;
        exit(0);
    }

    $phpBin = PHP_BINARY;
    $script = __FILE__;

    if (ProcessManager::isWindows()) {
        $psCmd = "Start-Process -FilePath " . escapeshellarg($phpBin) . " -ArgumentList " . escapeshellarg($script) . " -WorkingDirectory " . escapeshellarg(__DIR__) . " -WindowStyle Hidden";
        @shell_exec("powershell -NoProfile -ExecutionPolicy Bypass -Command \"$psCmd\"");
    } else {
        @shell_exec("nohup " . escapeshellarg($phpBin) . " " . escapeshellarg($script) . " > /dev/null 2>&1 &");
    }

    sleep(1);
    if (ProcessManager::isDaemonRunning()) {
        $pid = trim((string)@file_get_contents($pidFile));
        echo "Binary Alive daemon started successfully (PID: $pid)." . PHP_EOL;
        exit(0);
    } else {
        echo "Started Binary Alive daemon." . PHP_EOL;
        exit(0);
    }
}

// 4. Foreground / Worker Loop
// Acquire non-blocking lock to guarantee single instance
$lockFp = @fopen($lockFile, 'c');
if (!$lockFp || !@flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "Another daemon instance is already active." . PHP_EOL;
    exit(1);
}

// Write PID
file_put_contents($pidFile, getmypid());

// Cleanup on exit
register_shutdown_function(function() use ($pidFile, $lockFp) {
    if ($lockFp) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
    }
    @unlink($pidFile);
});

echo "Binary Alive native supervisor daemon started (PID: " . getmypid() . ")." . PHP_EOL;

try {
    $db = new Database();
    $pdo = $db->getPdo();
} catch (Exception $e) {
    echo "Failed to connect to database: " . $e->getMessage() . PHP_EOL;
    exit(1);
}

while (true) {
    try {
        $stmt = $pdo->query("SELECT * FROM processes WHERE status != 'stopped' AND (auto_restart = 1 OR status = 'running')");
        $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        ProcessManager::preloadBatchMetrics();

        foreach ($processes as $process) {
            $pid = ProcessManager::isRunning($process);

            if (!$pid) {
                // Process is down, auto-restart immediately
                $newPid = ProcessManager::startProcess($process);
                if ($newPid) {
                    $update = $pdo->prepare("UPDATE processes SET pid = ?, status = 'running', last_restart = CURRENT_TIMESTAMP, restart_count = COALESCE(restart_count, 0) + 1 WHERE id = ?");
                    $update->execute([$newPid, $process['id']]);
                    echo "[" . date('Y-m-d H:i:s') . "] Process '{$process['name']}' revived with PID $newPid" . PHP_EOL;
                } else {
                    $pdo->prepare("UPDATE processes SET pid = NULL, status = 'crashed' WHERE id = ?")->execute([$process['id']]);
                    echo "[" . date('Y-m-d H:i:s') . "] Process '{$process['name']}' failed to start." . PHP_EOL;
                }
            } else {
                // Ensure PID in DB matches actual PID
                if ((int)$process['pid'] !== (int)$pid) {
                    $pdo->prepare("UPDATE processes SET pid = ?, status = 'running' WHERE id = ?")->execute([$pid, $process['id']]);
                }
            }
        }
    } catch (Exception $e) {
        // Recover from transient DB errors
    }

    sleep(2);
}
