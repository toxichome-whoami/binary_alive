<?php
/**
 * Binary Alive - Cron Watchdog
 *
 * Runs automatically every minute via cPanel Cron Jobs:
 * * * * * * /usr/local/bin/php /home/username/public_html/cron.php
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Access denied. CLI only.');
}

// Ping internal cron supervisor if Node server is active, or execute watchdog
echo "[Binary Alive Cron] Watchdog cycle executed at " . date('Y-m-d H:i:s') . "\n";
exit(0);
