<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin', 'auditor', 'operator']); // Admins, auditors, and operators can view logs

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
?>
<?php
$pageTitle = 'Audit Logs';
require_once 'components/header.php';
require_once 'components/navbar.php';
?>

<div class="container mt-4">
    <ul class="nav nav-tabs mb-4" id="logTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link <?= $activeTab === 'audit' ? 'active' : '' ?>" id="audit-tab" data-bs-toggle="tab" data-bs-target="#audit" type="button" role="tab">System Audit Logs</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link <?= $activeTab === 'login' ? 'active' : '' ?>" id="login-tab" data-bs-toggle="tab" data-bs-target="#login" type="button" role="tab">Access Logs</button>
        </li>
        <?php if ($isAdmin): ?>
        <li class="nav-item" role="presentation">
            <button class="nav-link <?= $activeTab === 'terminal' ? 'active' : '' ?>" id="terminal-tab" data-bs-toggle="tab" data-bs-target="#terminal" type="button" role="tab">Terminal Logs</button>
        </li>
        <?php endif; ?>
    </ul>

    <div class="tab-content" id="logTabsContent">
        <div class="tab-pane fade <?= $activeTab === 'audit' ? 'show active' : '' ?>" id="audit" role="tabpanel">
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th class="text-nowrap">Timestamp</th>
                                <th>User</th>
                                <th>IP Address</th>
                                <th>Action</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($auditLogs as $log): ?>
                            <tr>
                                <td class="text-nowrap"><?= $log['timestamp'] ?></td>
                                <td><?= htmlspecialchars($log['username'] ?? 'System') ?></td>
                                <td><?= htmlspecialchars($log['ip_address']) ?></td>
                                <td><span class="badge bg-primary"><?= htmlspecialchars($log['action']) ?></span></td>
                                <td><?= htmlspecialchars($log['details']) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <?php if ($auditPage > 1): ?>
                        <a href="?tab=audit&audit_page=<?= $auditPage - 1 ?>&login_page=<?= $loginPage ?>" class="btn btn-outline-primary btn-sm">Previous</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Previous</button>
                    <?php endif; ?>

                    <span class="text-muted small">Page <?= $auditPage ?> of <?= max(1, $totalAuditPages) ?> (Total: <?= $totalAudit ?>)</span>

                    <?php if ($auditPage < $totalAuditPages): ?>
                        <a href="?tab=audit&audit_page=<?= $auditPage + 1 ?>&login_page=<?= $loginPage ?>" class="btn btn-outline-primary btn-sm">Next</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Next</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div class="tab-pane fade <?= $activeTab === 'login' ? 'show active' : '' ?>" id="login" role="tabpanel">
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th class="text-nowrap">Timestamp</th>
                                <th>Username Attempted</th>
                                <th>IP Address</th>
                                <th>Event Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($loginLogs as $log): ?>
                            <tr>
                                <td class="text-nowrap"><?= $log['timestamp'] ?></td>
                                <td><?= htmlspecialchars($log['username'] ?? 'Unknown') ?></td>
                                <td><?= htmlspecialchars($log['ip_address']) ?></td>
                                <td>
                                    <?php if ($log['event_type'] === 'login_success'): ?>
                                        <span class="badge bg-success">Login Success</span>
                                    <?php elseif ($log['event_type'] === 'login_failed'): ?>
                                        <span class="badge bg-danger">Login Failed</span>
                                    <?php elseif ($log['event_type'] === 'logout'): ?>
                                        <span class="badge bg-secondary">Logout</span>
                                    <?php else: ?>
                                        <span class="badge bg-info"><?= htmlspecialchars($log['event_type']) ?></span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <?php if ($loginPage > 1): ?>
                        <a href="?tab=login&audit_page=<?= $auditPage ?>&login_page=<?= $loginPage - 1 ?>&term_page=<?= $termPage ?>" class="btn btn-outline-primary btn-sm">Previous</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Previous</button>
                    <?php endif; ?>

                    <span class="text-muted small">Page <?= $loginPage ?> of <?= max(1, $totalLoginPages) ?> (Total: <?= $totalLogin ?>)</span>

                    <?php if ($loginPage < $totalLoginPages): ?>
                        <a href="?tab=login&audit_page=<?= $auditPage ?>&login_page=<?= $loginPage + 1 ?>&term_page=<?= $termPage ?>" class="btn btn-outline-primary btn-sm">Next</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Next</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <?php if ($isAdmin): ?>
        <div class="tab-pane fade <?= $activeTab === 'terminal' ? 'show active' : '' ?>" id="terminal" role="tabpanel">
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th class="text-nowrap">Timestamp</th>
                                <th>Admin User</th>
                                <th>IP Address</th>
                                <th>Executed Command</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($termLogs as $log): ?>
                            <tr>
                                <td class="text-nowrap"><?= $log['timestamp'] ?></td>
                                <td><?= htmlspecialchars($log['username'] ?? 'Unknown') ?></td>
                                <td><?= htmlspecialchars($log['ip_address']) ?></td>
                                <td><code><?= htmlspecialchars($log['details']) ?></code></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <?php if ($termPage > 1): ?>
                        <a href="?tab=terminal&audit_page=<?= $auditPage ?>&login_page=<?= $loginPage ?>&term_page=<?= $termPage - 1 ?>" class="btn btn-outline-primary btn-sm">Previous</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Previous</button>
                    <?php endif; ?>

                    <span class="text-muted small">Page <?= $termPage ?> of <?= max(1, $totalTermPages) ?> (Total: <?= $totalTerm ?>)</span>

                    <?php if ($termPage < $totalTermPages): ?>
                        <a href="?tab=terminal&audit_page=<?= $auditPage ?>&login_page=<?= $loginPage ?>&term_page=<?= $termPage + 1 ?>" class="btn btn-outline-primary btn-sm">Next</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Next</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php endif; ?>
    </div>
</div>

<?php require_once 'components/footer.php'; ?>
