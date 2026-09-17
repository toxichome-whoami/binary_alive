<?php
/**
 * Binary Alive - cPanel Cron Trigger
 *
 * This script is called every minute via cPanel standard cron:
 * * * * * * /usr/local/bin/php /home/username/apps/binary-alive/cron.php
 *
 * It pings the Node.js server's internal cron endpoint securely.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Access denied. This script must be run from the command line.');
}

// Load env or config if needed
$envFile = __DIR__ . '/.env';
$cronSecret = 'change-me-to-a-secure-random-token';
$port = 3000;

if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, '#') === 0) continue;
        if (strpos($line, 'CRON_SECRET=') === 0) {
            $cronSecret = trim(substr($line, strlen('CRON_SECRET=')));
        }
        if (strpos($line, 'PORT=') === 0) {
            $port = (int)trim(substr($line, strlen('PORT=')));
        }
    }
}

$url = "http://127.0.0.1:{$port}/api/internal/cron";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 55, // 5s under the 60s cron interval
    CURLOPT_HTTPHEADER     => [
        "X-Cron-Secret: {$cronSecret}",
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS     => json_encode(['timestamp' => time()])
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($httpCode !== 200) {
    fwrite(STDERR, "[Binary Alive Cron] FAILED (HTTP {$httpCode}): " . ($error ?: $response) . "\n");
    exit(1);
}

echo "[Binary Alive Cron] Successfully executed: {$response}\n";
exit(0);
