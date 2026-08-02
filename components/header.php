<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($pageTitle) ? htmlspecialchars($pageTitle) . ' - Binary Alive' : 'Binary Alive' ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <style>
        body { margin: 0 !important; padding: 0 !important; }
        [data-bs-theme="light"] body { background-color: #f8f9fa; }
        [data-bs-theme="dark"] body { background-color: #121416; }
        [data-bs-theme="dark"] .card { background-color: #1e2226; border-color: #2b3035; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        [data-bs-theme="dark"] .group-header { background-color: #2b3035 !important; color: #f8f9fa; }
        [data-bs-theme="light"] .group-header { background-color: #e9ecef !important; color: #212529; }
        [data-bs-theme="dark"] .table { --bs-table-bg: #1e2226; --bs-table-color: #dee2e6; --bs-table-hover-bg: #2b3035; border-color: #373b3e; }
        .navbar { margin-top: 0 !important; border-radius: 0 !important; }
        [data-bs-theme="dark"] .navbar { background-color: #1e2226 !important; border-bottom: 1px solid #2b3035; }
        [data-bs-theme="light"] .navbar { background-color: #2c3e50 !important; }
        .navbar-brand, .nav-link { color: white !important; }
        .status-running { color: #20c997; }
        .status-stopped { color: #ff6b6b; }
        .group-header { font-weight: bold; }
    </style>
    <script>
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-bs-theme', theme);
    </script>
</head>
<body>
