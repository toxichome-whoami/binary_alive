# Changelog

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

## Version 1.0.3 Updates
- **Security Hardening**: Implemented comprehensive `.htaccess` rules across the root, `db/`, `includes/`, and `components/` directories. This completely blocks direct web access to sensitive files like `config.json`, SQLite databases, logs, and internal PHP partials.
- **Terminal Reliability**: Replaced all `shell_exec()` calls with a `safe_exec()` wrapper to prevent fatal crashes on restricted cPanel hosts where the function is disabled.
- **Smart Directory Resolution**: The terminal now falls back to parsing the server path to determine the user's home directory if standard shell commands are unavailable.
- **Navbar Toggle Fix**: Rebuilt the mobile hamburger menu toggle using custom JavaScript to prevent conflicts and double-firing caused by Bootstrap JS loading issues.

## Version 1.0.2 Updates
- **Admin Web Terminal**: Added a `terminal.php` page (admin only) with a dark terminal-style UI where admins can run shell commands directly from the browser, with command history, built-in `help`/`clear`/`processes`/`system` commands, and a 30-second timeout to prevent hangs.
- **Terminal API**: New `action=terminal` endpoint in `api.php` (admin only) that executes a shell command and returns stdout/stderr, exit code, and timeout status. Every command is recorded in the audit logs.
- **Dynamic Terminal Prompt**: Terminal prompt dynamically detects the underlying OS username and hostname instead of hardcoding values.
- **Enhanced Terminal UI**: Switched the terminal prompt design to use precise CSS-drawn brackets and VS Code-inspired text colors instead of raw characters, keeping it looking crisp across light and dark modes.
- **Dashboard UI Refinements**: Flattened the dashboard design by removing drop shadows from the cards and grouping all global action buttons cleanly in the header.
- **Master Admin Security**: Implemented a strict hierarchy where the Master Admin (User ID 1) cannot be deleted or demoted. 
- **Role Restrictions**: Regular admins can no longer assign the `admin` role, nor can they edit or delete other admin accounts.
- **Admin Hierarchy UI**: The Master Admin now features a distinct golden "Master Admin" badge in the users list, and restricted actions (like upgrading someone to admin) are securely disabled in the UI for regular admins.
- **Live CAPTCHA Validation**: The login page now shows a real-time green checkmark (✔) or red cross (✘) as you type the CAPTCHA code, so you know instantly if it's right without submitting the form. Includes anti-brute-force protection that invalidates and refreshes the CAPTCHA after too many bad attempts.
- **Navbar Layout Fix**: The logged-in username and role label is now correctly positioned inside the right-side button group in the navigation bar.
- **API Docs Sync**: Updated `API.md` to document the bulk process control (`ids[]`), the `sys_load` field in the status response, and the `cwd` field in the terminal response.

## Version 1.0.1 Updates
- **In-App Process Management**: Add, edit, delete, and group processes directly from the user interface.
- **Session Validation**: Changing a user's role or deleting an account instantly updates their active session.
- **Form Resubmission Fixes**: Uses the Post-Redirect-Get pattern to prevent browser "Confirm Form Resubmission" warnings on the Login, User Management, and Settings pages.
- **Database Settings**: Security settings (such as the CAPTCHA toggle) are now stored in the SQLite database to avoid file permission issues.
- **Admin Overrides**: Administrators can remove a user's 2FA setup if the user loses access to their authenticator app.
- **Rate Limiting**: The dashboard Refresh button has a 2-second delay to prevent excessive server requests.
- **Background Optimization**: Dashboard polling pauses when the browser tab is hidden to reduce server load.
- **UI Optimizations**: Buttons and checkboxes are hidden for restricted roles (Viewers/Auditors) for a cleaner interface.
- **Delete Functionality**: Added a dedicated API endpoint and a dashboard UI button to safely stop and permanently delete monitored processes.
