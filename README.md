# Binary Alive (v1.0.5)

A high-performance, developer-first process management and supervision dashboard designed to keep Linux binaries (such as Discord bots, background daemons, or custom binaries) running continuously on cPanel, WHM, and Linux servers.

## Documentation Links
- **[API Documentation](API.md)**: Manage processes and bots remotely via HTTP API tokens.
- **[Changelog](CHANGELOG.md)**: View the latest feature, security, and performance improvements.

## Key Features
- **High-Craft Developer UI**: Minimalist, high-density interface inspired by modern tools (Linear, Railway, Vercel). Strictly **zero drop shadows**, crisp borders, dark and light theme switcher, and no visual clutter.
- **High-Performance Architecture**: Zero-subshell monitoring directly querying Linux kernel `/proc` and single-shot batch metrics via `ps -eo pid,%cpu,rss,etime`, eliminating 90%+ of shell forks.
- **Smart Resource Management**: Eliminates redundant SQLite writes when process status is unchanged; client polling automatically pauses when the browser tab is hidden (Page Visibility API).
- **Native & Real-Time Auto-Restart**:
  - **Live Web Supervisor**: Revives crashed or killed processes in less than 3 seconds while viewing the dashboard, without waiting for cron.
  - **Native Background Daemon (`daemon.php`)**: Standalone supervisor loop (`php daemon.php --start`) continuously monitors and revives binaries 24/7 without requiring system cron or Task Scheduler.
  - **System Cron Fallback (`cron.php`)**: Fully supported for traditional cPanel shared hosting cron schedules.
- **Web Terminal Console**: Built-in root command terminal (`terminal.php`) with persistent directory navigation, command history, and a 30-second execution safety timeout.
- **Enterprise Security**: Role-based access control (Admin, Operator, Viewer, Auditor), TOTP two-factor authentication, image CAPTCHA, AES-256-CBC token encryption, CSRF tokens on all POST/AJAX requests, and strict security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- **Self-Healing Database Discovery**: If configuration files are accidentally overwritten during updates, the system scans `db/` to reconnect to existing SQLite databases automatically.
- **Zero Dependencies**: Pure PHP 7.4+ and SQLite. No Node.js, PM2, or Composer required on the host server.

## Installation Instructions

1. **Upload Files**:
   Upload the repository files to any web directory or subdomain folder (e.g. `/home/username/watch.yourdomain.com`). Ensure hidden files (`.htaccess` files in root, `db/`, `includes/`, and `components/`) are included.

2. **Supervisor Configuration (Choose One)**:
   - **Option A (Native Daemon - No Cron Required)**:
     Start the native background daemon with a single command:
     ```bash
     php daemon.php --start
     ```
     To stop or check status: `php daemon.php --stop` or `php daemon.php --status`.
   - **Option B (System Cron Fallback)**:
     Configure a cron job in cPanel to run `cron.php` once every minute:
     - Schedule: `* * * * *` (every minute)
     - Command: `/usr/local/bin/php /home/your_username/your_domain/cron.php`
   - **Option C (Live In-Browser)**:
     Whenever the dashboard is open in any browser, the live web supervisor polls every 3 seconds and revives dead processes immediately.

3. **Open the Dashboard**:
   - Navigate to your domain in any browser.
   - On the first load, create your initial Master Administrator account.
   - Add your monitored processes (name, command, working directory, and log path).

## Automated Testing Suite
Binary Alive includes a built-in, zero-dependency automated test runner that verifies everything in under 6 seconds:
```bash
php tests/run.php
```

### What the Test Suite Verifies:
1. **PHP Syntax & Compilation**: Lints every file in the codebase with `php -l`.
2. **Database Engine & WAL Mode**: Validates table schemas, CRUD, transactions, and WAL journal mode in an isolated temporary database.
3. **Authentication & Cryptography**: Tests bcrypt passwords, CSRF validation, AES-256-CBC token encryption/decryption, TOTP RFC 4648 2FA math, and role hierarchy.
4. **Process Manager Engine**: Tests real background process launching, alive checks, PID detection, stopping processes, and resource metrics.
5. **Supervisor Auto-Restart**: Tests instant native auto-restart on crashed processes, manual stop protection, and `auto_restart = 0` toggles.
6. **Background Daemon (`daemon.php`)**: Validates CLI arguments, status inspection, and `.daemon.lock` concurrency protection.
7. **Cron Supervisor (`cron.php`)**: Validates CLI guards, silent execution, and `.cron.lock` non-blocking exclusivity.
8. **Web Terminal Engine**: Validates length restrictions, directory tracking, and execution timeouts.
9. **REST API Endpoints**: Tests status responses, CRUD payloads, process control commands, and unique constraint enforcement.

## Updating the System
When uploading updates:
- Simply upload and extract the files in cPanel.
- Your `config.php` and `db/*.sqlite` files are excluded from tracking and protected from being overwritten.
- The built-in self-healing system automatically rediscovers existing databases if the configuration is ever re-initialized.
