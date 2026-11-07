<?php
/**
 * includes/monitor.php
 * Compatibility layer bridging Monitor calls to the high-performance ProcessManager.
 */

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

require_once __DIR__ . '/ProcessManager.php';

class Monitor extends ProcessManager {
    // Inherits all high-performance process management methods from ProcessManager
}
