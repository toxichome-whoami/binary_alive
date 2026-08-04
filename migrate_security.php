<?php
// migrate_security.php
// This script migrates plaintext API tokens to SHA-256 hashes 
// and encrypts plaintext TOTP secrets using AES-256-CBC.

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$isCli = (php_sapi_name() === 'cli');

if (!$isCli && (!isset($_SESSION['user_id']) || $_SESSION['user_id'] != 1)) {
    die("Access denied. You must run this script from the terminal (CLI) or be logged in as the Master Admin in your browser.");
}

require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/database.php';

$db = new Database();
$pdo = $db->getPdo();

$eol = $isCli ? "\n" : "<br>";

echo "Starting Security Migration...$eol";

// Check if migration already ran
$stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'security_migration_done'");
$done = $stmt->fetchColumn();

if ($done === '1') {
    die("Migration already completed previously. No action needed.$eol");
}

// Get all users
$stmt = $pdo->query("SELECT id, api_token, totp_secret FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updated = 0;
foreach ($users as $user) {
    $updates = [];
    $params = [];
    
    // Hash existing plaintext API tokens
    if (!empty($user['api_token'])) {
        $hashedToken = hash('sha256', $user['api_token']);
        $updates[] = "api_token = ?";
        $params[] = $hashedToken;
    }
    
    // Encrypt existing plaintext TOTP secrets
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
        $updateStmt = $pdo->prepare($sql);
        $updateStmt->execute($params);
        $updated++;
    }
}

// Mark migration as done (Using INSERT OR REPLACE for wide SQLite version compatibility)
$pdo->exec("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES ('security_migration_done', '1')");

echo "Migration completed successfully. Updated $updated user accounts.$eol";

if (!$isCli) {
    echo "<br><a href='index.php'>Return to Dashboard</a>";
}
