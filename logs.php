<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin', 'auditor']); // Only admins and auditors can view logs

$pdo = $auth->getPdo();

$limit = 20;
$auditPage = isset($_GET['audit_page']) ? max(1, (int)$_GET['audit_page']) : 1;
$loginPage = isset($_GET['login_page']) ? max(1, (int)$_GET['login_page']) : 1;
$activeTab = $_GET['tab'] ?? 'audit';

$auditOffset = ($auditPage - 1) * $limit;
$loginOffset = ($loginPage - 1) * $limit;

$totalAudit = $pdo->query("SELECT COUNT(*) FROM audit_logs")->fetchColumn();
$totalLogin = $pdo->query("SELECT COUNT(*) FROM login_attempts")->fetchColumn();

$totalAuditPages = ceil($totalAudit / $limit);
$totalLoginPages = ceil($totalLogin / $limit);

$stmt = $pdo->prepare("
    SELECT a.*, u.username 
    FROM audit_logs a 
    LEFT JOIN users u ON a.user_id = u.id 
    ORDER BY a.timestamp DESC 
    LIMIT ? OFFSET ?
");
$stmt->execute([$limit, $auditOffset]);
$auditLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt2 = $pdo->prepare("SELECT * FROM login_attempts ORDER BY timestamp DESC LIMIT ? OFFSET ?");
$stmt2->execute([$limit, $loginOffset]);
$loginLogs = $stmt2->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Audit Logs - Binary Alive</title>
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
    <ul class="nav nav-tabs mb-4" id="logTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link <?= $activeTab === 'audit' ? 'active' : '' ?>" id="audit-tab" data-bs-toggle="tab" data-bs-target="#audit" type="button" role="tab">System Audit Logs</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link <?= $activeTab === 'login' ? 'active' : '' ?>" id="login-tab" data-bs-toggle="tab" data-bs-target="#login" type="button" role="tab">Login Attempts</button>
        </li>
    </ul>
    
    <div class="tab-content" id="logTabsContent">
        <div class="tab-pane fade <?= $activeTab === 'audit' ? 'show active' : '' ?>" id="audit" role="tabpanel">
            <div class="card">
                <div class="card-body p-0">
                    <table class="table table-striped mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th>IP Address</th>
                                <th>Action</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($auditLogs as $log): ?>
                            <tr>
                                <td><?= $log['timestamp'] ?></td>
                                <td><?= htmlspecialchars($log['username'] ?? 'System') ?></td>
                                <td><?= htmlspecialchars($log['ip_address']) ?></td>
                                <td><span class="badge bg-primary"><?= htmlspecialchars($log['action']) ?></span></td>
                                <td><?= htmlspecialchars($log['details']) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
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
                    <table class="table table-striped mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th>Timestamp</th>
                                <th>Username Attempted</th>
                                <th>IP Address</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($loginLogs as $log): ?>
                            <tr>
                                <td><?= $log['timestamp'] ?></td>
                                <td><?= htmlspecialchars($log['username']) ?></td>
                                <td><?= htmlspecialchars($log['ip_address']) ?></td>
                                <td>
                                    <?php if ($log['is_successful']): ?>
                                        <span class="badge bg-success">Success</span>
                                    <?php else: ?>
                                        <span class="badge bg-danger">Failed</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <?php if ($loginPage > 1): ?>
                        <a href="?tab=login&audit_page=<?= $auditPage ?>&login_page=<?= $loginPage - 1 ?>" class="btn btn-outline-primary btn-sm">Previous</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Previous</button>
                    <?php endif; ?>
                    
                    <span class="text-muted small">Page <?= $loginPage ?> of <?= max(1, $totalLoginPages) ?> (Total: <?= $totalLogin ?>)</span>
                    
                    <?php if ($loginPage < $totalLoginPages): ?>
                        <a href="?tab=login&audit_page=<?= $auditPage ?>&login_page=<?= $loginPage + 1 ?>" class="btn btn-outline-primary btn-sm">Next</a>
                    <?php else: ?>
                        <button class="btn btn-outline-secondary btn-sm" disabled>Next</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

