<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';
require_once 'includes/totp_helper.php';

$auth = new Auth();
$auth->requireAuth();
$pdo = $auth->getPdo();

$userId = $_SESSION['user_id'];

// Get current user details
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
            $_SESSION['flash_message'] = '<div class="alert alert-success">Two-Factor Authentication enabled successfully!</div>';
        } else {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Invalid code. Please try again.</div>';
        }
    } elseif ($_POST['action'] === 'disable') {
        $stmt = $pdo->prepare("UPDATE users SET totp_secret = NULL WHERE id = ?");
        $stmt->execute([$userId]);
        $auth->getLogger()->logAudit($userId, 'disable_2fa');
        $_SESSION['flash_message'] = '<div class="alert alert-success">Two-Factor Authentication disabled.</div>';
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
?>
<?php
$pageTitle = 'Setup 2FA';
require_once 'components/header.php';
require_once 'components/navbar.php';
?>

<div class="container mt-4">
    <div class="row justify-content-center">
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">
                    <h4>Two-Factor Authentication (TOTP)</h4>
                </div>
                <div class="card-body">
                    <?= $message ?>

                    <?php if (empty($user['totp_secret'])): ?>
                        <p>Protect your account by enabling 2FA using Google Authenticator or Authy.</p>
                        <div class="text-center mb-3">
                            <div id="qr-skeleton" class="placeholder-glow mx-auto" style="width: 200px; height: 200px;">
                                <div class="placeholder w-100 h-100 img-thumbnail"></div>
                            </div>
                            <img src="<?= htmlspecialchars($qrUrl) ?>" alt="QR Code" id="qr-image" class="img-thumbnail" style="display: none; width: 200px; height: 200px;" onload="document.getElementById('qr-skeleton').style.display='none'; this.style.display='inline-block';">
                        </div>
                        <p class="text-center"><strong>Secret Key:</strong> <?= htmlspecialchars($secret) ?></p>
                        <form method="POST">
                            <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                            <input type="hidden" name="action" value="enable">
                            <input type="hidden" name="secret" value="<?= htmlspecialchars($secret) ?>">
                            <div class="mb-3">
                                <label>Enter 6-digit code to verify:</label>
                                <input type="text" name="code" class="form-control" required>
                            </div>
                            <button type="submit" class="btn btn-success w-100">Verify and Enable</button>
                        </form>
                    <?php else: ?>
                        <div class="alert alert-info">2FA is currently <strong>ENABLED</strong> on your account.</div>
                        <form method="POST" onsubmit="return confirm('Are you sure you want to disable 2FA?');">
                            <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                            <input type="hidden" name="action" value="disable">
                            <button type="submit" class="btn btn-danger w-100">Disable 2FA</button>
                        </form>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<?php require_once 'components/footer.php'; ?>
