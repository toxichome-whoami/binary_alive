# Changelog

## Version 1.0.5 — Modernization, Supervisor Engine & Testing Suite
- **Native & Real-Time Auto-Restart**:
  - Live Web Supervisor revives dead processes in `< 3 seconds` during dashboard polling without waiting for cron.
  - Native Background Daemon (`daemon.php`) continuously monitors and revives binaries 24/7 without crontab or Task Scheduler.
- **Automated Testing Suite (`tests/run.php`)**: Built-in 120-assertion zero-dependency testing engine validating syntax, database, auth/security, process supervisor, daemon, cron, terminal, and API endpoints.
- **High-Craft Developer UI**: Redesigned the entire interface inspired by modern developer platforms (Linear, Railway, Vercel). Enforced a strict zero drop-shadow rule across all components, cards, tables, modals, and buttons with crisp `1px solid var(--border)` styling.
- **Unified Navigation Bar**: Replaced rainbow-colored buttons with a cohesive developer navbar featuring subtle tab indicators, version pill (`v1.0.5`), user identity badge, and dark/light theme switcher.
- **Removed All Emojis & Simplified Vocabulary**: Standardized on clean SVG/Bootstrap glyphs and straightforward, easy-to-understand plain English terminology.
- **Metric Ribbon**: Replaced four garish primary-color cards with a clean, unified system metrics ribbon (Total, Running, Offline, System Load, Host Memory, Supervisor Engine).
- **Zero-Subshell Process Monitoring (`/proc`)**: Created `ProcessManager.php` which inspects Linux kernel `/proc` directly and uses `posix_kill($pid, 0)` to verify process liveness in microseconds without spawning bash/sh subshells. Cross-platform support with native PowerShell process management on Windows.
- **Single-Shot Batch Metrics**: Transformed individual per-process `ps` executions into a single batch `ps -eo pid,%cpu,rss,etime` call, reducing server subshell forks by over 90%.
- **Eliminated Redundant SQLite Disk Writes**: Polling no longer repeatedly writes unchanged PIDs or statuses to disk on every 3-second cycle, eliminating SQLite write-lock contention on cPanel shared hosting.
- **Visibility-Aware Polling**: Implemented Page Visibility API in `assets/js/app.js` to automatically pause status polling when the browser tab is hidden or minimized, conserving server CPU and network bandwidth.
- **Clean Asset Separation**: Moved all stylesheets into `assets/css/style.css` and JavaScript logic into `assets/js/app.js`, eliminating inline CSS and jQuery script bloat from templates.
- **Cron Concurrency Locking**: Added non-blocking execution lock (`.cron.lock`) and a 55-second timeout guard to `cron.php` to prevent overlapping runs.
- **Hardened HTTP Security Headers**: Added `Permissions-Policy: geolocation=(), microphone=(), camera=()`, tightened Content-Security-Policy, and aligned `X-Frame-Options: DENY` across headers and `.htaccess`.

## Version 1.0.4 — Security Hardening
- **CSRF on Export Operations**: Config and database backup download buttons are now POST forms protected with CSRF tokens. An attacker can no longer silently exfiltrate backups by tricking an authenticated admin into visiting a malicious link.
- **Config File Protection**: Converted `config.json` into `config.php` prefixed with `<?php die('Access denied'); ?>`. The config file can no longer be downloaded directly even if `.htaccess` is bypassed or disabled on non-Apache servers.
- **Randomized Database Filename**: On first run, the SQLite database is renamed to a random hex filename (e.g. `monitor_a9f3...sqlite`) and that name is stored in the protected config. The database URL is unknown to any outside party.
- **Strict File Permissions**: The `db/` directory is set to `0700` and the database file to `0600` automatically on every connection. A guard `index.php` is also created inside `db/` to return a `403` for any directory browsing attempts.
- **Auto-Generated Encryption Key**: If the default placeholder key is detected, the system immediately generates a cryptographically secure 64-character random key (`bin2hex(random_bytes(32))`) and saves it to the protected config. No manual step required.
- **Enforced HTTPS Redirect**: The server now automatically redirects all plain HTTP traffic to HTTPS on production servers without requiring `.htaccess` rewrite rules or manual config changes.
- **Unconditional Secure Session Cookie**: The session cookie `secure` flag is now always set to `true`, removing reliance on runtime detection. Session tokens can never be sent over plain HTTP.
- **Host Header Injection Fix**: The `domain` parameter is no longer set in `session_set_cookie_params()`. This prevents an attacker from manipulating the `Host` header to redirect session cookies to a different domain.
- **CSRF Token Rotation on Login**: A fresh CSRF token is generated immediately after every successful login, preventing token fixation attacks.
- **CLI-Only Cron Access**: `cron.php` now checks `php_sapi_name()` at startup and returns `403 Access Denied` if accessed via a web browser.
- **Deleted Utility Scripts**: `patch_theme.php` and `migrate_security.php` have been permanently removed from the web root to eliminate unintentional attack surface.
- **Data-Loss Prevention**: If `config.php` is not writable, the database initialisation no longer silently generates a new random filename on every request (which would effectively wipe the database from the app's perspective). It falls back to a fixed filename and logs a clear error instead.
- **saveAppConfig Failure Handling**: `saveAppConfig()` now returns `false` on a write failure. Any code that depends on a successful save (such as generating a new encryption key) detects the failure and stops with a clear error instead of continuing silently in a broken state.
- **Automatic Database Migration**: Security data migration (hashing API tokens to SHA-256, encrypting TOTP secrets with AES-256-CBC) now runs automatically on first load and is permanently locked by a `security_migration_done` flag in the database. No manual migration script needs to be executed.
- **htaccess Hardened**: Root `.htaccess` now includes an explicit `<Files "config.php">` block and rules denying access to all common backup file extensions (`.bak`, `.php~`, `.old`, `.swp`, etc.).
- **PHPDoc Type Annotations**: Added `@var`, `@param`, and `@return` docblocks to all class properties and functions in `database.php`, `auth.php`, `logger.php`, and `security.php` for full IDE type resolution and autocompletion.
- **Function Declaration Order**: `saveAppConfig()` is now declared before `getAppConfig()` in `security.php` so static analysis tools that require linear declaration order no longer report it as undefined.
- **Absolute Include Paths**: All `require_once` calls in `settings.php` now use `__DIR__` prefixed absolute paths so language servers can reliably resolve and index the included files.
- **Initialization Race Condition Fixed**: Implemented a `.db_init.lock` file mechanism in `database.php` to prevent the web process and cron process from generating separate randomized SQLite files simultaneously if they boot at the exact same millisecond.
- **Self-Healing Database Discovery**: If `config.php` is accidentally overwritten (e.g. during an update) and loses the randomized database filename, the system will now automatically scan the `db/` folder to discover the existing database and fix its configuration, rather than creating a new empty database.

## Version 1.0.3 Updates
- **Security Hardening**: Implemented comprehensive `.htaccess` rules across the root, `db/`, `includes/`, and `components/` directories. This completely blocks direct web access to sensitive files like `config.json`, SQLite databases, logs, and internal PHP partials.
- **Terminal Reliability**: Replaced all `shell_exec()` calls with a `safe_exec()` wrapper to prevent fatal crashes on restricted cPanel hosts where the function is disabled.
- **Smart Directory Resolution**: The terminal now falls back to parsing the server path to determine the user's home directory if standard shell commands are unavailable.
- **Navbar Toggle Fix**: Rebuilt the mobile hamburger menu toggle using custom JavaScript to prevent conflicts and double-firing caused by Bootstrap JS loading issues.
