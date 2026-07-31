<?php
// includes/logger.php

class Logger {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function logAudit($userId, $action, $details = '') {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $stmt = $this->pdo->prepare("INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
        $stmt->execute([$userId, $action, $details, $ip]);
    }

    public function logLoginAttempt($username, $isSuccess) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $stmt = $this->pdo->prepare("INSERT INTO login_attempts (ip_address, username, is_successful) VALUES (?, ?, ?)");
        $stmt->execute([$ip, $username, $isSuccess ? 1 : 0]);
    }
}
