<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';

$auth = new Auth();
$auth->requireAuth();

$message = '';
$pdo = $auth->getPdo();
$stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'enable_captcha'");
$captchaSetting = $stmt->fetchColumn();
$captchaEnabled = ($captchaSetting === false) ? true : ($captchaSetting === '1');

// Handle POST actions (Export, Import, Toggle)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    verifyCsrfToken();
    if ($_POST['action'] === 'export' && isset($_POST['export_type'])) {
        $type = $_POST['export_type'];
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'export_data', "Type: $type");

        if ($type === 'config') {
            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="config_backup.json"');
            echo json_encode(getAppConfig(), JSON_PRETTY_PRINT);
            exit;
        } elseif ($type === 'database') {
            $file = (new Database())->getDbPath();
            if (file_exists($file)) {
                header('Content-Type: application/x-sqlite3');
                header('Content-Disposition: attachment; filename="database_backup.sqlite"');
                readfile($file);
                exit;
            }
        }
    } elseif ($_POST['action'] === 'toggle_captcha') {
        $newValue = $captchaEnabled ? '0' : '1';
        $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('enable_captcha', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?");
        $stmt->execute([$newValue, $newValue]);

        $auth->getLogger()->logAudit($_SESSION['user_id'], 'toggle_captcha', "Captcha set to " . ($newValue === '1' ? 'enabled' : 'disabled'));
        $_SESSION['flash_message'] = '<div class="alert alert-success">Login CAPTCHA ' . ($newValue === '1' ? 'enabled' : 'disabled') . '.</div>';

        header("Location: " . $_SERVER['REQUEST_URI']);
        exit;
    } elseif ($_POST['action'] === 'import') {
    if (isset($_FILES['backup_file']) && $_FILES['backup_file']['error'] === UPLOAD_ERR_OK) {
        $tmpName = $_FILES['backup_file']['tmp_name'];
        $fileName = $_FILES['backup_file']['name'];
        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if ($ext === 'json') {
            $content = file_get_contents($tmpName);
            $parsed = json_decode($content, true);
            if (!is_array($parsed) || (!isset($parsed['security']) && !isset($parsed['system']))) {
                $_SESSION['flash_message'] = '<div class="alert alert-danger">Invalid JSON configuration format. Import aborted.</div>';
                header("Location: " . $_SERVER['REQUEST_URI']);
                exit;
            }
            saveAppConfig($parsed);
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'import_data', "Type: config");
            $_SESSION['flash_message'] = '<div class="alert alert-success">Configuration imported successfully.</div>';
        } elseif ($ext === 'sqlite') {
            try {
                $testPdo = new PDO("sqlite:" . $tmpName);
                $testPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $testQuery = $testPdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
                if (!$testQuery->fetch()) {
                    throw new Exception("Missing 'users' table in database.");
                }
                $testPdo = null;
            } catch (Exception $e) {
                $_SESSION['flash_message'] = '<div class="alert alert-danger">Invalid or corrupt SQLite database file. Import aborted.</div>';
                header("Location: " . $_SERVER['REQUEST_URI']);
                exit;
            }
            $dbPath = (new Database())->getDbPath();
            move_uploaded_file($tmpName, $dbPath);
            @chmod($dbPath, 0600);
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
<?php
$pageTitle = 'Settings';
require_once 'components/header.php';
require_once 'components/navbar.php';
?>

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
                            <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
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
                    <form method="POST" class="d-inline-block me-1 mb-2">
                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                        <input type="hidden" name="action" value="export">
                        <input type="hidden" name="export_type" value="config">
                        <button type="submit" class="btn btn-outline-primary"><i class="bi bi-download"></i> Download config backup (JSON)</button>
                    </form>
                    <form method="POST" class="d-inline-block mb-2">
                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                        <input type="hidden" name="action" value="export">
                        <input type="hidden" name="export_type" value="database">
                        <button type="submit" class="btn btn-outline-primary"><i class="bi bi-download"></i> Download database.sqlite</button>
                    </form>

                    <h5 class="mt-4 border-bottom pb-2">Import Data</h5>
                    <p>Restore your configuration or database from a previous backup.</p>
                    <form method="POST" enctype="multipart/form-data">
                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
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

<?php require_once 'components/footer.php'; ?>
