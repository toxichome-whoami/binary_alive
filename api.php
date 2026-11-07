<?php
// api.php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/ProcessManager.php';
require_once __DIR__ . '/includes/database.php';

$auth = new Auth();
$auth->requireAuth();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
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

    // Batch preload metrics in a single command across all processes
    ProcessManager::preloadBatchMetrics();

    foreach ($processes as &$process) {
        $actual_pid = ProcessManager::isRunning($process);
        $old_pid = !empty($process['pid']) ? (int)$process['pid'] : null;

        if ($actual_pid) {
            $process['status'] = 'running';
            $process['pid'] = $actual_pid;
            $metrics = ProcessManager::getMetrics($actual_pid);
            $process = array_merge($process, $metrics);

            // Only write to SQLite if PID actually changed to prevent high disk I/O
            if ($old_pid !== $actual_pid || $process['status'] !== 'running') {
                $update = $pdo->prepare("UPDATE processes SET pid = ?, status = 'running' WHERE id = ?");
                $update->execute([$actual_pid, $process['id']]);
            }
        } else {
            // Process is dead. Check if native auto-restart is required.
            $isExplicitlyStopped = ($process['status'] === 'stopped');
            $autoRestartEnabled = !isset($process['auto_restart']) || (int)$process['auto_restart'] === 1;

            if (!$isExplicitlyStopped && $autoRestartEnabled) {
                // Instantly revive process natively
                $newPid = ProcessManager::startProcess($process);
                if ($newPid) {
                    $update = $pdo->prepare("UPDATE processes SET pid = ?, status = 'running', last_restart = CURRENT_TIMESTAMP, restart_count = COALESCE(restart_count, 0) + 1 WHERE id = ?");
                    $update->execute([$newPid, $process['id']]);

                    $process['status'] = 'running';
                    $process['pid'] = $newPid;
                    $process['restart_count'] = ((int)($process['restart_count'] ?? 0)) + 1;
                    $metrics = ProcessManager::getMetrics($newPid);
                    $process = array_merge($process, $metrics);
                } else {
                    $process['status'] = 'crashed';
                    $process['pid'] = null;
                    $process['cpu'] = 0;
                    $process['mem'] = '0 MB';
                    $process['uptime'] = '00:00:00';

                    $update = $pdo->prepare("UPDATE processes SET pid = NULL, status = 'crashed' WHERE id = ?");
                    $update->execute([$process['id']]);
                }
            } else {
                $process['status'] = 'stopped';
                $process['pid'] = null;
                $process['cpu'] = 0;
                $process['mem'] = '0 MB';
                $process['uptime'] = '00:00:00';

                if ($old_pid !== null || $process['status'] !== 'stopped') {
                    $update = $pdo->prepare("UPDATE processes SET pid = NULL, status = 'stopped' WHERE id = ?");
                    $update->execute([$process['id']]);
                }
            }
        }
    }

    $sys = ProcessManager::getSystemMetrics();
    $daemonActive = ProcessManager::isDaemonRunning();

    // Ensure background supervisor daemon is active if there are running or auto-restart processes
    $needsSupervisor = false;
    foreach ($processes as $p) {
        if (!empty($p['auto_restart']) || $p['status'] === 'running') {
            $needsSupervisor = true;
            break;
        }
    }
    if ($needsSupervisor && !$daemonActive) {
        ProcessManager::startDaemon();
        $daemonActive = ProcessManager::isDaemonRunning();
    }

    echo json_encode([
        'success' => true,
        'data' => $processes,
        'sys_load' => $sys['load'],
        'sys_mem' => $sys['mem_usage'],
        'daemon_active' => $daemonActive
    ]);
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
            $pid = ProcessManager::startProcess($process);
            if ($pid) {
                $pdo->prepare("UPDATE processes SET pid = ?, status = 'running' WHERE id = ?")->execute([$pid, $process['id']]);
                if (!ProcessManager::isDaemonRunning()) {
                    ProcessManager::startDaemon();
                }
            }
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'process_start', "Process: {$process['name']}");
            $results[$process['id']] = ['success' => (bool)$pid, 'pid' => $pid];
        } elseif ($cmd === 'stop') {
            $pid = ProcessManager::isRunning($process);
            if ($pid) {
                ProcessManager::stopProcess($pid);
            }
            // User explicitly stopped this process: persist 'stopped' status so auto-restart will not revive it
            $pdo->prepare("UPDATE processes SET pid = NULL, status = 'stopped' WHERE id = ?")->execute([$process['id']]);
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'process_stop', "Process: {$process['name']}");
            $results[$process['id']] = ['success' => true];
        } elseif ($cmd === 'restart') {
            $pid = ProcessManager::isRunning($process);
            if ($pid) {
                ProcessManager::stopProcess($pid);
            }
            $newPid = ProcessManager::startProcess($process);
            if ($newPid) {
                $pdo->prepare("UPDATE processes SET pid = ?, status = 'running', last_restart = CURRENT_TIMESTAMP, restart_count = COALESCE(restart_count, 0) + 1 WHERE id = ?")->execute([$newPid, $process['id']]);
                if (!ProcessManager::isDaemonRunning()) {
                    ProcessManager::startDaemon();
                }
            }
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'process_restart', "Process: {$process['name']}");
            $results[$process['id']] = ['success' => (bool)$newPid, 'pid' => $newPid];
        }
    }

    echo json_encode(['success' => true, 'results' => $results]);
    exit;
}

