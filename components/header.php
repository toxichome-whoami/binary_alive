<?php
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= function_exists('generateCsrfToken') ? generateCsrfToken() : '' ?>">
    <title><?= isset($pageTitle) ? htmlspecialchars($pageTitle) . ' - Binary Alive' : 'Binary Alive' ?></title>
    
    <!-- Core UI & Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    
    <!-- Clean Minimalist Dev UI (Zero Drop Shadows) -->
    <link rel="stylesheet" href="assets/css/style.css">
    
    <script>
        // Synchronous theme application to prevent light/dark flash
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
    </script>
</head>
<body>
