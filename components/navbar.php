<?php
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}
$currentRole = $_SESSION['role'] ?? 'viewer';
$username = $_SESSION['username'] ?? 'User';
$currentPage = basename($_SERVER['PHP_SELF'] ?? '');
?>
<nav class="app-navbar">
    <div class="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-3">
        <!-- Brand & Version -->
        <div class="d-flex align-items-center gap-2">
            <a class="navbar-brand m-0" href="index.php">
                <i class="bi bi-shield-check text-success"></i> Binary Alive
            </a>
            <span class="version-pill">v1.0.5</span>
        </div>

        <!-- Navigation Tabs -->
        <div class="nav-tabs-custom flex-wrap">
            <a href="index.php" class="nav-link-custom <?= ($currentPage === 'index.php') ? 'active' : '' ?>">
                <i class="bi bi-cpu"></i> Dashboard
            </a>
            
            <?php if (in_array($currentRole, ['admin'])): ?>
                <a href="users.php" class="nav-link-custom <?= ($currentPage === 'users.php') ? 'active' : '' ?>">
                    <i class="bi bi-people"></i> Users
                </a>
                <a href="logs.php" class="nav-link-custom <?= ($currentPage === 'logs.php') ? 'active' : '' ?>">
                    <i class="bi bi-file-text"></i> Logs
                </a>
                <a href="settings.php" class="nav-link-custom <?= ($currentPage === 'settings.php') ? 'active' : '' ?>">
                    <i class="bi bi-sliders"></i> Settings
                </a>
                <a href="terminal.php" class="nav-link-custom <?= ($currentPage === 'terminal.php') ? 'active' : '' ?>">
                    <i class="bi bi-terminal"></i> Terminal
                </a>
            <?php elseif (in_array($currentRole, ['auditor', 'operator'])): ?>
                <a href="logs.php" class="nav-link-custom <?= ($currentPage === 'logs.php') ? 'active' : '' ?>">
                    <i class="bi bi-file-text"></i> Logs
                </a>
            <?php endif; ?>

            <a href="setup_2fa.php" class="nav-link-custom <?= ($currentPage === 'setup_2fa.php') ? 'active' : '' ?>">
                <i class="bi bi-key"></i> 2FA
            </a>
        </div>

        <!-- Right Side: User & Controls -->
        <div class="d-flex align-items-center gap-2 ms-auto">
            <div class="user-badge d-none d-md-inline-flex">
                <i class="bi bi-person"></i>
                <span><?= htmlspecialchars($username) ?></span>
                <span class="text-dim">(<?= ucfirst(htmlspecialchars($currentRole)) ?>)</span>
            </div>

            <button id="theme-toggle" class="btn-clean btn-clean-sm" title="Toggle Theme" type="button">
                <i class="bi bi-sun"></i>
            </button>

            <a href="logout.php" class="btn-clean btn-clean-sm" title="Sign out">
                <i class="bi bi-box-arrow-right"></i> Logout
            </a>
        </div>
    </div>
</nav>
