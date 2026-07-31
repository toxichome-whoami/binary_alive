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
    if ($_POST['action'] === 'enable') {
        $secret = $_POST['secret'];
        $code = $_POST['code'];
        
        if (TotpHelper::verifyCode($secret, $code)) {
            $stmt = $pdo->prepare("UPDATE users SET totp_secret = ? WHERE id = ?");
            $stmt->execute([$secret, $userId]);
            $auth->getLogger()->logAudit($userId, 'enable_2fa');
            $user['totp_secret'] = $secret;
            $message = '<div class="alert alert-success">Two-Factor Authentication enabled successfully!</div>';
        } else {
            $message = '<div class="alert alert-danger">Invalid code. Please try again.</div>';
        }
    } elseif ($_POST['action'] === 'disable') {
        $stmt = $pdo->prepare("UPDATE users SET totp_secret = NULL WHERE id = ?");
        $stmt->execute([$userId]);
        $auth->getLogger()->logAudit($userId, 'disable_2fa');
        $user['totp_secret'] = null;
        $message = '<div class="alert alert-success">Two-Factor Authentication disabled.</div>';
    }
}

$secret = TotpHelper::generateSecret();
$qrUrl = TotpHelper::getQrCodeUrl($user['username'], $secret);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup 2FA - Binary Alive</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <style>body { margin: 0 !important; padding: 0 !important; } .navbar { margin-top: 0 !important; border-radius: 0 !important; }</style>
</head>
<body class="bg-light">

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="index.php">Binary Alive</a>
        <div class="d-flex">
            <a href="index.php" class="btn btn-outline-light btn-sm me-2">Back to Dashboard</a>
        </div>
    </div>
</nav>

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
                            <img src="<?= htmlspecialchars($qrUrl) ?>" alt="QR Code" class="img-thumbnail">
                        </div>
                        <p class="text-center"><strong>Secret Key:</strong> <?= htmlspecialchars($secret) ?></p>
                        <form method="POST">
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
                            <input type="hidden" name="action" value="disable">
                            <button type="submit" class="btn btn-danger w-100">Disable 2FA</button>
                        </form>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

</body>
</html>

