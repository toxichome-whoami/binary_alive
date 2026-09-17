import { db } from './client.js';
import type { User, Role } from '../types/index.js';

export async function getUserById(id: number): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as User) || null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username],
  });
  return (result.rows[0] as unknown as User) || null;
}

export async function getUserByApiToken(hash: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE api_token = ?',
    args: [hash],
  });
  return (result.rows[0] as unknown as User) || null;
}

export async function countUsers(): Promise<number> {
  const result = await db.execute('SELECT COUNT(*) as cnt FROM users');
  return Number(result.rows[0]?.cnt || 0);
}

export async function listUsers(page = 1, limit = 20): Promise<{ data: User[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  const countRes = await db.execute('SELECT COUNT(*) as cnt FROM users');
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: 'SELECT id, username, role, api_token, totp_secret, created_at, failed_attempts, locked_until FROM users ORDER BY id ASC LIMIT ? OFFSET ?',
    args: [limit, offset],
  });

  const users = result.rows.map((row: any) => ({
    id: row.id,
    username: row.username,
    role: row.role as Role,
    has_api_token: !!row.api_token,
    has_2fa: !!row.totp_secret,
    created_at: row.created_at,
    failed_attempts: row.failed_attempts,
    locked_until: row.locked_until,
  })) as unknown as User[];

  return {
    data: users,
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

export async function createUser(username: string, passwordHash: string, role: Role): Promise<number> {
  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    args: [username, passwordHash, role],
  });
  return Number(result.lastInsertRowid);
}

export async function updateUser(
  id: number,
  updates: { username?: string; passwordHash?: string; role?: Role }
): Promise<void> {
  const fields: string[] = [];
  const args: any[] = [];

  if (updates.username) {
    fields.push('username = ?');
    args.push(updates.username);
  }
  if (updates.passwordHash) {
    fields.push('password_hash = ?');
    args.push(updates.passwordHash);
  }
  if (updates.role) {
    fields.push('role = ?');
    args.push(updates.role);
  }

  if (fields.length === 0) return;

  args.push(id);
  await db.execute({
    sql: `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function deleteUser(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [id],
  });
}

export async function setApiToken(id: number, tokenHash: string | null): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET api_token = ? WHERE id = ?',
    args: [tokenHash, id],
  });
}

export async function setTotpSecret(id: number, secret: string | null): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET totp_secret = ? WHERE id = ?',
    args: [secret, id],
  });
}

export async function incrementFailedAttempts(username: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE username = ?',
    args: [username],
  });
}

export async function resetFailedAttempts(username: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = ?',
    args: [username],
  });
}
