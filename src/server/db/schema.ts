import { db } from './client.js';

export async function initDatabase(): Promise<void> {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      username         TEXT UNIQUE NOT NULL,
      email            TEXT,
      password_hash    TEXT NOT NULL,
      role             TEXT NOT NULL DEFAULT 'member',
      permissions      TEXT DEFAULT '{}',
      totp_secret      TEXT,
      api_token        TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      failed_attempts  INTEGER DEFAULT 0,
      locked_until     DATETIME
    );`,

    `CREATE TABLE IF NOT EXISTS processes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT UNIQUE NOT NULL,
      group_name    TEXT DEFAULT 'Default',
      command       TEXT NOT NULL,
      working_dir   TEXT,
      log_file      TEXT,
      auto_restart  INTEGER DEFAULT 1,
      status        TEXT DEFAULT 'stopped',
      pid           INTEGER,
      last_restart  DATETIME,
      restart_count INTEGER DEFAULT 0
    );`,


    `CREATE TABLE IF NOT EXISTS telemetry_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu           REAL,
      memory_mb     REAL,
      sys_load      REAL,
      active_procs  INTEGER,
      restarts      INTEGER,
      timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      username   TEXT,
      email      TEXT,
      action     TEXT NOT NULL,
      details    TEXT,
      ip_address TEXT,
      timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS login_attempts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address    TEXT NOT NULL,
      username      TEXT,
      email         TEXT,
      is_successful INTEGER DEFAULT 0,
      timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );`,

    `CREATE TABLE IF NOT EXISTS api_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      permissions TEXT NOT NULL DEFAULT '{}',
      is_disabled INTEGER DEFAULT 0,
      last_used   DATETIME,
      expires_at  DATETIME,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS ai_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message     TEXT NOT NULL,
      response    TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
  ];

  for (const sql of schemaStatements) {
    await db.execute(sql);
  }

  // Ensure default settings exist
  await db.execute({
    sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('enable_captcha', '0');`,
    args: [],
  });

  // Migrate DB: add permissions column if it doesn't exist
  try {
    await db.execute('ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT "{}"');
  } catch (err: any) {
    // Ignore if column already exists
  }

  // Migrate DB: add email column if it doesn't exist
  try {
    await db.execute('ALTER TABLE users ADD COLUMN email TEXT');
  } catch (err: any) {
    // Ignore if column already exists
  }

  // Migrate DB: add email column to audit_logs if it doesn't exist
  try {
    await db.execute('ALTER TABLE audit_logs ADD COLUMN email TEXT');
  } catch (err: any) {
    // Ignore if column already exists
  }

  // Migrate DB: add email column to login_attempts if it doesn't exist
  try {
    await db.execute('ALTER TABLE login_attempts ADD COLUMN email TEXT');
  } catch (err: any) {
    // Ignore if column already exists
  }

  // Set default email for users if empty
  try {
    await db.execute("UPDATE users SET email = 'toxichome@binary.local' WHERE id = 1 AND (email IS NULL OR email = '')");
    await db.execute("UPDATE users SET email = 'admin@binary.local' WHERE username = 'admin' AND id != 1 AND (email IS NULL OR email = '')");
    await db.execute("UPDATE users SET email = 'operator@binary.local' WHERE username = 'operator' AND (email IS NULL OR email = '')");
    await db.execute("UPDATE users SET email = 'auditor@binary.local' WHERE username = 'auditor' AND (email IS NULL OR email = '')");
    await db.execute("UPDATE users SET email = username || '@binary.local' WHERE (email IS NULL OR email = '')");
  } catch (err: any) {
    // Ignore
  }

  // Migrate DB: add is_disabled column to api_tokens if it doesn't exist
  try {
    await db.execute('ALTER TABLE api_tokens ADD COLUMN is_disabled INTEGER DEFAULT 0');
  } catch (err: any) {
    // Ignore if column already exists
  }

  // Helper to get old users
  const oldUsersRes = await db.execute('SELECT id, role, permissions, api_token FROM users');
  const legacyRoles = ['admin', 'operator', 'viewer', 'auditor'];

  // Full set of atomic permissions
  const ALL_PERMS = {
    users_view: true, users_create: true, users_edit: true, users_disable: true, users_delete: true, users_reset_2fa: true,
    api_keys_view: true, api_keys_create: true, api_keys_edit: true, api_keys_disable: true, api_keys_delete: true,
    processes_view: true, processes_start: true, processes_stop: true, processes_restart: true, processes_create: true, processes_edit: true, processes_delete: true,
    logs_view_audit: true, logs_view_login: true, logs_view_terminal: true,
    settings_view: true, settings_edit: true, settings_security: true,
    terminal_access: true, terminal_unrestricted: true,
  };

  for (const user of oldUsersRes.rows) {
    const userId = Number(user.id);
    let oldPerms;
    try {
      oldPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : {};
    } catch {
      oldPerms = {};
    }
    
    // Check if it's the owner or needs upgrade
    if (userId === 1) {
      await db.execute({
        sql: `UPDATE users SET role = 'owner', permissions = ? WHERE id = 1`,
        args: [JSON.stringify(ALL_PERMS)]
      });
      continue;
    }

    // Upgrade old granular to new atomic
    if (user.role === 'owner') continue; // Skip owner

    let newPerms: any = { ...oldPerms };
    let needsUpgrade = false;

    // Migrate tokens and views if the user had older tokens mapping
    if ('users_manage_tokens' in newPerms) {
      const hadTokens = !!newPerms.users_manage_tokens;
      newPerms.users_view = newPerms.users_view ?? true;
      newPerms.users_disable = newPerms.users_disable ?? false;
      newPerms.api_keys_view = newPerms.api_keys_view ?? hadTokens;
      newPerms.api_keys_create = newPerms.api_keys_create ?? hadTokens;
      newPerms.api_keys_edit = newPerms.api_keys_edit ?? hadTokens;
      newPerms.api_keys_disable = newPerms.api_keys_disable ?? hadTokens;
      newPerms.api_keys_delete = newPerms.api_keys_delete ?? hadTokens;
      delete newPerms.users_manage_tokens;
      needsUpgrade = true;
    }

    // From legacy roles
    if (legacyRoles.includes(user.role as string)) {
      needsUpgrade = true;
      if (user.role === 'admin') {
        newPerms = { ...ALL_PERMS };
      } else if (user.role === 'operator') {
        newPerms = {
          processes_view: true, processes_start: true, processes_stop: true, processes_restart: true,
          logs_view_audit: true, logs_view_login: true, logs_view_terminal: true,
        };
      } else {
        newPerms = { logs_view_audit: true, logs_view_login: true, logs_view_terminal: true };
      }
    } else {
      // It's a 'member' with some broad permissions, upgrade them
      if (oldPerms.manage_users !== undefined) {
        needsUpgrade = true;
        if (oldPerms.manage_users) {
          newPerms.users_view = true; newPerms.users_create = true; newPerms.users_edit = true; newPerms.users_disable = true; newPerms.users_delete = true; newPerms.users_reset_2fa = true;
          newPerms.api_keys_view = true; newPerms.api_keys_create = true; newPerms.api_keys_edit = true; newPerms.api_keys_disable = true; newPerms.api_keys_delete = true;
        }
        if (oldPerms.manage_processes) {
          newPerms.processes_view = true; newPerms.processes_start = true; newPerms.processes_stop = true; newPerms.processes_restart = true; newPerms.processes_create = true; newPerms.processes_edit = true; newPerms.processes_delete = true;
        }
        if (oldPerms.view_logs) {
          newPerms.logs_view_audit = true; newPerms.logs_view_login = true; newPerms.logs_view_terminal = true;
        }
        if (oldPerms.manage_settings) {
          newPerms.settings_view = true; newPerms.settings_edit = true; newPerms.settings_security = true;
        }
        if (oldPerms.use_terminal) {
          newPerms.terminal_access = true; newPerms.terminal_unrestricted = false;
        }
        
        // Remove old keys
        delete newPerms.manage_users;
        delete newPerms.manage_processes;
        delete newPerms.view_logs;
        delete newPerms.manage_settings;
        delete newPerms.use_terminal;
      }
    }

    if (needsUpgrade) {
      await db.execute({
        sql: `UPDATE users SET role = 'member', permissions = ? WHERE id = ?`,
        args: [JSON.stringify(newPerms), userId]
      });
    }

    // Migrate api_token to api_tokens table
    if (user.api_token) {
      const existingKey = await db.execute({
        sql: 'SELECT id FROM api_tokens WHERE token_hash = ?',
        args: [user.api_token]
      });
      if (existingKey.rows.length === 0) {
        await db.execute({
          sql: 'INSERT INTO api_tokens (user_id, name, token_hash, permissions) VALUES (?, ?, ?, ?)',
          args: [userId, 'Migrated Token', user.api_token, JSON.stringify(needsUpgrade ? newPerms : oldPerms)]
        });
      }
      // Delete old token
      await db.execute({
        sql: 'UPDATE users SET api_token = NULL WHERE id = ?',
        args: [userId]
      });
    }
  }

  // Intentionally leaving processes table empty for the user to seed manually
}
