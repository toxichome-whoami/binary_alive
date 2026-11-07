<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/database.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin']);

$message = '';
$pdo = $auth->getPdo();
$stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'enable_captcha'");
$captchaSetting = $stmt->fetchColumn();
$captchaEnabled = ($captchaSetting === false) ? true : ($captchaSetting === '1');

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
        $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">Login captcha ' . ($newValue === '1' ? 'enabled' : 'disabled') . '.</div>';

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
                    $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Invalid configuration format. Import cancelled.</div>';
                    header("Location: " . $_SERVER['REQUEST_URI']);
                    exit;
                }
                saveAppConfig($parsed);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'import_data', "Type: config");
                $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">Configuration imported successfully.</div>';
            } elseif ($ext === 'sqlite') {
                try {
                    $testPdo = new PDO("sqlite:" . $tmpName);
                    $testPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    $testQuery = $testPdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
                    if (!$testQuery->fetch()) {
                        throw new Exception("Missing users table.");
                    }
                    $testPdo = null;
                } catch (Exception $e) {
                    $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Invalid SQLite database file. Import cancelled.</div>';
                    header("Location: " . $_SERVER['REQUEST_URI']);
                    exit;
                }
                $dbObj = new Database();
                $dbPath = $dbObj->getDbPath();
                try {
                    $currPdo = $dbObj->getPdo();
                    $currPdo->exec("PRAGMA wal_checkpoint(TRUNCATE);");
                } catch (Exception $e) {}
                $currPdo = null;
                $dbObj = null;
                $pdo = null;

                @unlink($dbPath . '-wal');
                @unlink($dbPath . '-shm');
                if (@move_uploaded_file($tmpName, $dbPath) || @copy($tmpName, $dbPath)) {
                    @chmod($dbPath, 0600);
                    $newAuth = new Auth();
                    $newAuth->getLogger()->logAudit($_SESSION['user_id'], 'import_data', "Type: database");
                    $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">Database imported successfully.</div>';
                } else {
                    $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Failed to write new database file. Check directory permissions.</div>';
                }
                header("Location: " . $_SERVER['REQUEST_URI']);
                exit;
            } else {
                $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Invalid file type. Only .json or .sqlite allowed.</div>';
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

$pageTitle = 'Settings';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container py-4" style="max-width: 800px;">
    <?php if ($message): ?>
        <div class="mb-3"><?= $message ?></div>
    <?php endif; ?>

    <!-- Security Settings Card -->
    <div class="card mb-4">
        <div class="card-header">
            <i class="bi bi-shield-check text-muted"></i> Security & Authentication
        </div>
        <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                    <div class="fw-semibold">Login Security Captcha</div>
                    <div class="text-muted small">Require an image verification code on the login screen to block automated bots.</div>
                </div>
                <form method="POST">
                    <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                    <input type="hidden" name="action" value="toggle_captcha">
                    <?php if ($captchaEnabled): ?>
                        <button type="submit" class="btn-clean btn-clean-sm btn-clean-primary">
                            <span class="status-dot" style="background-color: var(--status-online);"></span> Enabled (Click to disable)
                        </button>
                    <?php else: ?>
                        <button type="submit" class="btn-clean btn-clean-sm">
                            <span class="status-dot" style="background-color: var(--status-offline);"></span> Disabled (Click to enable)
                        </button>
                    <?php endif; ?>
                </form>
            </div>
        </div>
    </div>

    <!-- Export Card -->
    <div class="card mb-4">
        <div class="card-header">
            <i class="bi bi-download text-muted"></i> Backup & Export
        </div>
        <div class="card-body">
            <p class="text-muted small mb-3">Download a snapshot of your system settings or raw database.</p>
            <div class="d-flex flex-wrap gap-2">
                <form method="POST" class="d-inline">
                    <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                    <input type="hidden" name="action" value="export">
                    <input type="hidden" name="export_type" value="config">
                    <button type="submit" class="btn-clean btn-clean-sm">
                        <i class="bi bi-file-earmark-code"></i> Download Config (JSON)
                    </button>
                </form>
                <form method="POST" class="d-inline">
                    <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                    <input type="hidden" name="action" value="export">
                    <input type="hidden" name="export_type" value="database">
                    <button type="submit" class="btn-clean btn-clean-sm">
                        <i class="bi bi-database"></i> Download Database (.sqlite)
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Import Card -->
    <div class="card">
        <div class="card-header">
            <i class="bi bi-upload text-muted"></i> Restore Backup
        </div>
        <div class="card-body">
            <p class="text-muted small mb-3">Restore settings or database from a previously exported backup file.</p>
            <form method="POST" enctype="multipart/form-data">
                <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                <input type="hidden" name="action" value="import">
                <div class="mb-3">
                    <input class="form-control" type="file" name="backup_file" accept=".json,.sqlite" required>
                    <div class="form-text">Accepted formats: .json (configuration) or .sqlite (database)</div>
                </div>
                <button type="submit" class="btn-clean btn-clean-primary" onclick="return confirm('Restoring a backup will overwrite current data. Continue?');">
                    <i class="bi bi-arrow-counterclockwise"></i> Upload and Restore
                </button>
            </form>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/components/footer.php'; ?>
