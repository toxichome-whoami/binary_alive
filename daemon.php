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

@set_time_limit(0);
@ignore_user_abort(true);

require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/ProcessManager.php';

// Log fatal errors to file for debugging background daemon crashes
register_shutdown_function(function() {
    $err = error_get_last();
    if ($err) {
        @file_put_contents(__DIR__ . '/db/.daemon_error.log', '[' . date('Y-m-d H:i:s') . "] Fatal: {$err['message']} in {$err['file']}:{$err['line']}\n", FILE_APPEND);
    }
});

$pidFile = __DIR__ . '/db/.daemon.pid';
$lockFile = __DIR__ . '/db/.daemon.lock';

$arg = (isset($argv) && is_array($argv)) ? ($argv[1] ?? '') : '';

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

    $started = ProcessManager::startDaemon();
    if ($started) {
        $pid = trim((string)@file_get_contents($pidFile));
        echo "Binary Alive daemon started successfully (PID: $pid)." . PHP_EOL;
        exit(0);
    } else {
        echo "Failed to start Binary Alive daemon." . PHP_EOL;
        exit(1);
    }
}

// 4. Foreground / Worker Loop
// Acquire non-blocking lock to guarantee single instance
$lockFp = @fopen($lockFile, 'c');
if (!$lockFp || !@flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "Another daemon instance is already active." . PHP_EOL;
    exit(1);
}

function daemon_log(string $msg): void {
    if (PHP_SAPI === 'cli' && defined('STDOUT')) {
        @fwrite(STDOUT, $msg . PHP_EOL);
    }
    @file_put_contents(__DIR__ . '/db/.daemon.log', '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL, FILE_APPEND);
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

daemon_log("Binary Alive native supervisor daemon started (PID: " . getmypid() . ").");

try {
    $db = new Database();
    $pdo = $db->getPdo();
} catch (Exception $e) {
    daemon_log("Failed to connect to database: " . $e->getMessage());
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
                    daemon_log("Process '{$process['name']}' revived with PID $newPid");
                } else {
                    $pdo->prepare("UPDATE processes SET pid = NULL, status = 'crashed' WHERE id = ?")->execute([$process['id']]);
                    daemon_log("Process '{$process['name']}' failed to start.");
                }
            } else {
                // Ensure PID in DB matches actual PID
                if ((int)$process['pid'] !== (int)$pid) {
                    $pdo->prepare("UPDATE processes SET pid = ?, status = 'running' WHERE id = ?")->execute([$pid, $process['id']]);
                }
            }
        }
    } catch (Throwable $e) {
        daemon_log("Loop error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    }

    sleep(2);
}
