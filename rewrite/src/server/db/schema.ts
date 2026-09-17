import { db } from './client.js';

export async function initDatabase(): Promise<void> {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      username         TEXT UNIQUE NOT NULL,
      password_hash    TEXT NOT NULL,
      role             TEXT NOT NULL DEFAULT 'viewer',
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
      action     TEXT NOT NULL,
      details    TEXT,
      ip_address TEXT,
      timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS login_attempts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address    TEXT NOT NULL,
      username      TEXT,
      is_successful INTEGER DEFAULT 0,
      timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );`,
  ];

  for (const sql of schemaStatements) {
    await db.execute(sql);
  }

  // Ensure default settings exist
  await db.execute({
    sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('enable_captcha', '1');`,
    args: [],
  });
}
