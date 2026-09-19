import { db } from './client.js';
import type { ApiTokenRecord } from '../types/index.js';

function parseApiTokenRow(row: any): ApiTokenRecord | null {
  if (!row) return null;
  return {
    ...row,
    is_disabled: Boolean(row.is_disabled),
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || {}),
  } as ApiTokenRecord;
}

export async function getApiTokenByHash(hash: string): Promise<ApiTokenRecord | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM api_tokens WHERE token_hash = ?',
    args: [hash],
  });
  return parseApiTokenRow(result.rows[0]);
}

export async function listApiTokensForUser(userId: number): Promise<ApiTokenRecord[]> {
  const result = await db.execute({
    sql: `SELECT t.*, u.username, u.email 
          FROM api_tokens t 
          LEFT JOIN users u ON t.user_id = u.id 
          WHERE t.user_id = ? 
          ORDER BY t.created_at DESC`,
    args: [userId],
  });
  return result.rows.map(parseApiTokenRow) as ApiTokenRecord[];
}

export async function listAllApiTokens(): Promise<ApiTokenRecord[]> {
  const result = await db.execute({
    sql: `SELECT t.*, u.username, u.email 
          FROM api_tokens t 
          LEFT JOIN users u ON t.user_id = u.id 
          ORDER BY t.created_at DESC`,
    args: [],
  });
  return result.rows.map(parseApiTokenRow) as ApiTokenRecord[];
}

export async function createApiToken(
  userId: number,
  name: string,
  tokenHash: string,
  permissions: string = '{}',
  expiresAt: string | null = null
): Promise<number> {
  const result = await db.execute({
    sql: 'INSERT INTO api_tokens (user_id, name, token_hash, permissions, is_disabled, expires_at) VALUES (?, ?, ?, ?, 0, ?)',
    args: [userId, name, tokenHash, permissions, expiresAt],
  });
  return Number(result.lastInsertRowid);
}

export async function updateApiToken(
  id: number,
  updates: { name?: string; permissions?: string; is_disabled?: number }
): Promise<void> {
  const fields: string[] = [];
  const args: any[] = [];

  if (updates.name) {
    fields.push('name = ?');
    args.push(updates.name);
  }
  if (updates.permissions) {
    fields.push('permissions = ?');
    args.push(updates.permissions);
  }
  if (updates.is_disabled !== undefined) {
    fields.push('is_disabled = ?');
    args.push(updates.is_disabled);
  }

  if (fields.length === 0) return;

  args.push(id);
  await db.execute({
    sql: `UPDATE api_tokens SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function disableApiToken(id: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE api_tokens SET is_disabled = 1 WHERE id = ?',
    args: [id],
  });
}

export async function enableApiToken(id: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE api_tokens SET is_disabled = 0 WHERE id = ?',
    args: [id],
  });
}

export async function deleteApiToken(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM api_tokens WHERE id = ?',
    args: [id],
  });
}

export async function updateApiTokenLastUsed(id: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE api_tokens SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
    args: [id],
  });
}
