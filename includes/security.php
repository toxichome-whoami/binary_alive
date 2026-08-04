<?php
// includes/security.php

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

// Force strict security headers
header("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
header("Content-Security-Policy: default-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://code.jquery.com; img-src 'self' data: https://chart.googleapis.com https://api.qrserver.com; frame-ancestors 'none';");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Prevent information leakage
header_remove("X-Powered-By");

// Basic IP Whitelist Check (callable early in the lifecycle)
function enforceIpWhitelist($allowedIps = []) {
    if (empty($allowedIps)) return;
    
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    
    // Simple direct match for now (no CIDR block parsing to keep it lightweight)
    if (!in_array($clientIp, $allowedIps)) {
        header("HTTP/1.1 403 Forbidden");
        die("403 Forbidden - IP not allowed.");
    }
}

// CSRF Token Management
function generateCsrfToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrfToken($token = null) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if ($token === null) {
        $token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    }
    if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        if (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false || !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Invalid or expired CSRF token']);
            exit();
        }
        header("HTTP/1.1 403 Forbidden");
        die("403 Forbidden - Invalid or expired CSRF token. Please return, refresh the page, and try again.");
    }
    return true;
}

// Symmetric Encryption Helpers using AES-256-CBC
function getSecretKey() {
    static $key = null;
    if ($key === null) {
        $configFile = __DIR__ . '/../config.json';
        if (file_exists($configFile)) {
            $cfg = json_decode(file_get_contents($configFile), true);
            $key = $cfg['security']['secret_key'] ?? 'default_fallback_secret_binary_alive_2026';
        } else {
            $key = 'default_fallback_secret_binary_alive_2026';
        }
    }
    return hash('sha256', $key, true);
}

function encryptData($plaintext) {
    if (empty($plaintext)) return '';
    $key = getSecretKey();
    $iv = random_bytes(16);
    $ciphertext = openssl_encrypt($plaintext, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $ciphertext);
}

function decryptData($encrypted) {
    if (empty($encrypted)) return '';
    $raw = base64_decode($encrypted, true);
    if ($raw === false || strlen($raw) <= 16) return '';
    $iv = substr($raw, 0, 16);
    $ciphertext = substr($raw, 16);
    $key = getSecretKey();
    $decrypted = openssl_decrypt($ciphertext, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return $decrypted !== false ? $decrypted : '';
}
