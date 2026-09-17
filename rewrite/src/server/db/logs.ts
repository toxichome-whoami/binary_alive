import { db } from './client.js';
import type { AuditLogRecord, LoginAttemptRecord } from '../types/index.js';

export async function logAudit(
  userId: number | null,
  username: string | null,
  action: string,
  details = '',
  ip = '127.0.0.1'
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
    args: [userId, username, action, details, ip],
  });
}

export async function logLoginAttempt(
  username: string | null,
  isSuccess: boolean,
  ip = '127.0.0.1'
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO login_attempts (username, is_successful, ip_address) VALUES (?, ?, ?)',
    args: [username, isSuccess ? 1 : 0, ip],
  });
}

export async function getAuditLogs(
  page = 1,
  limit = 20
): Promise<{ data: AuditLogRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  const countRes = await db.execute(
    "SELECT COUNT(*) as cnt FROM audit_logs WHERE action NOT IN ('terminal_command', 'login_success', 'logout')"
  );
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: `SELECT * FROM audit_logs 
          WHERE action NOT IN ('terminal_command', 'login_success', 'logout') 
          ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });

  return {
    data: (result.rows as unknown as AuditLogRecord[]) || [],
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

export async function getLoginLogs(
  page = 1,
  limit = 20
): Promise<{ data: LoginAttemptRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  const countRes = await db.execute('SELECT COUNT(*) as cnt FROM login_attempts');
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: 'SELECT * FROM login_attempts ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    args: [limit, offset],
  });

  return {
    data: (result.rows as unknown as LoginAttemptRecord[]) || [],
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

export async function getTerminalLogs(
  page = 1,
  limit = 20
): Promise<{ data: AuditLogRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  const countRes = await db.execute("SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'terminal_command'");
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: `SELECT * FROM audit_logs 
          WHERE action = 'terminal_command' 
          ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });

  return {
    data: (result.rows as unknown as AuditLogRecord[]) || [],
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}
