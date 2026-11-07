<?php
// includes/auth.php

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

if (session_status() === PHP_SESSION_NONE) {
    $hostName = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
    $isLocalhost = in_array($hostName, ['localhost', '127.0.0.1', '::1']) || php_sapi_name() === 'cli-server';
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => (!$isLocalhost || $isHttps),
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    session_start();
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/totp_helper.php';

class Auth {
    /** @var \PDO */
    private $pdo;
    /** @var \Logger */
    private $logger;
    /** @var array */
    private $config;

    public function __construct() {
        $db = new Database();
        $this->pdo = $db->getPdo();
        $this->logger = new Logger($this->pdo);

        $this->config = getAppConfig();

        // IP Whitelist Check
        if (!empty($this->config['security']['allowed_ips'])) {
            enforceIpWhitelist($this->config['security']['allowed_ips']);
        }
    }

    public function getPdo() {
        return $this->pdo;
    }

    public function getLogger() {
        return $this->logger;
    }

    public function login($username, $password, $totpCode = null) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        // Check for brute force lock
        if ($this->isIpBlocked($ip)) {
            $this->logger->logLogin($username, false, $ip);
            return ['success' => false, 'message' => 'Too many failed login attempts. Please try again in 15 minutes.'];
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->recordFailedAttempt($ip);
            $this->logger->logLogin($username, false, $ip);
            return ['success' => false, 'message' => 'Invalid username or password'];
        }

        if (password_verify($password, $user['password_hash'])) {
            // Check 2FA
            if (!empty($user['totp_secret'])) {
                $decryptedSecret = decryptData($user['totp_secret']);
                if (empty($totpCode) || !TotpHelper::verifyCode($decryptedSecret, $totpCode)) {
                    $this->recordFailedAttempt($ip, $user['id']);
                    $this->logger->logLogin($username, false, $ip);
                    return ['success' => false, 'message' => 'Invalid or missing Two-Factor Authentication code'];
                }
            }

            // Reset failed attempts
            $this->resetFailedAttempts($ip, $user['id']);

            // Session Fixation Prevention: regenerate session ID on successful login
            session_regenerate_id(true);

            // Rotate CSRF token on login
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['login_time'] = time();

            $this->logger->logLogin($username, true, $ip);
            $this->logger->logAudit($user['id'], 'login_success', 'User logged in successfully');

            return ['success' => true];
        } else {
            $this->recordFailedAttempt($ip, $user['id']);
            $this->logger->logLogin($username, false, $ip);
            return ['success' => false, 'message' => 'Invalid username or password'];
        }
    }

    public function logout() {
        if ($this->isAuthenticated()) {
            $this->logger->logAudit($_SESSION['user_id'], 'logout', 'User logged out');
        }
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }

    public function isAuthenticated() {
        return isset($_SESSION['user_id']);
    }

    public function requireAuth() {
        // First check for API Token Auth if present
        if ($this->authenticateViaToken()) {
            return;
        }

        if (!$this->isAuthenticated()) {
            if ($this->isApiRequest()) {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Unauthorized']);
                exit();
            }
            header("Location: login.php");
            exit();
        }

        // Session timeout (e.g., 2 hours)
        $timeout = 7200;
        if (isset($_SESSION['login_time']) && (time() - $_SESSION['login_time'] > $timeout)) {
            $this->logout();
            header("Location: login.php?timeout=1");
            exit();
        }
    }

    public function hasRole($roles = []) {
        if (!$this->isAuthenticated()) return false;
        return in_array($_SESSION['role'], (array)$roles);
    }

    public function requireRole($roles = []) {
        $this->requireAuth();
        if (!$this->hasRole($roles)) {
            if ($this->isApiRequest()) {
                http_response_code(403);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Forbidden']);
                exit();
            }
            http_response_code(403);
            die("403 Forbidden - Access Denied");
        }
    }

    private function authenticateViaToken() {
        $token = null;
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            if (preg_match('/Bearer\s(\S+)/', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
                $token = $matches[1];
            }
        } elseif (isset($_GET['api_token'])) {
            $token = $_GET['api_token'];
        }

        if ($token) {
            $hashedToken = hash('sha256', $token);
            $stmt = $this->pdo->prepare("SELECT * FROM users WHERE api_token = ?");
            $stmt->execute([$hashedToken]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['api_auth'] = true;
                return true;
            }
        }
        return false;
    }

    private function isApiRequest() {
        return (
            (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) ||
            (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], 'api.php') !== false) ||
            isset($_SESSION['api_auth'])
        );
    }

    private function recordFailedAttempt($ip, $userId = null) {
        $stmt = $this->pdo->prepare("INSERT INTO login_attempts (ip_address, is_successful) VALUES (?, 0)");
        $stmt->execute([$ip]);

        if ($userId) {
            $stmt = $this->pdo->prepare("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?");
            $stmt->execute([$userId]);
        }
    }

    private function resetFailedAttempts($ip, $userId = null) {
        if ($userId) {
            $stmt = $this->pdo->prepare("UPDATE users SET failed_attempts = 0 WHERE id = ?");
            $stmt->execute([$userId]);
        }
    }

    private function isIpBlocked($ip) {
        $timeWindow = date('Y-m-d H:i:s', time() - 900); // 15 mins ago
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip_address = ? AND is_successful = 0 AND timestamp > ?");
        $stmt->execute([$ip, $timeWindow]);
        return $stmt->fetchColumn() >= 5;
    }
}
