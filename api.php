<?php
// api.php
require_once 'includes/security.php';
require_once 'includes/auth.php';
require_once 'includes/monitor.php';
require_once 'includes/database.php';

$auth = new Auth();
$auth->requireAuth();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_SESSION['api_auth'])) {
    verifyCsrfToken();
}

$db = new Database();
$pdo = $db->getPdo();

$action = $_GET['action'] ?? '';

if ($action === 'status') {
    $stmt = $pdo->query("SELECT * FROM processes");
    $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($processes as &$process) {
        $actual_pid = Monitor::isRunning($process);

        if ($actual_pid) {
            $process['status'] = 'running';
            $process['pid'] = $actual_pid;
            $metrics = Monitor::getMetrics($actual_pid);
            $process = array_merge($process, $metrics);

            // Only update the PID, DO NOT touch the status (status is our desired state)
            $update = $pdo->prepare("UPDATE processes SET pid = ? WHERE id = ?");
            $update->execute([$actual_pid, $process['id']]);
        } else {
            // If DB says running but it's dead, it means it crashed!
            $process['status'] = ($process['status'] === 'running') ? 'crashed' : 'stopped';
            $process['pid'] = null;
            $process['cpu'] = 0;
            $process['mem'] = '0 MB';
            $process['uptime'] = '00:00:00';

            // Clear the PID, DO NOT touch the desired status
            $update = $pdo->prepare("UPDATE processes SET pid = NULL WHERE id = ?");
            $update->execute([$process['id']]);
        }
    }

    // Get system load
    $sysLoad = '---';
    if (function_exists('sys_getloadavg')) {
        $loadArr = sys_getloadavg();
        if ($loadArr && isset($loadArr[0])) {
            $sysLoad = round($loadArr[0], 2);
        }
    }
    if ($sysLoad === '---' && is_readable('/proc/loadavg')) {
        $loadData = @file_get_contents('/proc/loadavg');
        if ($loadData) {
            $loadParts = explode(' ', $loadData);
            if (isset($loadParts[0])) {
                $sysLoad = round((float)$loadParts[0], 2);
            }
        }
    }

    echo json_encode(['success' => true, 'data' => $processes, 'sys_load' => $sysLoad]);
    exit;
}

if ($action === 'control') {
    $auth->requireRole(['admin', 'operator']);
    $ids = $_POST['ids'] ?? [];
    if (isset($_POST['id']) && !empty($_POST['id'])) {
        $ids = [$_POST['id']];
    }
    $cmd = $_POST['cmd'] ?? '';

    if (empty($ids)) {
        echo json_encode(['success' => false, 'message' => 'No processes selected']);
        exit;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT * FROM processes WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$processes) {
        echo json_encode(['success' => false, 'message' => 'Processes not found']);
        exit;
    }

    $results = [];
    foreach ($processes as $process) {
        if ($cmd === 'start') {
            $pid = Monitor::startProcess($process);
            if ($pid) {
                $pdo->prepare("UPDATE processes SET pid = ?, status = 'running' WHERE id = ?")->execute([$pid, $process['id']]);
            }
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'process_start', "Process: {$process['name']}");
            $results[$process['id']] = ['success' => (bool)$pid, 'pid' => $pid];
        } elseif ($cmd === 'stop') {
            $pid = Monitor::isRunning($process);
            $success = Monitor::stopProcess($pid);
            if ($success) {
                $pdo->prepare("UPDATE processes SET pid = NULL, status = 'stopped' WHERE id = ?")->execute([$process['id']]);
            }
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'process_stop', "Process: {$process['name']}");
            $results[$process['id']] = ['success' => $success];
        } elseif ($cmd === 'restart') {
            $pid = Monitor::isRunning($process);
            Monitor::stopProcess($pid);
            $newPid = Monitor::startProcess($process);
            if ($newPid) {
                $pdo->prepare("UPDATE processes SET pid = ?, status = 'running', last_restart = CURRENT_TIMESTAMP, restart_count = restart_count + 1 WHERE id = ?")->execute([$newPid, $process['id']]);
            }
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'process_restart', "Process: {$process['name']}");
            $results[$process['id']] = ['success' => (bool)$newPid, 'pid' => $newPid];
        }
    }

    echo json_encode(['success' => true, 'results' => $results]);
    exit;
}

