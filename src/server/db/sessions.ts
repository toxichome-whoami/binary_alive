import { db } from './client.js';
import type { SessionRecord } from '../types/index.js';
import crypto from 'crypto';

export async function createSession(userId: number, timeoutMinutes = 15): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    args: [sessionId, userId, expiresAt],
  });

  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const result = await db.execute({
    sql: "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
    args: [sessionId],
  });
  return (result.rows[0] as unknown as SessionRecord) || null;
}

export async function touchSession(sessionId: string, timeoutMinutes = 15): Promise<void> {
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
  await db.execute({
    sql: 'UPDATE sessions SET expires_at = ? WHERE id = ?',
    args: [expiresAt, sessionId],
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [sessionId],
  });
}

export async function deleteUserSessions(userId: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM sessions WHERE user_id = ?',
    args: [userId],
  });
}

export async function cleanupExpiredSessions(): Promise<void> {
  await db.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')");
}
