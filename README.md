# Secure Binary Alive System

A highly secure, PHP-based Binary Aliveing system designed to keep Linux binaries (like Discord bots, Node apps, or custom Go/C++ binaries) running continuously on cPanel/WHM servers. 

## Features
- **Zero Downtime**: Automatically restarts your binaries if they crash or if the server reboots.
- **Enterprise Security**: Role-Based Access Control (RBAC), 2FA/TOTP support, IP Whitelisting, and strict Security Headers.
- **Audit Logging**: Tracks every login attempt, process start/stop action, and API key generation.
- **Headless API**: Control your processes remotely using secure API tokens.
- **CPanel Native**: No Composer, Node.js, or PM2 required on the host. Runs entirely on raw PHP 7.4+ and SQLite.

## Installation Instructions

1. **Upload the files**: 
   Upload the entire `keepalive` directory to your public-facing folder on cPanel (e.g. `public_html/keepalive`).

2. **Set up the Cron Job**:
   For the auto-restart feature to work, you must set up a cron job in cPanel to ping the `cron.php` file every minute.
   - Go to your cPanel Dashboard -> **Cron Jobs**.
   - Add a new cron job for **Once Per Minute** (`* * * * *`).
   - Command: `curl -s https://yourdomain.com/keepalive/cron.php > /dev/null 2>&1`
   - *(Alternatively, if using the CLI: `php /home/username/public_html/keepalive/cron.php > /dev/null 2>&1`)*

3. **Login and Configure**:
   - Access `https://yourdomain.com/keepalive/login.php` in your browser.
   - Default Username: `admin`
   - Default Password: `password`
   - **IMPORTANT**: Immediately change your password by deleting the default user and recreating a new Admin in the **Users** tab, or change it directly in the database.

4. **Add Processes**:
   - Currently, processes can be added manually to the `monitor.sqlite` database using the built-in SQLite manager in cPanel, or by importing a customized `monitor.sqlite` file via the **Settings** page.
   - The command field should follow this format for background execution: `nohup ./binary_name > output.log 2>&1 &`

## Security Notes
- If you get a **403 Forbidden - IP not allowed** error, edit `config.json` and ensure the `"allowed_ips"` array either contains your public IP address or is completely empty `[]` to disable the whitelist.
- The `db` and `includes` folders are protected by `.htaccess` files. Ensure your Apache server allows `.htaccess` overrides so unauthorized users cannot download your database file.
