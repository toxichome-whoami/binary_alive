<?php die('Access denied'); ?>
{
    "security": {
        "allowed_ips": [],
        "max_login_attempts": 5,
        "block_duration_minutes": 15,
        "session_timeout_minutes": 15,
        "force_https": true,
        "secret_key": "79192f5299c6ad613207f7f62161f2bf251321b1bbdfa4938d6a250dc9977c18"
    },
    "system": {
        "check_interval_seconds": 5,
        "log_retention_days": 30,
        "max_log_files": 10,
        "temp_directory": "logs",
        "db_filename": "monitor_15b135bf95b2b2b3add6940b959fa66c.sqlite"
    }
}