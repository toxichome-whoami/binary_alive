# Secure Binary Alive System (v1.0.4)

A PHP-based monitoring and process management system designed to keep Linux binaries (such as Discord bots, Node apps, or Go/C++ binaries) running continuously on cPanel/WHM servers.

## Documentation Links
- **[View the API Documentation](API.md)**: Learn how to manage your bots remotely via cURL or custom scripts.
- **[View the Changelog](CHANGELOG.md)**: See all the latest features and security updates for version 1.0.4.

## Key Features
- **Auto-Restart**: Automatically restarts binaries if they stop or if the server reboots.
- **Security**: Role-Based Access Control (RBAC), 2FA/TOTP support, live CAPTCHA protection, IP Whitelisting, CSRF protection on all state-changing and export operations, and strict Security Headers.
- **Master Admin Hierarchy**: The first registered account becomes the permanent Master Admin. Regular admins cannot delete, demote, or modify other admin accounts.
- **Web Terminal**: Admin-only browser terminal (`terminal.php`) to run shell commands directly on the server with session-persistent working directory, command history, and a 30-second timeout guard.
- **Audit Logging**: Tracks login attempts, process start/stop/restart actions, terminal commands, and API key generation with pagination.
- **API Access**: Control and monitor processes remotely using API tokens via cURL or custom scripts.
- **In-App Process Management**: Add, edit, delete, and group monitored processes directly from the dashboard UI.
- **Automatic Security Migration**: On first run, existing API tokens are hashed and TOTP secrets are encrypted automatically. No manual steps required.
- **CPanel Native**: Runs entirely on standard PHP 7.4+ and SQLite. No Composer, Node.js, or PM2 required on the host server.

## Installation Instructions

1. **Upload the files**:
   Upload the entire system directory to any folder that is mapped to a domain or subdomain on your server (e.g. `public_html/watch`, an addon domain folder like `watch.yourdomain.com`, or any subdomain directory). Make sure hidden files are included — specifically the `.htaccess` files in the root, `db/`, `includes/`, and `components/` folders.

2. **Set up the Cron Job**:
   For the auto-restart feature to work, you must configure a cron job in cPanel to run the `cron.php` file every minute.
   - Open your cPanel Dashboard -> **Cron Jobs**.
   - Add a new cron job set to **Once Per Minute** (`* * * * *`).
   - Command: `/usr/local/bin/php /home/your_username/your_domain/cron.php`
   - *(Note: Ensure the path matches your server setup. Using CLI PHP is recommended over cURL for running background processes).*

3. **Login and Configure**:
   - Access the dashboard in your web browser.
   - Upon first load, you will be prompted to create the Admin account since the database is empty.
   - Go to **Settings** to toggle security features or export your database.

## Security Notes
- The system stores configuration in `config.php`, which is protected from direct browser access by a `die()` header even if `.htaccess` is not supported. Do **not** rename or delete this file.
- If you receive a **403 Forbidden - IP not allowed** error, edit `config.php` (using a text editor or FTP) and ensure the `"allowed_ips"` array either contains your public IP address or is empty `[]` to disable the whitelist.
- The database is stored under `db/` with a randomized filename. The `db/` directory is locked to `0700` permissions and contains its own `index.php` guard. Ensure your web server user has write access to this directory.
- Four `.htaccess` files protect the system: the **root** (blocks markdown, logs, backups, and `config.php`), **`db/`** (blocks database downloads), **`includes/`** (blocks internal PHP files), and **`components/`** (blocks partial PHP files). Ensure your Apache server has `AllowOverride All` enabled for these to work.
- On first run, the system automatically generates a strong random encryption key and migrates any existing database records. No manual setup is required.
- If your FTP client does not show hidden files, enable "Show Hidden Files" before uploading — otherwise the `.htaccess` files will not be transferred and your sensitive files will be exposed.

## Updating the System
When applying code updates (e.g., uploading a new zip file), **do not overwrite your live `config.php` file**. The `config.php` file contains your randomized database connection string and secret encryption key. Overwriting it will cause the system to lose connection to your database. (Note: A `.gitignore` file is included so `config.php` and your `db/*.sqlite` files are protected from being tracked in git or standard archives).
