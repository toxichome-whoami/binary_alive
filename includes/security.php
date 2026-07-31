<?php
// includes/security.php

// Force strict security headers
header("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
header("Content-Security-Policy: default-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://code.jquery.com; img-src 'self' data: https://chart.googleapis.com https://api.qrserver.com; frame-ancestors 'none';");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Prevent information leakage
header_remove("X-Powered-By");

// Basic IP Whitelist Check (callable early in the lifecycle)
function enforceIpWhitelist($allowedIps = []) {
    if (empty($allowedIps)) return;
    
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    
    // Simple direct match for now (no CIDR block parsing to keep it lightweight)
    if (!in_array($clientIp, $allowedIps)) {
        header("HTTP/1.1 403 Forbidden");
        die("403 Forbidden - IP not allowed.");
    }
}
