<?php
// includes/logger.php

class Logger {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function logAudit($userId, $action, $details = '') {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $username = null;
        if ($userId) {
            // Check if we are logging out, we might already have the username in session
            if ($action === 'logout' && isset($_SESSION['username'])) {
                $username = $_SESSION['username'];
            } else {
                $stmt = $this->pdo->prepare("SELECT username FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                $username = $stmt->fetchColumn() ?: null;
            }
        }
        
        // Handle database schema upgrade gracefully if the column exists
        try {
            $stmt = $this->pdo->prepare("INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $username, $action, $details, $ip]);
        } catch (PDOException $e) {
            // Fallback for older schema before the ALTER TABLE takes effect (or if it fails)
            $stmt = $this->pdo->prepare("INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $action, $details, $ip]);
        }
    }

    public function logLoginAttempt($username, $isSuccess) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $stmt = $this->pdo->prepare("INSERT INTO login_attempts (ip_address, username, is_successful) VALUES (?, ?, ?)");
        $stmt->execute([$ip, $username, $isSuccess ? 1 : 0]);
    }
}
