<?php
$currentRole = $_SESSION['role'] ?? 'viewer';
$username = $_SESSION['username'] ?? 'User';
?>
<nav class="navbar navbar-expand-xl shadow-sm navbar-dark" data-bs-theme="dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="index.php"><i class="bi bi-shield-lock"></i> Binary Alive v1.0.2</a>
        <button class="navbar-toggler border-white" type="button" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mainNavbar">
            <div class="d-flex flex-column flex-xl-row align-items-stretch align-items-xl-center gap-2 mt-3 mt-xl-0 ms-auto">
                <span class="navbar-text text-white me-3 d-none d-xl-inline">User: <?= htmlspecialchars($username) ?> (<?= ucfirst(htmlspecialchars($currentRole)) ?>)</span>
                <a href="index.php" class="btn btn-outline-light btn-sm"><i class="bi bi-speedometer2"></i> Dashboard</a>
                <?php if (in_array($currentRole, ['admin'])): ?>
                    <a href="users.php" class="btn btn-outline-success btn-sm"><i class="bi bi-people"></i> Users</a>
                    <a href="logs.php" class="btn btn-outline-light btn-sm"><i class="bi bi-journal-text"></i> Logs</a>
                    <a href="settings.php" class="btn btn-outline-warning btn-sm"><i class="bi bi-gear"></i> Settings</a>
                    <a href="terminal.php" class="btn btn-outline-danger btn-sm"><i class="bi bi-terminal"></i> Terminal</a>
                <?php elseif (in_array($currentRole, ['auditor', 'operator'])): ?>
                    <a href="logs.php" class="btn btn-outline-light btn-sm"><i class="bi bi-journal-text"></i> Logs</a>
                <?php endif; ?>
                <a href="setup_2fa.php" class="btn btn-outline-info btn-sm"><i class="bi bi-shield-check"></i> 2FA</a>
                <button id="theme-toggle" class="btn btn-outline-light btn-sm" title="Toggle Theme"><i class="bi bi-moon-stars"></i> <span class="d-xl-none">Toggle Theme</span></button>
                <a href="logout.php" class="btn btn-outline-light btn-sm">Logout</a>
            </div>
        </div>
    </div>
</nav>
