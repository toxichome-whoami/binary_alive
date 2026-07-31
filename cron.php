<?php
// cron.php
// This should be called every minute via system cron

require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/monitor.php';

try {
    $db = new Database();
    $pdo = $db->getPdo();

    // 1. If stop from binary alive, pass (status = 'stopped' is ignored)
    // 2. If running, pass (we check isRunning inside loop)
    // 3. If not using (crashed), restart it
    $stmt = $pdo->query("SELECT * FROM processes WHERE status = 'running'");
    $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($processes as $process) {
        $pid = Monitor::isRunning($process);
        
        if (!$pid) {
            $newPid = Monitor::startProcess($process);
            
            if ($newPid) {
                $stmt = $pdo->prepare("UPDATE processes SET pid = ?, last_restart = CURRENT_TIMESTAMP, restart_count = restart_count + 1 WHERE id = ?");
                $stmt->execute([$newPid, $process['id']]);
            }
        } else {
            // Update PID if it changed out of band
            if ($process['pid'] != $pid) {
                $pdo->prepare("UPDATE processes SET pid = ? WHERE id = ?")->execute([$pid, $process['id']]);
            }
        }
    }
} catch (Exception $e) {
    // Fail silently in cron environment
}
