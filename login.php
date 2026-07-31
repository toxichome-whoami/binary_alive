<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';
$auth = new Auth();
$pdo = $auth->getPdo();

if ($auth->isAuthenticated()) {
    header("Location: index.php");
    exit();
}

$error = '';
$success = '';

// Check if any users exist
$stmt = $pdo->query("SELECT COUNT(*) FROM users");
$userCount = $stmt->fetchColumn();
$isSetupMode = ($userCount == 0);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Basic CSRF & Honeypot check
    if (!empty($_POST['website'])) {
        die("Bot detected."); // Honeypot filled
    }

    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    
    if ($isSetupMode) {
        if (!empty($username) && !empty($password)) {
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')");
            $stmt->execute([$username, $hash]);
            
            // Auto login after setup
            $auth->login($username, $password, '');
            header("Location: index.php");
            exit();
        } else {
            $error = "Username and password are required.";
        }
    } else {
        $totp = $_POST['totp'] ?? '';
        $result = $auth->login($username, $password, $totp);
        if ($result['success']) {
            header("Location: index.php");
            exit();
        } else {
            $error = $result['message'];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Binary Alive</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background-color: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .login-card { width: 100%; max-width: 400px; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; }
        .honeypot { display: none; }
    </style>
</head>
<body>
    <div class="login-card">
        <h3 class="text-center mb-4">Binary Alive</h3>
        
        <?php if ($isSetupMode): ?>
            <div class="alert alert-info">
                <strong>Welcome!</strong> No users found in the database. Please create the initial Administrator account below.
            </div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="alert alert-danger"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <div class="mb-3">
                <label>Username</label>
                <input type="text" name="username" class="form-control" required>
            </div>
            <div class="mb-3">
                <label>Password</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            
            <?php if (!$isSetupMode): ?>
            <div class="mb-3">
                <label>2FA Code (If enabled)</label>
                <input type="text" name="totp" class="form-control" placeholder="123456" autocomplete="off">
            </div>
            <?php endif; ?>
            
            <!-- Honeypot -->
            <input type="text" name="website" class="honeypot" tabindex="-1" autocomplete="off">
            
            <?php if ($isSetupMode): ?>
                <button type="submit" class="btn btn-success w-100">Create Admin Account</button>
            <?php else: ?>
                <button type="submit" class="btn btn-primary w-100">Secure Login</button>
            <?php endif; ?>
        </form>
    </div>
</body>
</html>
