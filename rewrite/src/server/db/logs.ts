import { db } from './client.js';
import type { AuditLogRecord, LoginAttemptRecord } from '../types/index.js';

export async function logAudit(
  userId: number | null,
  username: string | null,
  action: string,
  details = '',
  ip = '127.0.0.1',
  email: string | null = null
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO audit_logs (user_id, username, action, details, ip_address, email) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, username, action, details, ip, email],
  });
}

export async function logLoginAttempt(
  username: string | null,
  isSuccess: boolean,
  ip = '127.0.0.1',
  email: string | null = null
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO login_attempts (username, is_successful, ip_address, email) VALUES (?, ?, ?, ?)',
    args: [username, isSuccess ? 1 : 0, ip, email],
  });
}

export async function getAuditLogs(
  page = 1,
  limit = 20,
  search = '',
  sortField = 'timestamp',
  sortDirection = 'desc'
): Promise<{ data: AuditLogRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  
  let baseWhere = "a.action NOT IN ('terminal_command', 'login_success', 'logout')";
  const args: any[] = [];
  
  if (search && search.trim()) {
    baseWhere += " AND (LOWER(a.username) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(a.action) LIKE ? OR LOWER(a.details) LIKE ? OR a.ip_address LIKE ?)";
    const q = `%${search.trim().toLowerCase()}%`;
    args.push(q, q, q, q, q);
  }
  
  const allowedSorts = ['timestamp', 'username', 'email', 'action', 'ip_address'];
  const safeSortField = allowedSorts.includes(sortField) ? sortField : 'timestamp';
  const safeSortDir = sortDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM audit_logs a WHERE ${baseWhere}`,
    args
  });
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: `SELECT a.id, a.user_id, a.username, a.action, a.details, a.ip_address, a.timestamp,
                 COALESCE(NULLIF(a.email, ''), u.email) as email 
          FROM audit_logs a
          LEFT JOIN users u ON (a.user_id = u.id OR (a.user_id IS NULL AND a.username = u.username))
          WHERE ${baseWhere} 
          ORDER BY a.${safeSortField} ${safeSortDir} LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  return {
    data: (result.rows as unknown as AuditLogRecord[]) || [],
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

export async function getLoginLogs(
  page = 1,
  limit = 20,
  search = '',
  sortField = 'timestamp',
  sortDirection = 'desc'
): Promise<{ data: LoginAttemptRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  let baseWhere = "1=1";
  const args: any[] = [];
  
  if (search && search.trim()) {
    baseWhere += " AND (LOWER(a.username) LIKE ? OR LOWER(a.email) LIKE ? OR a.ip_address LIKE ?)";
    const q = `%${search.trim().toLowerCase()}%`;
    args.push(q, q, q);
  }

  const allowedSorts = ['timestamp', 'username', 'email', 'ip_address', 'is_successful'];
  const safeSortField = allowedSorts.includes(sortField) ? sortField : 'timestamp';
  const safeSortDir = sortDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM login_attempts a WHERE ${baseWhere}`,
    args
  });
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: `SELECT a.*, COALESCE(NULLIF(a.email, ''), u.email) as email 
          FROM login_attempts a
          LEFT JOIN users u ON (a.username = u.username)
          WHERE ${baseWhere}
          ORDER BY a.${safeSortField} ${safeSortDir} LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  return {
    data: (result.rows as unknown as LoginAttemptRecord[]) || [],
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

export async function getTerminalLogs(
  page = 1,
  limit = 20,
  search = '',
  sortField = 'timestamp',
  sortDirection = 'desc'
): Promise<{ data: AuditLogRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  let baseWhere = "a.action = 'terminal_command'";
  const args: any[] = [];

  if (search && search.trim()) {
    baseWhere += " AND (LOWER(a.username) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(a.details) LIKE ? OR a.ip_address LIKE ?)";
    const q = `%${search.trim().toLowerCase()}%`;
    args.push(q, q, q, q);
  }

  const allowedSorts = ['timestamp', 'username', 'email', 'ip_address'];
  const safeSortField = allowedSorts.includes(sortField) ? sortField : 'timestamp';
  const safeSortDir = sortDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM audit_logs a WHERE ${baseWhere}`,
    args
  });
  const total = Number(countRes.rows[0]?.cnt || 0);

  const result = await db.execute({
    sql: `SELECT a.id, a.user_id, a.username, a.action, a.details, a.ip_address, a.timestamp,
                 COALESCE(NULLIF(a.email, ''), u.email) as email 
          FROM audit_logs a
          LEFT JOIN users u ON (a.user_id = u.id OR (a.user_id IS NULL AND a.username = u.username))
          WHERE ${baseWhere} 
          ORDER BY a.${safeSortField} ${safeSortDir} LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  return {
    data: (result.rows as unknown as AuditLogRecord[]) || [],
    total,
    total_pages: Math.ceil(total / limit) || 1,
  };
}
