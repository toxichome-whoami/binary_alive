<?php
// includes/database.php

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

class Database {
    private $pdo;
    private $dbPath;

    public function __construct($dbPath = null) {
        if ($dbPath === null) {
            require_once __DIR__ . '/security.php';
            $cfg = getAppConfig();
            $dbName = $cfg['system']['db_filename'] ?? null;
            $dbDir = __DIR__ . '/../db/';
            
            if (empty($dbName)) {
                $dbName = 'monitor_' . bin2hex(random_bytes(16)) . '.sqlite';
                $cfg['system']['db_filename'] = $dbName;
                saveAppConfig($cfg);
                
                if (file_exists($dbDir . 'monitor.sqlite') && !file_exists($dbDir . $dbName)) {
                    @rename($dbDir . 'monitor.sqlite', $dbDir . $dbName);
                    @rename($dbDir . 'monitor.sqlite-wal', $dbDir . $dbName . '-wal');
                    @rename($dbDir . 'monitor.sqlite-shm', $dbDir . $dbName . '-shm');
                }
            }
            $this->dbPath = $dbDir . $dbName;
        } else {
            $this->dbPath = $dbPath;
        }
        $this->connect();
        $this->initSchema();
    }

    private function connect() {
        try {
            // Ensure directory exists with restricted permissions (finding #2)
            $dir = dirname($this->dbPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0700, true);
            } else {
                @chmod($dir, 0700);
            }

            $indexFile = $dir . '/index.php';
            if (!file_exists($indexFile)) {
                @file_put_contents($indexFile, "<?php http_response_code(403); exit('Access denied.'); ?>");
            }

            $this->pdo = new PDO("sqlite:" . $this->dbPath);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->exec("PRAGMA journal_mode = WAL;");
            
            if (file_exists($this->dbPath)) {
                @chmod($this->dbPath, 0600);
            }
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            die("A temporary system error occurred. Please try again later.");
        }
    }

    private function initSchema() {
        $queries = [
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                totp_secret TEXT,
                api_token TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                failed_attempts INTEGER DEFAULT 0,
                locked_until DATETIME
            )",
            "CREATE TABLE IF NOT EXISTS processes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                group_name TEXT DEFAULT 'Default',
                command TEXT NOT NULL,
                working_dir TEXT,
                log_file TEXT,
                auto_restart BOOLEAN DEFAULT 1,
                status TEXT DEFAULT 'stopped',
                pid INTEGER,
                last_restart DATETIME,
                restart_count INTEGER DEFAULT 0
            )",
            "CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                username TEXT,
                is_successful BOOLEAN DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT
            )"
        ];

        foreach ($queries as $query) {
            $this->pdo->exec($query);
        }

        // Handle schema upgrade if updating from Phase 1/2
        try {
            $this->pdo->exec("ALTER TABLE users ADD COLUMN totp_secret TEXT");
        } catch (PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE processes ADD COLUMN group_name TEXT DEFAULT 'Default'");
        } catch (PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE users ADD COLUMN api_token TEXT");
        } catch (PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE audit_logs ADD COLUMN username TEXT");
        } catch (PDOException $e) {}

        // Auto-run security migration if not already done
        $this->runSecurityMigration();
    }

    private function runSecurityMigration() {
        try {
            $stmt = $this->pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'security_migration_done'");
            $done = $stmt->fetchColumn();
            if ($done === '1') return;

            require_once __DIR__ . '/security.php';
            
            $stmt = $this->pdo->query("SELECT id, api_token, totp_secret FROM users");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($users as $user) {
                $updates = [];
                $params = [];
                
                // Hash plaintext API tokens
                if (!empty($user['api_token']) && strlen($user['api_token']) !== 64 && !preg_match('/^[a-f0-9]{64}$/', $user['api_token'])) {
                    // Assuming existing ones could be anything, actually previously we used bin2hex(random_bytes(32)) which IS 64 chars hex
                    // We must assume all unmigrated tokens are plaintext and just hash them
                }
                
                if (!empty($user['api_token'])) {
                    $hashedToken = hash('sha256', $user['api_token']);
                    $updates[] = "api_token = ?";
                    $params[] = $hashedToken;
                }
                
                if (!empty($user['totp_secret'])) {
                    $encryptedSecret = encryptData($user['totp_secret']);
                    if ($encryptedSecret !== false) {
                        $updates[] = "totp_secret = ?";
                        $params[] = $encryptedSecret;
                    }
                }
                
                if (!empty($updates)) {
                    $params[] = $user['id'];
                    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
                    $updateStmt = $this->pdo->prepare($sql);
                    $updateStmt->execute($params);
                }
            }
            
            $this->pdo->exec("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES ('security_migration_done', '1')");
        } catch (Exception $e) {
            error_log("Migration failed: " . $e->getMessage());
        }
    }

    public function getPdo() {
        return $this->pdo;
    }

    public function getDbPath() {
        return $this->dbPath;
    }
}
