<?php
// includes/logger.php

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

class Logger {
    /** @var \PDO */
    private $pdo;

    /**
     * @param \PDO $pdo
     */
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function logAudit($userId, $action, $details = '') {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $username = null;
        if ($userId) {
            if ($action === 'logout' && isset($_SESSION['username'])) {
                $username = $_SESSION['username'];
            } else {
                $stmt = $this->pdo->prepare("SELECT username FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                $username = $stmt->fetchColumn() ?: null;
            }
        }

        try {
            $stmt = $this->pdo->prepare("INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $username, $action, $details, $ip]);
        } catch (PDOException $e) {
            $stmt = $this->pdo->prepare("INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $action, $details, $ip]);
        }
    }

    public function logLoginAttempt($username, $isSuccess, $ip = null) {
        if ($ip === null) {
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        }
        $stmt = $this->pdo->prepare("INSERT INTO login_attempts (ip_address, username, is_successful) VALUES (?, ?, ?)");
        $stmt->execute([$ip, $username, $isSuccess ? 1 : 0]);
    }

    public function logLogin($username, $isSuccess, $ip = null) {
        $this->logLoginAttempt($username, $isSuccess, $ip);
    }
}