if ($action === 'add_process') {
    $auth->requireRole(['admin']); // Only admin can add processes

    $name = $_POST['name'] ?? '';
    $command = $_POST['command'] ?? '';
    $group = $_POST['group_name'] ?? 'Default';
    $dir = $_POST['working_dir'] ?? '';
    $log = $_POST['log_file'] ?? '';

    if (empty($name) || empty($command)) {
        echo json_encode(['success' => false, 'message' => 'Name and command are required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO processes (name, group_name, command, working_dir, log_file) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$name, $group, $command, $dir, $log]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'add_process', "Added process: $name");
        echo json_encode(['success' => true, 'message' => 'Process added successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to add process. Ensure the name is unique.']);
    }
    exit;
}

if ($action === 'get_process') {
    $auth->requireRole(['admin']);
    $id = $_GET['id'] ?? 0;
    $stmt = $pdo->prepare("SELECT * FROM processes WHERE id = ?");
    $stmt->execute([$id]);
    $process = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($process) {
        echo json_encode(['success' => true, 'process' => $process]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Not found']);
    }
    exit;
}

if ($action === 'edit_process') {
    $auth->requireRole(['admin']);
    $id = $_POST['id'] ?? 0;
    $name = $_POST['name'] ?? '';
    $command = $_POST['command'] ?? '';
    $group = $_POST['group_name'] ?? 'Default';
    $dir = $_POST['working_dir'] ?? '';
    $log = $_POST['log_file'] ?? '';

    if (empty($name) || empty($command)) {
        echo json_encode(['success' => false, 'message' => 'Name and command are required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE processes SET name = ?, group_name = ?, command = ?, working_dir = ?, log_file = ? WHERE id = ?");
        $stmt->execute([$name, $group, $command, $dir, $log, $id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'edit_process', "Edited process ID: $id");
        echo json_encode(['success' => true, 'message' => 'Process updated successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to update process.']);
    }
    exit;
}

if ($action === 'delete_process') {
    $auth->requireRole(['admin']);
    $id = $_POST['id'] ?? 0;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'Process ID required']);
        exit;
    }

    // Stop it if it's running before deleting
    $stmt = $pdo->prepare("SELECT * FROM processes WHERE id = ?");
    $stmt->execute([$id]);
    $process = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($process) {
        $pid = Monitor::isRunning($process);
        if ($pid) Monitor::stopProcess($pid);

        $pdo->prepare("DELETE FROM processes WHERE id = ?")->execute([$id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_process', "Deleted process: {$process['name']}");
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Process not found']);
    }
    exit;
}

if ($action === 'terminal') {
    $auth->requireRole(['admin']); // Only admin can run shell commands

    $cmd = trim($_POST['cmd'] ?? '');
    if (empty($cmd)) {
        echo json_encode(['success' => false, 'message' => 'No command provided']);
        exit;
    }
    if (strlen($cmd) > 2000) {
        echo json_encode(['success' => false, 'message' => 'Command too long (max 2000 chars)']);
        exit;
    }

    $auth->getLogger()->logAudit($_SESSION['user_id'], 'terminal_command', "Command: $cmd");

    $cwd = $_SESSION['terminal_cwd'] ?? __DIR__;

    // Intercept 'cd' command to update session state
    if (preg_match('/^cd\s*(.*)$/', $cmd, $matches)) {
        $target = trim($matches[1]);
        if (empty($target) || $target === '~') {
            $target = (PHP_OS_FAMILY === 'Windows') ? (getenv('USERPROFILE') ?: 'C:\\') : (getenv('HOME') ?: '/');
        }
        $target = trim($target, "\"'");

        $newCwd = realpath(is_dir($target) ? $target : $cwd . DIRECTORY_SEPARATOR . $target);

        if ($newCwd && is_dir($newCwd)) {
            $_SESSION['terminal_cwd'] = $newCwd;
            echo json_encode(['success' => true, 'output' => '', 'exit_code' => 0, 'timed_out' => false, 'cwd' => $newCwd]);
        } else {
            echo json_encode(['success' => true, 'output' => "cd: $target: No such file or directory", 'exit_code' => 1, 'timed_out' => false, 'cwd' => $cwd]);
        }
        exit;
    }

    $timeout = 30; // Seconds before the command is force-killed
    $output = '';
    $exitCode = -1;

    // Use bash for a richer environment, and force stderr to stdout (2>&1)
    if (PHP_OS_FAMILY !== 'Windows') {
        $cmd = '/bin/bash -c ' . escapeshellarg($cmd . ' 2>&1');
    }

    $descriptorspec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];

    $proc = proc_open($cmd, $descriptorspec, $pipes, $cwd);
    if (!is_resource($proc)) {
        echo json_encode(['success' => false, 'message' => 'Failed to start command process']);
        exit;
    }

    fclose($pipes[0]); // No stdin input
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $deadline = time() + $timeout;
    $timedOut = false;
    $status = proc_get_status($proc);

    while ($status['running']) {
        if (time() >= $deadline) {
            $timedOut = true;
            proc_terminate($proc);
            $status = proc_get_status($proc);
            break;
        }
        $chunk1 = stream_get_contents($pipes[1]);
        $chunk2 = stream_get_contents($pipes[2]);
        if ($chunk1 !== false && $chunk1 !== '') $output .= $chunk1;
        if ($chunk2 !== false && $chunk2 !== '') $output .= $chunk2;
        usleep(50000); // 50ms
        $status = proc_get_status($proc);
    }

    $output .= stream_get_contents($pipes[1]);
    $output .= stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exitCode = $status['exitcode'];
    proc_close($proc);

    echo json_encode([
        'success' => true,
        'output' => $output,
        'exit_code' => $exitCode,
        'timed_out' => $timedOut,
        'cwd' => $cwd
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
