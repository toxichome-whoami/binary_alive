<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/totp_helper.php';

$auth = new Auth();
$auth->requireAuth();
$pdo = $auth->getPdo();

$userId = $_SESSION['user_id'];

$stmt = $pdo->prepare("SELECT username, totp_secret FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    verifyCsrfToken();
    if ($_POST['action'] === 'enable') {
        $secret = $_POST['secret'];
        $code = $_POST['code'];

        if (TotpHelper::verifyCode($secret, $code)) {
            $encryptedSecret = encryptData($secret);
            $stmt = $pdo->prepare("UPDATE users SET totp_secret = ? WHERE id = ?");
            $stmt->execute([$encryptedSecret, $userId]);
            $auth->getLogger()->logAudit($userId, 'enable_2fa');
            $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">Two-factor authentication enabled successfully.</div>';
        } else {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Invalid verification code. Please try again.</div>';
        }
    } elseif ($_POST['action'] === 'disable') {
        $stmt = $pdo->prepare("UPDATE users SET totp_secret = NULL WHERE id = ?");
        $stmt->execute([$userId]);
        $auth->getLogger()->logAudit($userId, 'disable_2fa');
        $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">Two-factor authentication disabled.</div>';
    }

    header("Location: " . $_SERVER['REQUEST_URI']);
    exit;
}

if (isset($_SESSION['flash_message'])) {
    $message = $_SESSION['flash_message'];
    unset($_SESSION['flash_message']);
}

$secret = TotpHelper::generateSecret();
$qrUrl = TotpHelper::getQrCodeUrl($user['username'], $secret);

$pageTitle = 'Two-Factor Authentication';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container py-4" style="max-width: 600px;">
    <?php if ($message): ?>
        <div class="mb-3"><?= $message ?></div>
    <?php endif; ?>

    <div class="card">
        <div class="card-header">
            <i class="bi bi-shield-lock text-muted"></i> Two-Factor Authentication (2FA)
        </div>
        <div class="card-body">
            <?php if (empty($user['totp_secret'])): ?>
                <p class="text-muted small">Scan the QR code with your authenticator app (such as Google Authenticator, Authy, or 1Password) to secure your account.</p>
                
                <div class="text-center my-4">
                    <div id="qr-skeleton" class="placeholder-glow mx-auto" style="width: 180px; height: 180px;">
                        <div class="placeholder w-100 h-100 rounded"></div>
                    </div>
                    <img src="<?= htmlspecialchars($qrUrl) ?>" alt="QR Code" id="qr-image" class="border rounded p-2 bg-white" style="display: none; width: 180px; height: 180px;" onload="document.getElementById('qr-skeleton').style.display='none'; this.style.display='inline-block';">
                </div>

                <div class="text-center mb-3">
                    <span class="text-muted small d-block">Manual Setup Key:</span>
                    <code class="font-mono text-warning user-select-all"><?= htmlspecialchars($secret) ?></code>
                </div>

                <form method="POST">
                    <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                    <input type="hidden" name="action" value="enable">
                    <input type="hidden" name="secret" value="<?= htmlspecialchars($secret) ?>">
                    
                    <div class="mb-3">
                        <label class="form-label">6-Digit Authenticator Code</label>
                        <input type="text" name="code" class="form-control font-mono text-center fs-5" placeholder="123456" required autocomplete="one-time-code" maxlength="6">
                    </div>
                    
                    <button type="submit" class="btn-clean btn-clean-primary w-100 py-2">
                        Verify and Activate 2FA
                    </button>
                </form>

            <?php else: ?>
                <div class="d-flex align-items-center gap-2 mb-3">
                    <span class="status-dot" style="background-color: var(--status-online); width: 10px; height: 10px;"></span>
                    <span class="fw-semibold">Two-Factor Authentication is currently ACTIVE on your account.</span>
                </div>
                <p class="text-muted small">Your account is protected. You will be prompted for an authentication code when signing in.</p>

                <form method="POST" onsubmit="return confirm('Are you sure you want to disable two-factor authentication?');">
                    <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                    <input type="hidden" name="action" value="disable">
                    <button type="submit" class="btn-clean btn-clean-danger w-100 py-2">
                        Turn Off 2FA
                    </button>
                </form>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/components/footer.php'; ?>
