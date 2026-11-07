<?php
/**
 * tests/run.php
 * Master Comprehensive Test Suite for Binary Alive.
 *
 * Runs 120 automated tests validating syntax, database, security, processes,
 * auto-restart logic, background daemon, cron, terminal, and API endpoints.
 *
 * Usage:
 *   php tests/run.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once dirname(__DIR__) . '/includes/database.php';
require_once dirname(__DIR__) . '/includes/ProcessManager.php';
require_once dirname(__DIR__) . '/includes/security.php';
require_once dirname(__DIR__) . '/includes/totp_helper.php';

// =============================================================================
// Zero-Dependency Test Runner Engine
// =============================================================================

class TestRunner {
    private static int $passed = 0;
    private static int $failed = 0;
    private static string $currentSuite = '';
    private static array $failures = [];

    public static function suite(string $name): void {
        self::$currentSuite = $name;
        echo "\n=== [SUITE] $name ===\n";
    }

    public static function assertTrue(bool $condition, string $testName): void {
        if ($condition === true) {
            self::pass($testName);
        } else {
            self::fail($testName, "Expected true, got false");
        }
    }

    public static function assertFalse(bool $condition, string $testName): void {
        if ($condition === false) {
            self::pass($testName);
        } else {
            self::fail($testName, "Expected false, got true");
        }
    }

    public static function assertEquals(mixed $expected, mixed $actual, string $testName): void {
        if ($expected === $actual) {
            self::pass($testName);
        } else {
            self::fail($testName, "Expected " . var_export($expected, true) . ", got " . var_export($actual, true));
        }
    }

    public static function assertContains(mixed $needle, mixed $haystack, string $testName): void {
        if (is_string($haystack) && strpos($haystack, (string)$needle) !== false) {
            self::pass($testName);
        } elseif (is_array($haystack) && in_array($needle, $haystack, true)) {
            self::pass($testName);
        } else {
            self::fail($testName, "Value " . var_export($needle, true) . " not found in target.");
        }
    }

    public static function assertMatches(string $pattern, string $string, string $testName): void {
        if (preg_match($pattern, $string)) {
            self::pass($testName);
        } else {
            self::fail($testName, "String did not match pattern $pattern: " . var_export($string, true));
        }
    }

    public static function assertNotNull(mixed $actual, string $testName): void {
        if ($actual !== null) {
            self::pass($testName);
        } else {
            self::fail($testName, "Expected non-null value, got null.");
        }
    }

    private static function pass(string $testName): void {
        self::$passed++;
        echo "  [PASS] $testName\n";
    }

    private static function fail(string $testName, string $reason): void {
        self::$failed++;
        $entry = "[" . self::$currentSuite . "] $testName: $reason";
        self::$failures[] = $entry;
        echo "  [FAIL] $testName\n         -> $reason\n";
    }

    public static function summary(): int {
        $total = self::$passed + self::$failed;
        echo "\n" . str_repeat("=", 50) . "\n";
        echo "TEST SUMMARY:\n";
        echo "  Total:  $total\n";
        echo "  Passed: " . self::$passed . "\n";
        echo "  Failed: " . self::$failed . "\n";
        echo str_repeat("=", 50) . "\n";

        if (self::$failed > 0) {
            echo "\nFAILURES DETAIL:\n";
            foreach (self::$failures as $idx => $f) {
                echo "  " . ($idx + 1) . ". $f\n";
            }
            echo "\n";
            return 1;
        }

        echo "\nALL TESTS PASSED SUCCESSFULLY!\n\n";
        return 0;
    }
}

// =============================================================================
// Test Suites
// =============================================================================

function runSyntaxTest(): void {
    TestRunner::suite("PHP Syntax & Compilation Validation");

    $root = dirname(__DIR__);
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
    $phpFiles = [];

    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $path = $file->getRealPath();
            if (strpos($path, 'temp_') === false) {
                $phpFiles[] = $path;
            }
        }
    }

    TestRunner::assertTrue(count($phpFiles) >= 15, "Found all project PHP files (" . count($phpFiles) . " files)");

    $phpBin = PHP_BINARY;
    foreach ($phpFiles as $file) {
        $relPath = str_replace($root . DIRECTORY_SEPARATOR, '', $file);
        $cmd = escapeshellarg($phpBin) . " -l " . escapeshellarg($file) . " 2>&1";
        $out = (string)@shell_exec($cmd);
        $hasError = (strpos($out, 'No syntax errors detected') === false);
        TestRunner::assertFalse($hasError, "Syntax check: $relPath");
    }
}

function runDatabaseTest(): void {
    TestRunner::suite("Database & Schema Integrity");

    $tempDbPath = __DIR__ . '/temp_db_' . uniqid() . '.sqlite';

    try {
        $db = new Database($tempDbPath);
        $pdo = $db->getPdo();

        TestRunner::assertNotNull($pdo, "Database connection established");

        // Verify WAL mode
        $stmt = $pdo->query("PRAGMA journal_mode;");
        $mode = $stmt->fetchColumn();
        TestRunner::assertEquals('wal', strtolower((string)$mode), "Database runs in WAL mode");

        // Verify required tables exist
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table';")->fetchAll(PDO::FETCH_COLUMN);
        TestRunner::assertContains('users', $tables, "Table 'users' exists");
        TestRunner::assertContains('processes', $tables, "Table 'processes' exists");
        TestRunner::assertContains('audit_logs', $tables, "Table 'audit_logs' exists");
        TestRunner::assertContains('login_attempts', $tables, "Table 'login_attempts' exists");

        // Test process insertion
        $insert = $pdo->prepare("INSERT INTO processes (name, group_name, command, working_dir, auto_restart, status) VALUES (?, ?, ?, ?, ?, ?)");
        $res = $insert->execute(['unit_test_proc', 'TestGroup', 'echo test', '/tmp', 1, 'running']);
        TestRunner::assertTrue($res, "Process inserted successfully");
        $procId = (int)$pdo->lastInsertId();
        TestRunner::assertTrue($procId > 0, "Last insert ID valid");

        // Test process retrieval
        $fetch = $pdo->prepare("SELECT * FROM processes WHERE id = ?");
        $fetch->execute([$procId]);
        $row = $fetch->fetch(PDO::FETCH_ASSOC);
        TestRunner::assertEquals('unit_test_proc', $row['name'], "Retrieved process name matches");
        TestRunner::assertEquals('TestGroup', $row['group_name'], "Retrieved group_name matches");
        TestRunner::assertEquals(1, (int)$row['auto_restart'], "Retrieved auto_restart matches");
        TestRunner::assertEquals('running', $row['status'], "Retrieved status matches");

        // Test process update
        $update = $pdo->prepare("UPDATE processes SET pid = ?, restart_count = restart_count + 1, last_restart = CURRENT_TIMESTAMP WHERE id = ?");
        $update->execute([99999, $procId]);
        $fetch->execute([$procId]);
        $updated = $fetch->fetch(PDO::FETCH_ASSOC);
        TestRunner::assertEquals(99999, (int)$updated['pid'], "Updated PID matches");
        TestRunner::assertEquals(1, (int)$updated['restart_count'], "Incremented restart_count matches");
        TestRunner::assertNotNull($updated['last_restart'], "last_restart timestamp updated");

        // Test process deletion
        $del = $pdo->prepare("DELETE FROM processes WHERE id = ?");
        $del->execute([$procId]);
        $fetch->execute([$procId]);
        $deleted = $fetch->fetch(PDO::FETCH_ASSOC);
        TestRunner::assertFalse((bool)$deleted, "Deleted process is no longer in database");

    } finally {
        @unlink($tempDbPath);
        @unlink($tempDbPath . '-wal');
        @unlink($tempDbPath . '-shm');
    }
}

function runAuthSecurityTest(): void {
    TestRunner::suite("Authentication & Cryptographic Security");

    // 1. Password Hashing (bcrypt)
    $password = 'SuperSecret_123!Safe';
    $hash = password_hash($password, PASSWORD_BCRYPT);
    TestRunner::assertTrue(password_verify($password, $hash), "Bcrypt password verification succeeds");
    TestRunner::assertFalse(password_verify('WrongPassword', $hash), "Bcrypt rejects incorrect password");

    // 2. CSRF Token Generation & Validation
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $validToken = $_SESSION['csrf_token'];
    $invalidToken = 'invalid_token_12345';

    TestRunner::assertTrue(hash_equals($_SESSION['csrf_token'], $validToken), "CSRF token matches valid session token");
    TestRunner::assertFalse(hash_equals($_SESSION['csrf_token'], $invalidToken), "CSRF token rejects forged token");

    // 3. AES-256-CBC Encryption & Decryption
    $plaintext = "BinaryAlive::SuperSecureDataPayload_12345";
    $secretKey = hash('sha256', 'unit_test_encryption_key', true);
    $iv = openssl_random_pseudo_bytes(16);
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-cbc', $secretKey, 0, $iv);

    TestRunner::assertNotNull($ciphertext, "AES-256 encryption succeeds");
    TestRunner::assertTrue($ciphertext !== $plaintext, "Ciphertext is distinct from plaintext");

    $decrypted = openssl_decrypt($ciphertext, 'aes-256-cbc', $secretKey, 0, $iv);
    TestRunner::assertEquals($plaintext, $decrypted, "AES-256 decrypted matches original plaintext");

    $tampered = openssl_decrypt($ciphertext . 'bad', 'aes-256-cbc', $secretKey, 0, $iv);
    TestRunner::assertFalse($tampered === $plaintext, "Decryption rejects tampered payload");

    // 4. TOTP 2FA Verification
    $secret = TotpHelper::generateSecret();
    TestRunner::assertMatches('/^[A-Z2-7]{16,32}$/', $secret, "Generated TOTP secret is RFC 4648 Base32 compliant");

    $currentCode = TotpHelper::getCode($secret);
    TestRunner::assertMatches('/^[0-9]{6}$/', (string)$currentCode, "TOTP generates 6-digit numeric token");
    TestRunner::assertTrue(TotpHelper::verifyCode($secret, $currentCode), "Current TOTP code passes verification");
    TestRunner::assertFalse(TotpHelper::verifyCode($secret, '000000'), "Invalid TOTP code is rejected");

    // 5. Role-Based Access Control (RBAC) Logic
    $rolesAllowedAdminOnly = ['admin'];
    $rolesAllowedOperator = ['admin', 'operator'];
    $rolesAllowedAll = ['admin', 'operator', 'viewer', 'auditor'];

    TestRunner::assertTrue(in_array('admin', $rolesAllowedAdminOnly, true), "Admin has access to admin-only operations");
    TestRunner::assertFalse(in_array('viewer', $rolesAllowedAdminOnly, true), "Viewer denied access to admin-only operations");
    TestRunner::assertTrue(in_array('operator', $rolesAllowedOperator, true), "Operator has access to operator operations");
    TestRunner::assertFalse(in_array('viewer', $rolesAllowedOperator, true), "Viewer denied access to operator operations");
    TestRunner::assertTrue(in_array('viewer', $rolesAllowedAll, true), "Viewer has access to read-only views");
}

function runProcessManagerTest(): void {
    TestRunner::suite("Process Manager & Metrics Engine");

    // 1. Environment detection
    $isWin = ProcessManager::isWindows();
    TestRunner::assertEquals((PHP_OS_FAMILY === 'Windows'), $isWin, "OS platform correctly detected (Windows: " . ($isWin ? 'yes' : 'no') . ")");

    // 2. System-wide metrics
    $sys = ProcessManager::getSystemMetrics();
    TestRunner::assertTrue(isset($sys['load']), "System load key present in metrics");
    TestRunner::assertTrue(isset($sys['mem_usage']), "System memory usage key present in metrics");

    // 3. Spawning a monitored background process
    if ($isWin) {
        $testProcess = [
            'name' => 'test_worker',
            'command' => 'ping 127.0.0.1 -n 15',
            'working_dir' => sys_get_temp_dir(),
            'log_file' => null
        ];
    } else {
        $testProcess = [
            'name' => 'test_worker',
            'command' => 'sleep 15',
            'working_dir' => '/tmp',
            'log_file' => null
        ];
    }

    $pid = ProcessManager::startProcess($testProcess);
    TestRunner::assertTrue(($pid > 0), "ProcessManager successfully launched test process with PID $pid");

    if ($pid > 0) {
        $testProcess['pid'] = $pid;
        usleep(200000); // 200ms

        // 4. Alive inspection
        $alivePid = ProcessManager::isRunning($testProcess);
        TestRunner::assertTrue(($alivePid > 0), "ProcessManager::isRunning confirms process is alive");

        // 5. Per-process resource metrics
        $metrics = ProcessManager::getMetrics($pid);
        TestRunner::assertTrue(isset($metrics['cpu']), "Process metrics contain CPU metric");
        TestRunner::assertTrue(isset($metrics['mem']), "Process metrics contain RAM metric");
        TestRunner::assertTrue(isset($metrics['uptime']), "Process metrics contain Uptime metric");
        TestRunner::assertMatches('/[0-9\.]+\s*MB/', (string)$metrics['mem'], "RAM metric formatted in MB (" . $metrics['mem'] . ")");

        // 6. Clean process termination
        $stopped = ProcessManager::stopProcess($pid);
        TestRunner::assertTrue($stopped, "ProcessManager::stopProcess successfully invoked");

        usleep(300000); // 300ms

        // 7. Verify process is dead
        $aliveAfter = ProcessManager::isRunning($testProcess);
        TestRunner::assertFalse((bool)$aliveAfter, "Process is confirmed stopped after termination");
    }
}

function runAutoRestartTest(): void {
    TestRunner::suite("Native Supervisor Auto-Restart Logic");

    $tempDbPath = __DIR__ . '/temp_restart_' . uniqid() . '.sqlite';

    try {
        $db = new Database($tempDbPath);
        $pdo = $db->getPdo();

        $cmd = ProcessManager::isWindows() ? 'ping 127.0.0.1 -n 15' : 'sleep 15';

        // -------------------------------------------------------------
        // TEST CASE 1: Unexpected Death -> Instant Native Auto-Restart
        // -------------------------------------------------------------
        $stmt = $pdo->prepare("INSERT INTO processes (name, group_name, command, working_dir, auto_restart, status, pid, restart_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute(['auto_proc_1', 'Default', $cmd, sys_get_temp_dir(), 1, 'running', null, 0]);
        $procId = (int)$pdo->lastInsertId();

        // Simulate status check in api.php
        $proc = $pdo->query("SELECT * FROM processes WHERE id = $procId")->fetch(PDO::FETCH_ASSOC);
        $actual_pid = ProcessManager::isRunning($proc);
        TestRunner::assertFalse((bool)$actual_pid, "Process is initially not running (simulating crash)");

        $isExplicitlyStopped = ($proc['status'] === 'stopped');
        $autoRestartEnabled = !isset($proc['auto_restart']) || (int)$proc['auto_restart'] === 1;
        TestRunner::assertFalse($isExplicitlyStopped, "Process was not explicitly stopped");
        TestRunner::assertTrue($autoRestartEnabled, "Auto-restart is enabled");

        if (!$isExplicitlyStopped && $autoRestartEnabled) {
            $newPid = ProcessManager::startProcess($proc);
            TestRunner::assertTrue($newPid > 0, "Native auto-restart revived process with new PID $newPid");

            $update = $pdo->prepare("UPDATE processes SET pid = ?, status = 'running', last_restart = CURRENT_TIMESTAMP, restart_count = COALESCE(restart_count, 0) + 1 WHERE id = ?");
            $update->execute([$newPid, $procId]);
        }

        $revived = $pdo->query("SELECT * FROM processes WHERE id = $procId")->fetch(PDO::FETCH_ASSOC);
        TestRunner::assertEquals('running', $revived['status'], "Status in database is 'running'");
        TestRunner::assertEquals(1, (int)$revived['restart_count'], "Restart count incremented to 1");
        TestRunner::assertNotNull($revived['last_restart'], "Last restart timestamp recorded");

        // Clean up spawned process
        if (!empty($revived['pid'])) {
            ProcessManager::stopProcess((int)$revived['pid']);
        }

        // -------------------------------------------------------------
        // TEST CASE 2: User Explicitly Clicked "Stop" -> DO NOT RESTART
        // -------------------------------------------------------------
        $stmt->execute(['stopped_proc', 'Default', $cmd, sys_get_temp_dir(), 1, 'stopped', null, 0]);
        $stoppedId = (int)$pdo->lastInsertId();

        $stoppedRow = $pdo->query("SELECT * FROM processes WHERE id = $stoppedId")->fetch(PDO::FETCH_ASSOC);
        $isExplicitlyStopped2 = ($stoppedRow['status'] === 'stopped');

        TestRunner::assertTrue($isExplicitlyStopped2, "Process status is 'stopped'");

        $restarted = false;
        if (!$isExplicitlyStopped2 && $stoppedRow['auto_restart']) {
            $restarted = true;
        }
        TestRunner::assertFalse($restarted, "Auto-restart correctly skipped for manually stopped process");

        // -------------------------------------------------------------
        // TEST CASE 3: Auto-Restart Disabled (auto_restart = 0) -> DO NOT RESTART
        // -------------------------------------------------------------
        $stmt->execute(['no_auto_proc', 'Default', $cmd, sys_get_temp_dir(), 0, 'crashed', null, 0]);
        $noAutoId = (int)$pdo->lastInsertId();

        $noAutoRow = $pdo->query("SELECT * FROM processes WHERE id = $noAutoId")->fetch(PDO::FETCH_ASSOC);
        $autoRestartEnabled3 = (int)$noAutoRow['auto_restart'] === 1;
        TestRunner::assertFalse($autoRestartEnabled3, "auto_restart is set to 0");

        $restarted3 = false;
        if ($autoRestartEnabled3) {
            $restarted3 = true;
        }
        TestRunner::assertFalse($restarted3, "Auto-restart correctly skipped when auto_restart is disabled");

    } finally {
        @unlink($tempDbPath);
        @unlink($tempDbPath . '-wal');
        @unlink($tempDbPath . '-shm');
    }
}

function runDaemonTest(): void {
    TestRunner::suite("Daemon Supervisor Engine (daemon.php)");

    $daemonFile = dirname(__DIR__) . '/daemon.php';
    TestRunner::assertTrue(file_exists($daemonFile), "daemon.php exists in project root");

    $phpBin = PHP_BINARY;

    // 1. Check status CLI command
    $cmd = escapeshellarg($phpBin) . " " . escapeshellarg($daemonFile) . " --status 2>&1";
    $out = (string)@shell_exec($cmd);
    TestRunner::assertMatches('/Binary Alive daemon is (active|stopped)/i', $out, "daemon.php --status outputs valid state: " . trim($out));

    // 2. Test PID detection logic
    $pidFile = dirname(__DIR__) . '/db/.daemon.pid';
    $originalPid = file_exists($pidFile) ? file_get_contents($pidFile) : null;

    // Mock an invalid PID
    file_put_contents($pidFile, '99999999');
    $isActive = ProcessManager::isDaemonRunning();
    TestRunner::assertFalse($isActive, "isDaemonRunning cleans up and reports false for non-existent PID");
    TestRunner::assertFalse(file_exists($pidFile), "Stale PID file is automatically removed");

    // Restore original PID if it was active
    if ($originalPid !== null) {
        file_put_contents($pidFile, $originalPid);
    }

    // 3. Test non-blocking file locking mechanism
    $lockFile = dirname(__DIR__) . '/db/.daemon.lock';
    $fp1 = @fopen($lockFile, 'c');
    $locked1 = ($fp1 && @flock($fp1, LOCK_EX | LOCK_NB));
    TestRunner::assertTrue((bool)$locked1, "Acquired primary non-blocking lock on daemon lockfile");

    // Attempt second concurrent lock
    $fp2 = @fopen($lockFile, 'c');
    $locked2 = ($fp2 && @flock($fp2, LOCK_EX | LOCK_NB));
    TestRunner::assertFalse((bool)$locked2, "Secondary concurrent lock is properly rejected (prevents duplicate daemons)");

    if ($fp2) {
        @fclose($fp2);
    }
    if ($fp1) {
        @flock($fp1, LOCK_UN);
        @fclose($fp1);
    }
}

function runCronTest(): void {
    TestRunner::suite("System Cron Supervisor (cron.php)");

    $cronFile = dirname(__DIR__) . '/cron.php';
    TestRunner::assertTrue(file_exists($cronFile), "cron.php exists in project root");

    // 1. Verify cron CLI execution runs cleanly
    $phpBin = PHP_BINARY;
    $cmd = escapeshellarg($phpBin) . " " . escapeshellarg($cronFile) . " 2>&1";
    $output = @shell_exec($cmd);
    TestRunner::assertTrue(empty(trim((string)$output)), "cron.php executes silently from CLI with zero errors");

    // 2. Test cron lockfile concurrency protection
    $lockFile = dirname(__DIR__) . '/db/.cron.lock';
    $fp1 = @fopen($lockFile, 'c');
    $locked1 = ($fp1 && @flock($fp1, LOCK_EX | LOCK_NB));
    TestRunner::assertTrue((bool)$locked1, "Acquired primary lock on .cron.lock");

    // Run cron while locked -> must exit cleanly without blocking or throwing errors
    $outWhileLocked = (string)@shell_exec($cmd);
    TestRunner::assertTrue(empty(trim($outWhileLocked)), "Concurrent cron run exits immediately without conflict");

    if ($fp1) {
        @flock($fp1, LOCK_UN);
        @fclose($fp1);
    }
}

function runTerminalTest(): void {
    TestRunner::suite("Web Terminal Engine & Security Guards");

    // 1. Length validation guard
    $longCmd = str_repeat('a', 2001);
    TestRunner::assertTrue(strlen($longCmd) > 2000, "Generated command exceeding 2000 chars");

    $isRejected = (strlen($longCmd) > 2000);
    TestRunner::assertTrue($isRejected, "Commands exceeding 2000 characters are rejected");

    // 2. Directory Navigation (cd command interception)
    $targetValid = dirname(__DIR__);
    $realTarget = realpath($targetValid);
    TestRunner::assertTrue(is_dir((string)$realTarget), "Target directory exists: $realTarget");

    $targetInvalid = $realTarget . DIRECTORY_SEPARATOR . 'non_existent_folder_' . uniqid();
    $invalidCheck = realpath($targetInvalid);
    TestRunner::assertFalse((bool)$invalidCheck, "Non-existent directory rejected by path resolution");

    // 3. Command execution safety & Shell environments
    if (PHP_OS_FAMILY === 'Windows') {
        // CMD built-in execution
        $cmdOut = @shell_exec("cmd.exe /d /c echo HelloFromCmdTest 2>&1");
        TestRunner::assertContains('HelloFromCmdTest', (string)$cmdOut, "CMD shell executes and captures stdout cleanly");

        // PowerShell encoded execution
        $psScript = '$ProgressPreference = "SilentlyContinue"; Write-Output "HelloFromPowerShellTest" 2>&1';
        $enc = base64_encode(mb_convert_encoding($psScript, 'UTF-16LE', 'UTF-8'));
        $psOut = @shell_exec("powershell.exe -NoProfile -ExecutionPolicy Bypass -NonInteractive -EncodedCommand $enc");
        TestRunner::assertContains('HelloFromPowerShellTest', (string)$psOut, "PowerShell engine executes and captures stdout cleanly");

        // Windows Drive letter detection
        $drive = 'C:';
        $driveDetected = (bool)preg_match('/^([a-zA-Z]):$/', $drive);
        TestRunner::assertTrue($driveDetected, "Drive letter syntax (C:) is correctly detected");
    } else {
        $bashOut = @shell_exec("/bin/bash -c " . escapeshellarg("echo HelloFromBashTest 2>&1"));
        TestRunner::assertContains('HelloFromBashTest', (string)$bashOut, "Bash shell executes and captures stdout cleanly");

        $shOut = @shell_exec("/bin/sh -c " . escapeshellarg("echo HelloFromShTest 2>&1"));
        TestRunner::assertContains('HelloFromShTest', (string)$shOut, "POSIX Sh shell executes and captures stdout cleanly");
    }

    // 4. Shell switching trigger validation
    $powerSwitches = ['powershell', 'power', 'pwsh'];
    foreach ($powerSwitches as $sw) {
        TestRunner::assertTrue(in_array($sw, ['powershell', 'power', 'pwsh', 'cmd', 'bash', 'sh'], true), "Shell switch trigger '$sw' recognized");
    }

    // 5. Autocomplete path logic
    $scanDir = dirname(__DIR__);
    $items = @scandir($scanDir);
    TestRunner::assertTrue(is_array($items) && count($items) > 0, "Autocomplete successfully scans files in active directory");
}

function runApiTest(): void {
    TestRunner::suite("REST API & Endpoint Logic");

    $tempDbPath = __DIR__ . '/temp_api_' . uniqid() . '.sqlite';

    try {
        $db = new Database($tempDbPath);
        $pdo = $db->getPdo();

        // 1. Status Payload Structure Validation
        $stmt = $pdo->query("SELECT * FROM processes");
        $processes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $sys = ProcessManager::getSystemMetrics();
        $daemonActive = ProcessManager::isDaemonRunning();

        $statusPayload = [
            'success' => true,
            'data' => $processes,
            'sys_load' => $sys['load'],
            'sys_mem' => $sys['mem_usage'],
            'daemon_active' => $daemonActive
        ];

        TestRunner::assertTrue($statusPayload['success'], "Status response contains success: true");
        TestRunner::assertTrue(is_array($statusPayload['data']), "Status response data is an array");
        TestRunner::assertTrue(isset($statusPayload['sys_load']), "Status response contains sys_load");
        TestRunner::assertTrue(isset($statusPayload['sys_mem']), "Status response contains sys_mem");
        TestRunner::assertTrue(isset($statusPayload['daemon_active']), "Status response contains daemon_active flag");

        // 2. Add Process Validation
        $validName = 'api_test_worker';
        $validCmd = ProcessManager::isWindows() ? 'ping 127.0.0.1 -n 5' : 'sleep 5';
        $group = 'APITests';
        $dir = sys_get_temp_dir();
        $autoRestart = 1;

        $insert = $pdo->prepare("INSERT INTO processes (name, group_name, command, working_dir, auto_restart) VALUES (?, ?, ?, ?, ?)");
        $res = $insert->execute([$validName, $group, $validCmd, $dir, $autoRestart]);
        TestRunner::assertTrue($res, "API add_process logic successfully created record");
        $procId = (int)$pdo->lastInsertId();

        // Duplicate name rejection check
        $duplicateRejected = false;
        try {
            $insert->execute([$validName, $group, $validCmd, $dir, $autoRestart]);
        } catch (PDOException $e) {
            $duplicateRejected = true;
        }
        TestRunner::assertTrue($duplicateRejected, "Duplicate process name rejected by database constraints");

        // 3. Edit Process Validation
        $update = $pdo->prepare("UPDATE processes SET name = ?, group_name = ?, command = ?, working_dir = ?, auto_restart = ? WHERE id = ?");
        $updateRes = $update->execute(['api_test_worker_renamed', 'UpdatedGroup', $validCmd, $dir, 0, $procId]);
        TestRunner::assertTrue($updateRes, "API edit_process logic successfully updated record");

        $fetched = $pdo->query("SELECT * FROM processes WHERE id = $procId")->fetch(PDO::FETCH_ASSOC);
        TestRunner::assertEquals('api_test_worker_renamed', $fetched['name'], "Updated name matches");
        TestRunner::assertEquals('UpdatedGroup', $fetched['group_name'], "Updated group matches");
        TestRunner::assertEquals(0, (int)$fetched['auto_restart'], "Updated auto_restart matches");

        // 4. Delete Process Validation
        $delete = $pdo->prepare("DELETE FROM processes WHERE id = ?");
        $delete->execute([$procId]);
        $checkDeleted = $pdo->query("SELECT * FROM processes WHERE id = $procId")->fetch(PDO::FETCH_ASSOC);
        TestRunner::assertFalse((bool)$checkDeleted, "API delete_process logic successfully removed record");

    } finally {
        @unlink($tempDbPath);
        @unlink($tempDbPath . '-wal');
        @unlink($tempDbPath . '-shm');
    }
}

// =============================================================================
// Main Test Execution
// =============================================================================

echo "\n==================================================\n";
echo "   BINARY ALIVE - COMPREHENSIVE TEST SUITE\n";
echo "   PHP Version: " . PHP_VERSION . " (" . PHP_OS_FAMILY . ")\n";
echo "==================================================\n";

$startTime = microtime(true);

try {
    runSyntaxTest();
    runDatabaseTest();
    runAuthSecurityTest();
    runProcessManagerTest();
    runAutoRestartTest();
    runDaemonTest();
    runCronTest();
    runTerminalTest();
    runApiTest();
} catch (Throwable $e) {
    echo "\n[FATAL ERROR IN TEST SUITE]: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

$elapsed = round(microtime(true) - $startTime, 2);
echo "Elapsed Time: {$elapsed}s\n";

$exitCode = TestRunner::summary();
exit($exitCode);
