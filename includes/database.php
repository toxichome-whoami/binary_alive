<?php
// includes/database.php

class Database {
    private $pdo;
    private $dbPath;

    public function __construct($dbPath = __DIR__ . '/../db/monitor.sqlite') {
        $this->dbPath = $dbPath;
        $this->connect();
        $this->initSchema();
    }

    private function connect() {
        try {
            // Ensure directory exists
            $dir = dirname($this->dbPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0750, true);
            }

            $this->pdo = new PDO("sqlite:" . $this->dbPath);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->exec("PRAGMA journal_mode = WAL;");
        } catch (PDOException $e) {
            die("Database connection failed: " . $e->getMessage());
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
    }

    public function getPdo() {
        return $this->pdo;
    }
}
