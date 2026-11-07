<?php
/**
 * cron.php
 * Background monitor and auto-restarter called every minute via system cron.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Access denied. This script must be run from the command line.');
}

// Timeout guard to ensure cron never runs beyond 55 seconds
@set_time_limit(55);

require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/ProcessManager.php';

// Prevent overlapping cron executions
$lockPath = __DIR__ . '/db/.cron.lock';
$lockFp = @fopen($lockPath, 'c');
if (!$lockFp || !@flock($lockFp, LOCK_EX | LOCK_NB)) {
    // Another cron instance is already executing, exit cleanly
    exit(0);
}

try {
    $db = new Database();
    /** @var \PDO $pdo */
    $pdo = $db->getPdo();

    $stmt = $pdo->query("SELECT * FROM processes WHERE status != 'stopped' AND (auto_restart = 1 OR status = 'running')");
    $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Preload batch metrics in 1 call
    ProcessManager::preloadBatchMetrics();

    // Auto-revive background supervisor daemon if host/CloudLinux terminated it
    if (!empty($processes) && !ProcessManager::isDaemonRunning()) {
        ProcessManager::startDaemon();
    }

    foreach ($processes as $process) {
        $pid = ProcessManager::isRunning($process);

        if (!$pid) {
            // Process crashed; restart it
            $newPid = ProcessManager::startProcess($process);

            if ($newPid) {
                $stmt = $pdo->prepare("UPDATE processes SET pid = ?, status = 'running', last_restart = CURRENT_TIMESTAMP, restart_count = COALESCE(restart_count, 0) + 1 WHERE id = ?");
                $stmt->execute([$newPid, $process['id']]);
            } else {
                $pdo->prepare("UPDATE processes SET pid = NULL, status = 'crashed' WHERE id = ?")->execute([$process['id']]);
            }
        } else {
            // Update PID if it changed out of band
            if ((int)$process['pid'] !== (int)$pid) {
                $pdo->prepare("UPDATE processes SET pid = ?, status = 'running' WHERE id = ?")->execute([$pid, $process['id']]);
            }
        }
    }

    // Automated database hygiene (runs ~once per hour in cron execution)
    if (mt_rand(1, 60) === 1) {
        $pruneDate = date('Y-m-d H:i:s', strtotime('-30 days'));
        $pdo->prepare("DELETE FROM login_attempts WHERE timestamp < ?")->execute([$pruneDate]);
        $pdo->exec("PRAGMA optimize;");
    }
} catch (Exception $e) {
    // Fail silently in cron environment
} finally {
    if ($lockFp) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
    }
}
