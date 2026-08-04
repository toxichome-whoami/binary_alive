<?php die('Access denied'); ?>
{
  "security": {
    "allowed_ips": [],
    "max_login_attempts": 5,
    "block_duration_minutes": 15,
    "session_timeout_minutes": 15,
    "force_https": true,
    "secret_key": "generate_a_random_key_in_production"
  },
  "system": {
    "check_interval_seconds": 5,
    "log_retention_days": 30,
    "max_log_files": 10,
    "temp_directory": "logs"
  }
}
