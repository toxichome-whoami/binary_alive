<?php
// cron.php
// This should be called every minute via system cron

require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/monitor.php';

$db = new Database();
$pdo = $db->getPdo();

$stmt = $pdo->query("SELECT * FROM processes WHERE auto_restart = 1");
$processes = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($processes as $process) {
    $pid = Monitor::isRunning($process);
    
    if (!$pid) {
        // Process is down, try to restart
        $newPid = Monitor::startProcess($process);
        if ($newPid) {
            $stmt = $pdo->prepare("UPDATE processes SET status = 'running', pid = ?, last_restart = CURRENT_TIMESTAMP, restart_count = restart_count + 1 WHERE id = ?");
            $stmt->execute([$newPid, $process['id']]);
        }
    } else {
        // Process is running, update PID if changed
        if ($process['pid'] != $pid) {
            $stmt = $pdo->prepare("UPDATE processes SET status = 'running', pid = ? WHERE id = ?");
            $stmt->execute([$pid, $process['id']]);
        }
    }
}
