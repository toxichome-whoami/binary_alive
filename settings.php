<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';

$auth = new Auth();
$auth->requireAuth();

$message = '';
$configFile = __DIR__ . '/config.json';
$config = json_decode(file_get_contents($configFile), true) ?: [];
$captchaEnabled = $config['security']['enable_captcha'] ?? true;

// Handle Export
if (isset($_GET['export'])) {
    $type = $_GET['export'];
    $auth->getLogger()->logAudit($_SESSION['user_id'], 'export_data', "Type: $type");
    
    if ($type === 'config') {
        $file = __DIR__ . '/config.json';
        if (file_exists($file)) {
            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="config_backup.json"');
            readfile($file);
            exit;
        }
    } elseif ($type === 'database') {
        $file = __DIR__ . '/db/monitor.sqlite';
        if (file_exists($file)) {
            header('Content-Type: application/x-sqlite3');
            header('Content-Disposition: attachment; filename="database_backup.sqlite"');
            readfile($file);
            exit;
        }
    }
}

// Handle Import / Toggle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'toggle_captcha') {
        $config['security']['enable_captcha'] = !$captchaEnabled;
        file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'toggle_captcha', "Captcha set to " . ($config['security']['enable_captcha'] ? 'enabled' : 'disabled'));
        $_SESSION['flash_message'] = '<div class="alert alert-success">Login CAPTCHA ' . ($config['security']['enable_captcha'] ? 'enabled' : 'disabled') . '.</div>';
        header("Location: " . $_SERVER['REQUEST_URI']);
        exit;
    } elseif ($_POST['action'] === 'import') {
    if (isset($_FILES['backup_file']) && $_FILES['backup_file']['error'] === UPLOAD_ERR_OK) {
        $tmpName = $_FILES['backup_file']['tmp_name'];
        $fileName = $_FILES['backup_file']['name'];
        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        if ($ext === 'json') {
            move_uploaded_file($tmpName, __DIR__ . '/config.json');
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'import_data', "Type: config");
            $_SESSION['flash_message'] = '<div class="alert alert-success">Configuration imported successfully.</div>';
        } elseif ($ext === 'sqlite') {
            move_uploaded_file($tmpName, __DIR__ . '/db/monitor.sqlite');
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'import_data', "Type: database");
            $_SESSION['flash_message'] = '<div class="alert alert-success">Database imported successfully.</div>';
        } else {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Invalid file type. Only .json or .sqlite allowed.</div>';
        }
    }
    header("Location: " . $_SERVER['REQUEST_URI']);
    exit;
    }
}

if (isset($_SESSION['flash_message'])) {
    $message = $_SESSION['flash_message'];
    unset($_SESSION['flash_message']);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - Binary Alive</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">

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
    <div class="row">
        <div class="col-md-6 offset-md-3">
            <div class="card">
                <div class="card-header">
                    <h4><i class="bi bi-gear"></i> System Settings</h4>
                </div>
                <div class="card-body">
                    <?= $message ?>
                    
                    <h5 class="mt-3 border-bottom pb-2">Security Settings</h5>
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <strong>Login CAPTCHA</strong>
                            <p class="text-muted small mb-0">Require users to solve an image CAPTCHA when logging in to prevent bot brute-force attacks.</p>
                        </div>
                        <form method="POST">
                            <input type="hidden" name="action" value="toggle_captcha">
                            <?php if ($captchaEnabled): ?>
                                <button type="submit" class="btn btn-success">Enabled (Click to Disable)</button>
                            <?php else: ?>
                                <button type="submit" class="btn btn-secondary">Disabled (Click to Enable)</button>
                            <?php endif; ?>
                        </form>
                    </div>
                    
                    <h5 class="mt-4 border-bottom pb-2">Export Data</h5>
                    <p>Download a backup of your configuration or entire database.</p>
                    <a href="?export=config" class="btn btn-outline-primary mb-2"><i class="bi bi-download"></i> Download config.json</a>
                    <a href="?export=database" class="btn btn-outline-primary mb-2"><i class="bi bi-download"></i> Download database.sqlite</a>
                    
                    <h5 class="mt-4 border-bottom pb-2">Import Data</h5>
                    <p>Restore your configuration or database from a previous backup.</p>
                    <form method="POST" enctype="multipart/form-data">
                        <input type="hidden" name="action" value="import">
                        <div class="mb-3">
                            <input class="form-control" type="file" name="backup_file" accept=".json,.sqlite" required>
                        </div>
                        <button type="submit" class="btn btn-warning"><i class="bi bi-upload"></i> Restore Backup</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

</body>
</html>

