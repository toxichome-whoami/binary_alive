<?php
// cron.php
// This should be called every minute via system cron

// Relax CLI guard slightly for cPanel binaries
$sapi = php_sapi_name();
if ($sapi !== 'cli' && $sapi !== 'cgi-fcgi' && $sapi !== 'cgi') {
    http_response_code(403);
    exit('Access denied.');
}

require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/monitor.php';

try {
    $db = new Database();
    /** @var \PDO $pdo */
    $pdo = $db->getPdo();

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