if ($action === 'daemon_control') {
    $auth->requireRole(['admin']);
    $cmd = $_POST['cmd'] ?? '';
    
    if ($cmd === 'start') {
        $started = ProcessManager::startDaemon();
        echo json_encode(['success' => $started, 'daemon_active' => ProcessManager::isDaemonRunning()]);
    } elseif ($cmd === 'stop') {
        ProcessManager::stopDaemon();
        echo json_encode(['success' => true, 'daemon_active' => false]);
    } else {
        echo json_encode(['success' => true, 'daemon_active' => ProcessManager::isDaemonRunning()]);
    }
    exit;
}

if ($action === 'add_process') {
    $auth->requireRole(['admin']);

    $name = trim($_POST['name'] ?? '');
    $command = trim($_POST['command'] ?? '');
    $group = trim($_POST['group_name'] ?? 'Default');
    $dir = trim($_POST['working_dir'] ?? '');
    $log = trim($_POST['log_file'] ?? '');
    $autoRestart = isset($_POST['auto_restart']) ? (int)$_POST['auto_restart'] : 1;

    if (empty($name) || empty($command)) {
        echo json_encode(['success' => false, 'message' => 'Name and command are required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO processes (name, group_name, command, working_dir, log_file, auto_restart) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $group, $command, $dir, $log, $autoRestart]);
        if ($autoRestart == 1 && !ProcessManager::isDaemonRunning()) {
            ProcessManager::startDaemon();
        }
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
    $name = trim($_POST['name'] ?? '');
    $command = trim($_POST['command'] ?? '');
    $group = trim($_POST['group_name'] ?? 'Default');
    $dir = trim($_POST['working_dir'] ?? '');
    $log = trim($_POST['log_file'] ?? '');
    $autoRestart = isset($_POST['auto_restart']) ? (int)$_POST['auto_restart'] : 1;

    if (empty($name) || empty($command)) {
        echo json_encode(['success' => false, 'message' => 'Name and command are required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE processes SET name = ?, group_name = ?, command = ?, working_dir = ?, log_file = ?, auto_restart = ? WHERE id = ?");
        $stmt->execute([$name, $group, $command, $dir, $log, $autoRestart, $id]);
        if ($autoRestart == 1 && !ProcessManager::isDaemonRunning()) {
            ProcessManager::startDaemon();
        }
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

    $stmt = $pdo->prepare("SELECT * FROM processes WHERE id = ?");
    $stmt->execute([$id]);
    $process = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($process) {
        $pid = ProcessManager::isRunning($process);
        if ($pid) ProcessManager::stopProcess($pid);

        $pdo->prepare("DELETE FROM processes WHERE id = ?")->execute([$id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_process', "Deleted process: {$process['name']}");
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Process not found']);
    }
    exit;
}

if ($action === 'terminal_shell') {
    $auth->requireRole(['admin']);
    $requestedShell = strtolower(trim($_POST['shell'] ?? $_GET['shell'] ?? ''));
    $availableShells = (PHP_OS_FAMILY === 'Windows') ? ['cmd', 'powershell'] : ['bash', 'sh'];
    if (in_array($requestedShell, $availableShells, true)) {
        $_SESSION['terminal_shell'] = $requestedShell;
        echo json_encode(['success' => true, 'shell' => $requestedShell]);
    } else {
        $current = $_SESSION['terminal_shell'] ?? (PHP_OS_FAMILY === 'Windows' ? 'cmd' : 'bash');
        echo json_encode(['success' => true, 'shell' => $current, 'available' => $availableShells]);
    }
    exit;
}

if ($action === 'terminal_autocomplete') {
    $auth->requireRole(['admin']);
    $cwd = $_SESSION['terminal_cwd'] ?? __DIR__;
    $prefix = trim($_GET['prefix'] ?? $_POST['prefix'] ?? '');

    $targetDir = $cwd;
    $searchPrefix = $prefix;

    if (strpos($prefix, '/') !== false || strpos($prefix, '\\') !== false) {
        $lastSep = max(strrpos($prefix, '/'), strrpos($prefix, '\\'));
        $subDir = substr($prefix, 0, $lastSep + 1);
        $searchPrefix = substr($prefix, $lastSep + 1);

        $resolvedSubDir = realpath(is_dir($subDir) ? $subDir : $cwd . DIRECTORY_SEPARATOR . $subDir);
        if ($resolvedSubDir && is_dir($resolvedSubDir)) {
            $targetDir = $resolvedSubDir;
        }
    }

    $matches = [];
    if (is_dir($targetDir)) {
        $items = @scandir($targetDir);
        if ($items !== false) {
            foreach ($items as $item) {
                if ($item === '.' || $item === '..') continue;
                if (empty($searchPrefix) || stripos($item, $searchPrefix) === 0) {
                    $isDir = is_dir($targetDir . DIRECTORY_SEPARATOR . $item);
                    $matches[] = [
                        'name' => $item . ($isDir ? (PHP_OS_FAMILY === 'Windows' ? '\\' : '/') : ''),
                        'is_dir' => $isDir
                    ];
                }
            }
        }
    }
    echo json_encode(['success' => true, 'matches' => $matches]);
    exit;
}

if ($action === 'terminal') {
    $auth->requireRole(['admin']);

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

    if (!isset($_SESSION['terminal_shell'])) {
        $_SESSION['terminal_shell'] = (PHP_OS_FAMILY === 'Windows') ? 'cmd' : 'bash';
    }
    $activeShell = $_SESSION['terminal_shell'];
    $cwd = $_SESSION['terminal_cwd'] ?? __DIR__;

    // Intercept clear / cls command
    if (in_array(strtolower($cmd), ['clear', 'cls'], true)) {
        echo json_encode(['success' => true, 'output' => '', 'clear' => true, 'exit_code' => 0, 'timed_out' => false, 'cwd' => $cwd, 'shell' => $activeShell]);
        exit;
    }

    // Intercept Windows Shell switching (powershell / power / pwsh / cmd)
    if (PHP_OS_FAMILY === 'Windows') {
        if (in_array(strtolower($cmd), ['powershell', 'power', 'pwsh'], true)) {
            $_SESSION['terminal_shell'] = 'powershell';
            echo json_encode([
                'success' => true,
                'output' => "Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\nActive shell switched to PowerShell.\n",
                'exit_code' => 0,
                'timed_out' => false,
                'cwd' => $cwd,
                'shell' => 'powershell'
            ]);
            exit;
        }

        if (strtolower($cmd) === 'cmd') {
            $_SESSION['terminal_shell'] = 'cmd';
            echo json_encode([
                'success' => true,
                'output' => "Microsoft Windows Command Prompt\n(c) Microsoft Corporation. All rights reserved.\nActive shell switched to CMD.\n",
                'exit_code' => 0,
                'timed_out' => false,
                'cwd' => $cwd,
                'shell' => 'cmd'
            ]);
            exit;
        }

        // Intercept drive switch (e.g. D: or C:)
        if (preg_match('/^([a-zA-Z]):$/', $cmd, $driveMatch)) {
            $targetDrive = strtoupper($driveMatch[1]) . ':\\';
            if (is_dir($targetDrive)) {
                $_SESSION['terminal_cwd'] = $targetDrive;
                echo json_encode(['success' => true, 'output' => '', 'exit_code' => 0, 'timed_out' => false, 'cwd' => $targetDrive, 'shell' => $activeShell]);
            } else {
                echo json_encode(['success' => true, 'output' => "The system cannot find the drive specified.\n", 'exit_code' => 1, 'timed_out' => false, 'cwd' => $cwd, 'shell' => $activeShell]);
            }
            exit;
        }
    } else {
        // Linux Shell switching
        if (in_array(strtolower($cmd), ['bash', 'sh'], true)) {
            $_SESSION['terminal_shell'] = strtolower($cmd);
            echo json_encode([
                'success' => true,
                'output' => "Switched active shell to " . strtolower($cmd) . ".\n",
                'exit_code' => 0,
                'timed_out' => false,
                'cwd' => $cwd,
                'shell' => strtolower($cmd)
            ]);
            exit;
        }
    }

    // Intercept exit command to reset shell
    if (strtolower($cmd) === 'exit') {
        $defaultShell = (PHP_OS_FAMILY === 'Windows') ? 'cmd' : 'bash';
        $_SESSION['terminal_shell'] = $defaultShell;
        echo json_encode([
            'success' => true,
            'output' => "Active shell reset to $defaultShell.\n",
            'exit_code' => 0,
            'timed_out' => false,
            'cwd' => $cwd,
            'shell' => $defaultShell
        ]);
        exit;
    }

    // Intercept 'cd' command to update session state across CMD and PowerShell
    if (preg_match('/^cd(?:\s+\/d)?\s*(.*)$/i', $cmd, $matches)) {
        $target = trim($matches[1]);
        if (empty($target) || $target === '~') {
            $target = (PHP_OS_FAMILY === 'Windows') ? (getenv('USERPROFILE') ?: 'C:\\') : ($_SESSION['terminal_home'] ?? getenv('HOME') ?: '/');
        }
        $target = trim($target, "\"'");

        $newCwd = realpath(is_dir($target) ? $target : $cwd . DIRECTORY_SEPARATOR . $target);

        if ($newCwd && is_dir($newCwd)) {
            $_SESSION['terminal_cwd'] = $newCwd;
            echo json_encode(['success' => true, 'output' => '', 'exit_code' => 0, 'timed_out' => false, 'cwd' => $newCwd, 'shell' => $activeShell]);
        } else {
            echo json_encode(['success' => true, 'output' => "cd: $target: No such file or directory\n", 'exit_code' => 1, 'timed_out' => false, 'cwd' => $cwd, 'shell' => $activeShell]);
        }
        exit;
    }

    $timeout = 30; // Seconds before the command is force-killed
    $output = '';
    $exitCode = -1;

    // Platform execution wrapping
    if (PHP_OS_FAMILY === 'Windows') {
        if ($activeShell === 'powershell') {
            $psScript = "\$ProgressPreference = 'SilentlyContinue'; " . $cmd . " 2>&1";
            $encoded = base64_encode(mb_convert_encoding($psScript, 'UTF-16LE', 'UTF-8'));
            $execCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -NonInteractive -EncodedCommand " . $encoded;
        } else {
            $execCmd = 'cmd.exe /d /c "' . $cmd . '" 2>&1';
        }
    } else {
        $shBin = ($activeShell === 'sh') ? '/bin/sh' : '/bin/bash';
        $execCmd = $shBin . ' -c ' . escapeshellarg($cmd . ' 2>&1');
    }

    $descriptorspec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];

    $proc = proc_open($execCmd, $descriptorspec, $pipes, $cwd);
    if (!is_resource($proc)) {
        echo json_encode(['success' => false, 'message' => 'Failed to start command process']);
        exit;
    }

    fclose($pipes[0]);
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
        usleep(50000);
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
        'cwd' => $cwd,
        'shell' => $activeShell
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
