import { db } from './client.js';
import type { User, Role } from '../types/index.js';

function parseUserRow(row: any): User | null {
  if (!row) return null;
  return {
    ...row,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || {}),
    api_keys_count: row.api_keys_count ? Number(row.api_keys_count) : 0,
    has_2fa: !!row.totp_secret,
  } as User;
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });
  return parseUserRow(result.rows[0]);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username],
  });
  return parseUserRow(result.rows[0]);
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
    sql: `
      SELECT u.id, u.username, u.email, u.role, u.permissions, u.totp_secret, u.created_at, u.failed_attempts, u.locked_until,
             COUNT(t.id) as api_keys_count
      FROM users u
      LEFT JOIN api_tokens t ON u.id = t.user_id
      GROUP BY u.id
      ORDER BY u.id ASC LIMIT ? OFFSET ?
    `,
    args: [limit, offset],
  });

  const users = result.rows.map((row: any) => parseUserRow(row)) as unknown as User[];

  return {
    data: users,
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

export async function createUser(username: string, passwordHash: string, role: Role, permissions: string = '{}', email: string | null = null): Promise<number> {
  const result = await db.execute({
    sql: 'INSERT INTO users (username, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)',
    args: [username, email, passwordHash, role, permissions],
  });
  return Number(result.lastInsertRowid);
}

export async function updateUser(
  id: number,
  updates: {
    username?: string;
    email?: string | null;
    passwordHash?: string;
    role?: Role;
    permissions?: string;
    locked_until?: string | null;
    failed_attempts?: number;
  }
): Promise<void> {
  const fields: string[] = [];
  const args: any[] = [];

  if (updates.username !== undefined) {
    fields.push('username = ?');
    args.push(updates.username);
  }
  if (updates.email !== undefined) {
    fields.push('email = ?');
    args.push(updates.email);
  }
  if (updates.passwordHash !== undefined) {
    fields.push('password_hash = ?');
    args.push(updates.passwordHash);
  }
  if (updates.role !== undefined) {
    fields.push('role = ?');
    args.push(updates.role);
  }
  if (updates.permissions !== undefined) {
    fields.push('permissions = ?');
    args.push(updates.permissions);
  }
  if (updates.locked_until !== undefined) {
    fields.push('locked_until = ?');
    args.push(updates.locked_until);
  }
  if (updates.failed_attempts !== undefined) {
    fields.push('failed_attempts = ?');
    args.push(updates.failed_attempts);
  }

  if (fields.length === 0) return;

  args.push(id);
  await db.execute({
    sql: `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function disableUser(id: number): Promise<void> {
  await updateUser(id, { locked_until: '2099-12-31T23:59:59.000Z' });
}

export async function enableUser(id: number): Promise<void> {
  await updateUser(id, { locked_until: null, failed_attempts: 0 });
}

export async function deleteUser(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [id],
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
