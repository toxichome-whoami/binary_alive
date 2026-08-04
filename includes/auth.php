<?php
// includes/auth.php

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

if (session_status() === PHP_SESSION_NONE) {
    $isLocal = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1', '::1']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => !$isLocal, // Unconditionally secure in production (finding #5)
        'httponly' => true,
        'samesite' => 'Strict'  // Omitted domain to prevent host header attacks (finding #6)
    ]);
    session_start();
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/totp_helper.php';

class Auth {
    private $pdo;
    private $logger;
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

    public function login($username, $password, $totpCode = '') {
        if ($this->isLockedOut($username)) {
            $this->logger->logLoginAttempt($username, false);
            return ["success" => false, "message" => "Account locked due to too many failed attempts."];
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])) {
            
            // TOTP Verification if secret is set
            if (!empty($user['totp_secret'])) {
                $decryptedSecret = decryptData($user['totp_secret']);
                $secretToTest = !empty($decryptedSecret) ? $decryptedSecret : $user['totp_secret'];
                if (empty($totpCode) || !TotpHelper::verifyCode($secretToTest, $totpCode)) {
                    $this->logger->logLoginAttempt($username, false);
                    return ["success" => false, "message" => "Invalid Two-Factor Authentication code."];
                }
            }

            $this->resetFailedAttempts($username);
            $this->logger->logLoginAttempt($username, true);
            $this->logger->logAudit($user['id'], 'login_success');
            
            session_regenerate_id(true);
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32)); // Rotate CSRF token on login (finding #7)
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['last_activity'] = time();
            return ["success" => true];
        } else {
            $this->incrementFailedAttempts($username);
            $this->logger->logLoginAttempt($username, false);
            return ["success" => false, "message" => "Invalid credentials."];
        }
    }

    public function logout() {
        if (isset($_SESSION['user_id'])) {
            $this->logger->logAudit($_SESSION['user_id'], 'logout');
        }
        session_unset();
        session_destroy();
    }

    public function isAuthenticated() {
        // Handle API Token authentication if no session
        if (!isset($_SESSION['user_id'])) {
            $headers = apache_request_headers();
            $token = '';
            if (isset($headers['Authorization'])) {
                $token = str_replace('Bearer ', '', $headers['Authorization']);
            } elseif (isset($_GET['api_token'])) {
                $token = $_GET['api_token'];
            }

            if (!empty($token)) {
                $hashedToken = hash('sha256', $token);
                $stmt = $this->pdo->prepare("SELECT id, username, role FROM users WHERE api_token = ? OR api_token = ?");
                $stmt->execute([$hashedToken, $token]); // Supports new hashes while allowing smooth upgrade
                $user = $stmt->fetch();
                if ($user) {
                    // Set a pseudo-session for the rest of the script
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['role'] = $user['role'];
                    $_SESSION['api_auth'] = true; // Mark as API authenticated
                    return true;
                }
            }
            return false;
        }

        // Session timeout from config or default 15 mins
        $timeoutMins = $this->config['security']['session_timeout_minutes'] ?? 15;
        $timeoutSecs = $timeoutMins * 60;

        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $timeoutSecs)) {
            $this->logout();
            return false;
        }

        // Live Security Check: Refresh role from DB and ensure user wasn't deleted
        if (isset($_SESSION['user_id'])) {
            $stmt = $this->pdo->prepare("SELECT role FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $currentRole = $stmt->fetchColumn();
            
            if ($currentRole) {
                $_SESSION['role'] = $currentRole; // Instantly apply role changes
            } else {
                $this->logout(); // Instantly log them out if deleted
                return false;
            }
        }

        $_SESSION['last_activity'] = time();
        return true;
    }

    public function requireAuth() {
        if (!$this->isAuthenticated()) {
            if (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                exit();
            }
            header("Location: login.php");
            exit();
        }
    }
    
    public function hasRole($allowedRoles) {
        $userRole = $_SESSION['role'] ?? '';
        return in_array($userRole, (array)$allowedRoles);
    }
    
    public function requireRole($allowedRoles) {
        if (!$this->hasRole($allowedRoles)) {
            if (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'Forbidden - Insufficient Role']);
                exit();
            }
            header("HTTP/1.1 403 Forbidden");
            die("403 Forbidden - You do not have permission to access this resource.");
        }
    }
    
    public function getLogger() {
        return $this->logger;
    }
    
    public function getPdo() {
        return $this->pdo;
    }

    private function isLockedOut($username) {
        $stmt = $this->pdo->prepare("SELECT locked_until FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $locked_until = $stmt->fetchColumn();

        if ($locked_until && strtotime($locked_until) > time()) {
            return true;
        }
        return false;
    }

    private function incrementFailedAttempts($username) {
        $stmt = $this->pdo->prepare("SELECT failed_attempts FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $attempts = $stmt->fetchColumn();

        $maxAttempts = $this->config['security']['max_login_attempts'] ?? 5;
        $blockMins = $this->config['security']['block_duration_minutes'] ?? 15;

        if ($attempts !== false) {
            $attempts++;
            if ($attempts >= $maxAttempts) {
                $locked_until = date('Y-m-d H:i:s', time() + ($blockMins * 60));
                $stmt = $this->pdo->prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE username = ?");
                $stmt->execute([$attempts, $locked_until, $username]);
            } else {
                $stmt = $this->pdo->prepare("UPDATE users SET failed_attempts = ? WHERE username = ?");
                $stmt->execute([$attempts, $username]);
            }
        }
    }

    private function resetFailedAttempts($username) {
        $stmt = $this->pdo->prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = ?");
        $stmt->execute([$username]);
    }
}
