<?php
$currentRole = $_SESSION['role'] ?? 'viewer';
$username = $_SESSION['username'] ?? 'User';
?>
<nav class="navbar navbar-expand-lg shadow-sm">
    <div class="container-fluid">
        <a class="navbar-brand" href="index.php"><i class="bi bi-shield-lock"></i> Binary Alive v1.0.1</a>
        <div class="d-flex align-items-center">
            <span class="navbar-text text-white me-3 d-none d-md-inline">User: <?= htmlspecialchars($username) ?> (<?= ucfirst(htmlspecialchars($currentRole)) ?>)</span>
            <a href="index.php" class="btn btn-outline-light btn-sm me-2"><i class="bi bi-speedometer2"></i> Dashboard</a>
            <?php if (in_array($currentRole, ['admin'])): ?>
                <a href="users.php" class="btn btn-outline-success btn-sm me-2"><i class="bi bi-people"></i> Users</a>
                <a href="logs.php" class="btn btn-outline-light btn-sm me-2"><i class="bi bi-journal-text"></i> Logs</a>
                <a href="settings.php" class="btn btn-outline-warning btn-sm me-2"><i class="bi bi-gear"></i> Settings</a>
                <a href="terminal.php" class="btn btn-outline-danger btn-sm me-2"><i class="bi bi-terminal"></i> Terminal</a>
            <?php elseif (in_array($currentRole, ['auditor', 'operator'])): ?>
                <a href="logs.php" class="btn btn-outline-light btn-sm me-2"><i class="bi bi-journal-text"></i> Logs</a>
            <?php endif; ?>
            <a href="setup_2fa.php" class="btn btn-outline-info btn-sm me-2"><i class="bi bi-shield-check"></i> 2FA</a>
            <button id="theme-toggle" class="btn btn-outline-light btn-sm me-2" title="Toggle Theme"><i class="bi bi-moon-stars"></i></button>
            <a href="logout.php" class="btn btn-outline-light btn-sm">Logout</a>
        </div>
    </div>
</nav>
