<?php
// Prevent browser and LiteSpeed caching issues
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

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

$stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'enable_captcha'");
$captchaSetting = $stmt->fetchColumn();
$captchaEnabled = ($captchaSetting === false) ? true : ($captchaSetting === '1');

// Check if any users exist
$stmt = $pdo->query("SELECT COUNT(*) FROM users");
$userCount = $stmt->fetchColumn();
$isSetupMode = ($userCount == 0);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrfToken();
    // Basic CSRF & Honeypot check
    if (!empty($_POST['website'])) {
        die("Bot detected."); // Honeypot filled
    }

    $captchaValid = true;
    if ($captchaEnabled) {
        $captcha_answer = strtoupper(trim($_POST['captcha'] ?? ''));
        $expected = $_SESSION['captcha_code'] ?? '';
        
        // Always unset on submit to prevent replay attacks
        unset($_SESSION['captcha_code']);
        
        if (empty($expected) || $captcha_answer !== $expected) {
            $captchaValid = false;
            $error = "Incorrect Security CAPTCHA. Please try again.";
        }
    }
    
    if ($captchaValid) {
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
    
    // PRG Pattern: Redirect back to login.php with flash messages to prevent form resubmission warnings on reload
    if ($error) {
        $_SESSION['login_error'] = $error;
        $_SESSION['login_old_username'] = $_POST['username'] ?? '';
        header("Location: login.php");
        exit();
    }
}

// Fetch flash session data if it exists
if (isset($_SESSION['login_error'])) {
    $error = $_SESSION['login_error'];
    $old_username = $_SESSION['login_old_username'] ?? '';
    unset($_SESSION['login_error'], $_SESSION['login_old_username']);
} else {
    $old_username = '';
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
            <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
            <div class="mb-3">
                <label>Username</label>
                <input type="text" name="username" class="form-control" value="<?= htmlspecialchars($old_username) ?>" required>
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
            
            <!-- Image Captcha -->
            <?php if ($captchaEnabled): ?>
            <div class="mb-3">
                <label class="form-label">Security Check</label>
                <div class="d-flex align-items-center mb-2">
                    <img src="captcha.php" alt="CAPTCHA" id="captcha-img" class="rounded border me-3" style="cursor: pointer; min-width: 160px; min-height: 50px;" onclick="refreshCaptcha()" title="Click to refresh image">
                    <div class="position-relative w-100">
                        <input type="text" name="captcha" id="captcha-input" class="form-control" placeholder="Enter code" required autocomplete="off" style="text-transform: uppercase; padding-right: 35px;" maxlength="6">
                        <span id="captcha-status" class="position-absolute" style="right: 10px; top: 50%; transform: translateY(-50%); font-size: 1.2rem;"></span>
                    </div>
                </div>
                <small class="text-muted" style="font-size: 0.75rem;">Click the image to generate a new code.</small>
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
    
    <script>
    function refreshCaptcha() {
        document.getElementById('captcha-img').src = 'captcha.php?' + Math.random();
        document.getElementById('captcha-input').value = '';
        document.getElementById('captcha-status').innerHTML = '';
        document.getElementById('captcha-input').style.borderColor = '';
    }

    document.addEventListener('DOMContentLoaded', function() {
        const captchaInput = document.getElementById('captcha-input');
        if (captchaInput) {
            captchaInput.addEventListener('input', function() {
                const val = this.value.trim();
                const status = document.getElementById('captcha-status');
                if (val.length === 6) {
                    status.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary"></span>';
                    const fd = new FormData();
                    fd.append('captcha', val);
                    fetch('captcha_check.php', { method: 'POST', body: fd })
                    .then(r => r.json())
                    .then(data => {
                        if (data.valid) {
                            status.innerHTML = '<span class="text-success fw-bold">✔</span>';
                            captchaInput.style.borderColor = '#198754';
                        } else {
                            status.innerHTML = '<span class="text-danger fw-bold">✘</span>';
                            captchaInput.style.borderColor = '#dc3545';
                            if (data.reload) {
                                refreshCaptcha();
                            }
                        }
                    }).catch(() => {
                        status.innerHTML = '';
                    });
                } else {
                    status.innerHTML = '';
                    captchaInput.style.borderColor = '';
                }
            });
        }
    });
    </script>
</body>
</html>
