<?php
// login.php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';

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
    
    // Honeypot check
    if (!empty($_POST['website'])) {
        die("Bot detected.");
    }

    $captchaValid = true;
    if ($captchaEnabled) {
        $captcha_answer = strtoupper(trim($_POST['captcha'] ?? ''));
        $expected = $_SESSION['captcha_code'] ?? '';

        unset($_SESSION['captcha_code']);

        if (empty($expected) || $captcha_answer !== $expected) {
            $captchaValid = false;
            $error = "Incorrect security captcha. Please try again.";
        }
    }

    if ($captchaValid) {
        $username = trim($_POST['username'] ?? '');
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
            $totp = trim($_POST['totp'] ?? '');
            $result = $auth->login($username, $password, $totp);
            if ($result['success']) {
                header("Location: index.php");
                exit();
            } else {
                $error = $result['message'];
            }
        }
    }

    // Flash session message
    if ($error) {
        $_SESSION['login_error'] = $error;
        $_SESSION['login_old_username'] = $_POST['username'] ?? '';
        header("Location: login.php");
        exit();
    }
}

if (isset($_SESSION['login_error'])) {
    $error = $_SESSION['login_error'];
    $old_username = $_SESSION['login_old_username'] ?? '';
    unset($_SESSION['login_error'], $_SESSION['login_old_username']);
} else {
    $old_username = '';
}
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= generateCsrfToken() ?>">
    <title>Sign In - Binary Alive</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-body);
            padding: 1rem;
        }
        .login-box {
            width: 100%;
            max-width: 400px;
            background-color: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 2rem;
            box-shadow: none !important;
        }
        .honeypot { display: none; }
    </style>
    <script>
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
    </script>
</head>
<body>
    <div class="login-box">
        <div class="text-center mb-4">
            <h4 class="fw-bold mb-1">
                <i class="bi bi-shield-check text-success"></i> Binary Alive
            </h4>
            <p class="text-muted small">Process Supervisor & Monitor</p>
        </div>

        <?php if ($isSetupMode): ?>
            <div class="alert alert-info py-2 px-3 small mb-3">
                <strong>Initial Setup:</strong> Please create the initial Administrator account below.
            </div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="alert alert-danger py-2 px-3 small mb-3"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <form method="POST" action="">
            <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
            
            <div class="mb-3">
                <label class="form-label">Username</label>
                <input type="text" name="username" class="form-control" value="<?= htmlspecialchars($old_username) ?>" required autocomplete="username" autofocus>
            </div>

            <div class="mb-3">
                <label class="form-label">Password</label>
                <input type="password" name="password" class="form-control" required autocomplete="current-password">
            </div>

            <?php if (!$isSetupMode): ?>
            <div class="mb-3">
                <label class="form-label">Two-Factor Code (If enabled)</label>
                <input type="text" name="totp" class="form-control font-mono" placeholder="123456" autocomplete="one-time-code">
            </div>
            <?php endif; ?>

            <?php if ($captchaEnabled): ?>
            <div class="mb-3">
                <label class="form-label">Security Check</label>
                <div class="d-flex align-items-center gap-2 mb-2">
                    <img src="captcha.php" alt="CAPTCHA" id="captcha-img" class="border rounded" style="cursor: pointer; height: 38px; width: 140px; object-fit: cover;" onclick="refreshCaptcha()" title="Click to refresh image">
                    <input type="text" name="captcha" id="captcha-input" class="form-control font-mono text-uppercase" placeholder="Code" required autocomplete="off" maxlength="6">
                </div>
                <div class="form-text">Click the image if you need a new code.</div>
            </div>
            <?php endif; ?>

            <!-- Honeypot -->
            <input type="text" name="website" class="honeypot" tabindex="-1" autocomplete="off">

            <button type="submit" class="btn-clean btn-clean-primary w-100 py-2 mt-2">
                <?= $isSetupMode ? 'Create Admin Account' : 'Sign In' ?>
            </button>
        </form>
    </div>

    <script>
    function refreshCaptcha() {
        const img = document.getElementById('captcha-img');
        if (img) {
            img.src = 'captcha.php?' + Math.random();
            const input = document.getElementById('captcha-input');
            if (input) input.value = '';
        }
    }
    </script>
</body>
</html>
