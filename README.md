# Secure Binary Alive System (v1.0.1)

A PHP-based monitoring and process management system designed to keep Linux binaries (such as Discord bots, Node apps, or Go/C++ binaries) running continuously on cPanel/WHM servers.

## Documentation Links
- **[View the API Documentation](API.md)**: Learn how to manage your bots remotely via cURL or custom scripts.
- **[View the Changelog](CHANGELOG.md)**: See all the latest features and security updates for version 1.0.1.

## Key Features
- **Auto-Restart**: Automatically restarts binaries if they stop or if the server reboots.
- **Security**: Role-Based Access Control (RBAC), 2FA/TOTP support, CAPTCHA protection, IP Whitelisting, and Security Headers.
- **Audit Logging**: Tracks login attempts, process start/stop actions, and API key generation with pagination.
- **API Access**: Control processes remotely using API tokens.
- **CPanel Native**: Runs entirely on standard PHP 7.4+ and SQLite. No Composer, Node.js, or PM2 required on the host server.

## Installation Instructions

1. **Upload the files**: 
   Upload the entire system directory to a public folder on cPanel (e.g. `public_html/watch`).

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
- If you receive a **403 Forbidden - IP not allowed** error, edit `config.json` and ensure the `"allowed_ips"` array either contains your public IP address or is empty `[]` to disable the whitelist.
- The `db` and `includes` folders are protected by `.htaccess` files. Ensure your Apache server allows `.htaccess` overrides so unauthorized users cannot download your files.
