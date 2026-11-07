<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin', 'auditor', 'operator']);

$pdo = $auth->getPdo();
$isAdmin = $auth->hasRole(['admin']);

$limit = 20;
$auditPage = isset($_GET['audit_page']) ? max(1, (int)$_GET['audit_page']) : 1;
$loginPage = isset($_GET['login_page']) ? max(1, (int)$_GET['login_page']) : 1;
$termPage = isset($_GET['term_page']) ? max(1, (int)$_GET['term_page']) : 1;
$activeTab = $_GET['tab'] ?? 'audit';

$auditOffset = ($auditPage - 1) * $limit;
$loginOffset = ($loginPage - 1) * $limit;
$termOffset = ($termPage - 1) * $limit;

$totalAudit = $pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action NOT IN ('terminal_command', 'login_success', 'logout')")->fetchColumn();
$totalLogin = $pdo->query("SELECT SUM(cnt) FROM (SELECT COUNT(*) as cnt FROM login_attempts UNION ALL SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'logout')")->fetchColumn();

$totalAuditPages = ceil($totalAudit / $limit);
$totalLoginPages = ceil($totalLogin / $limit);

$stmt = $pdo->prepare("
    SELECT a.*, COALESCE(a.username, u.username) as username
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.action NOT IN ('terminal_command', 'login_success', 'logout')
    ORDER BY a.timestamp DESC
    LIMIT ? OFFSET ?
");
$stmt->execute([$limit, $auditOffset]);
$auditLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt2 = $pdo->prepare("
    SELECT timestamp, username, ip_address,
           CASE WHEN is_successful = 1 THEN 'login_success' ELSE 'login_failed' END as event_type
    FROM login_attempts
    UNION ALL
    SELECT a.timestamp, COALESCE(a.username, u.username) as username, a.ip_address, a.action as event_type
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.action = 'logout'
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
");
$stmt2->execute([$limit, $loginOffset]);
$loginLogs = $stmt2->fetchAll(PDO::FETCH_ASSOC);

$termLogs = [];
$totalTerm = 0;
$totalTermPages = 0;
if ($isAdmin) {
    $totalTerm = $pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'terminal_command'")->fetchColumn();
    $totalTermPages = ceil($totalTerm / $limit);
    $stmt3 = $pdo->prepare("
        SELECT a.*, COALESCE(a.username, u.username) as username
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.action = 'terminal_command'
        ORDER BY a.timestamp DESC
        LIMIT ? OFFSET ?
    ");
    $stmt3->execute([$limit, $termOffset]);
    $termLogs = $stmt3->fetchAll(PDO::FETCH_ASSOC);
}

$pageTitle = 'Audit Logs';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container-fluid py-4 px-md-4">
    <!-- Tab Controls -->
    <div class="d-flex align-items-center gap-2 mb-3">
        <a href="?tab=audit" class="btn-clean <?= ($activeTab === 'audit') ? 'btn-clean-primary' : '' ?>">
            <i class="bi bi-shield-check"></i> System Audit Logs
        </a>
        <a href="?tab=login" class="btn-clean <?= ($activeTab === 'login') ? 'btn-clean-primary' : '' ?>">
            <i class="bi bi-box-arrow-in-right"></i> Access Logs
        </a>
        <?php if ($isAdmin): ?>
        <a href="?tab=terminal" class="btn-clean <?= ($activeTab === 'terminal') ? 'btn-clean-primary' : '' ?>">
            <i class="bi bi-terminal"></i> Terminal Logs
        </a>
        <?php endif; ?>
    </div>

    <!-- Active Tab Panel -->
    <?php if ($activeTab === 'audit'): ?>
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>System Operations & Changes</span>
                <span class="text-muted small">Total: <?= $totalAudit ?> events</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th style="width: 170px;">Timestamp</th>
                                <th>User</th>
                                <th>IP Address</th>
                                <th>Action</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($auditLogs)): ?>
                                <tr><td colspan="5" class="text-center py-4 text-muted">No audit logs recorded yet.</td></tr>
                            <?php else: ?>
                                <?php foreach ($auditLogs as $log): ?>
                                <tr>
                                    <td class="font-mono text-muted text-nowrap"><?= htmlspecialchars($log['timestamp']) ?></td>
                                    <td class="fw-semibold"><?= htmlspecialchars($log['username'] ?? 'System') ?></td>
                                    <td class="font-mono text-muted"><?= htmlspecialchars($log['ip_address']) ?></td>
                                    <td><span class="version-pill"><?= htmlspecialchars($log['action']) ?></span></td>
                                    <td class="text-dim"><?= htmlspecialchars($log['details']) ?></td>
                                </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-between align-items-center py-2 px-3 border-top">
                <?php if ($auditPage > 1): ?>
                    <a href="?tab=audit&audit_page=<?= $auditPage - 1 ?>" class="btn-clean btn-clean-sm">Previous</a>
                <?php else: ?>
                    <button class="btn-clean btn-clean-sm opacity-50" disabled>Previous</button>
                <?php endif; ?>

                <span class="text-muted small">Page <?= $auditPage ?> of <?= max(1, $totalAuditPages) ?></span>

                <?php if ($auditPage < $totalAuditPages): ?>
                    <a href="?tab=audit&audit_page=<?= $auditPage + 1 ?>" class="btn-clean btn-clean-sm">Next</a>
                <?php else: ?>
                    <button class="btn-clean btn-clean-sm opacity-50" disabled>Next</button>
                <?php endif; ?>
            </div>
        </div>

    <?php elseif ($activeTab === 'login'): ?>
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>Sign In & Sign Out Attempts</span>
                <span class="text-muted small">Total: <?= (int)$totalLogin ?> records</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th style="width: 170px;">Timestamp</th>
                                <th>Username</th>
                                <th>IP Address</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($loginLogs)): ?>
                                <tr><td colspan="4" class="text-center py-4 text-muted">No login attempts recorded yet.</td></tr>
                            <?php else: ?>
                                <?php foreach ($loginLogs as $log): ?>
                                <tr>
                                    <td class="font-mono text-muted text-nowrap"><?= htmlspecialchars($log['timestamp']) ?></td>
                                    <td class="fw-semibold"><?= htmlspecialchars($log['username'] ?? 'Unknown') ?></td>
                                    <td class="font-mono text-muted"><?= htmlspecialchars($log['ip_address']) ?></td>
                                    <td>
                                        <?php if ($log['event_type'] === 'login_success'): ?>
                                            <span class="status-pill online"><span class="status-dot"></span> Success</span>
                                        <?php elseif ($log['event_type'] === 'login_failed'): ?>
                                            <span class="status-pill stopped"><span class="status-dot"></span> Failed</span>
                                        <?php else: ?>
                                            <span class="version-pill"><?= htmlspecialchars($log['event_type']) ?></span>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-between align-items-center py-2 px-3 border-top">
                <?php if ($loginPage > 1): ?>
                    <a href="?tab=login&login_page=<?= $loginPage - 1 ?>" class="btn-clean btn-clean-sm">Previous</a>
                <?php else: ?>
                    <button class="btn-clean btn-clean-sm opacity-50" disabled>Previous</button>
                <?php endif; ?>

                <span class="text-muted small">Page <?= $loginPage ?> of <?= max(1, $totalLoginPages) ?></span>

                <?php if ($loginPage < $totalLoginPages): ?>
                    <a href="?tab=login&login_page=<?= $loginPage + 1 ?>" class="btn-clean btn-clean-sm">Next</a>
                <?php else: ?>
                    <button class="btn-clean btn-clean-sm opacity-50" disabled>Next</button>
                <?php endif; ?>
            </div>
        </div>

    <?php elseif ($isAdmin && $activeTab === 'terminal'): ?>
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>Executed Shell Commands</span>
                <span class="text-muted small">Total: <?= $totalTerm ?> commands</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th style="width: 170px;">Timestamp</th>
                                <th>Admin User</th>
                                <th>IP Address</th>
                                <th>Executed Command</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($termLogs)): ?>
                                <tr><td colspan="4" class="text-center py-4 text-muted">No terminal commands logged yet.</td></tr>
                            <?php else: ?>
                                <?php foreach ($termLogs as $log): ?>
                                <tr>
                                    <td class="font-mono text-muted text-nowrap"><?= htmlspecialchars($log['timestamp']) ?></td>
                                    <td class="fw-semibold"><?= htmlspecialchars($log['username'] ?? 'Unknown') ?></td>
                                    <td class="font-mono text-muted"><?= htmlspecialchars($log['ip_address']) ?></td>
                                    <td><code class="font-mono"><?= htmlspecialchars($log['details']) ?></code></td>
                                </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-between align-items-center py-2 px-3 border-top">
                <?php if ($termPage > 1): ?>
                    <a href="?tab=terminal&term_page=<?= $termPage - 1 ?>" class="btn-clean btn-clean-sm">Previous</a>
                <?php else: ?>
                    <button class="btn-clean btn-clean-sm opacity-50" disabled>Previous</button>
                <?php endif; ?>

                <span class="text-muted small">Page <?= $termPage ?> of <?= max(1, $totalTermPages) ?></span>

                <?php if ($termPage < $totalTermPages): ?>
                    <a href="?tab=terminal&term_page=<?= $termPage + 1 ?>" class="btn-clean btn-clean-sm">Next</a>
                <?php else: ?>
                    <button class="btn-clean btn-clean-sm opacity-50" disabled>Next</button>
                <?php endif; ?>
            </div>
        </div>
    <?php endif; ?>
</div>

<?php require_once __DIR__ . '/components/footer.php'; ?>
