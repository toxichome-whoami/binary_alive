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
  sortDirection = 'desc',
  start?: string,
  end?: string
): Promise<{ data: AuditLogRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  
  let baseWhere = "a.action NOT IN ('terminal_command', 'login_success', 'logout')";
  const args: any[] = [];
  
  if (start && end) {
    baseWhere += " AND a.timestamp BETWEEN ? AND ?";
    args.push(start.replace('T', ' ').replace('Z', ''), end.replace('T', ' ').replace('Z', ''));
  }
  
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
  sortDirection = 'desc',
  start?: string,
  end?: string
): Promise<{ data: LoginAttemptRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  let baseWhere = "1=1";
  const args: any[] = [];
  
  if (start && end) {
    baseWhere += " AND a.timestamp BETWEEN ? AND ?";
    args.push(start.replace('T', ' ').replace('Z', ''), end.replace('T', ' ').replace('Z', ''));
  }
  
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
  sortDirection = 'desc',
  start?: string,
  end?: string
): Promise<{ data: AuditLogRecord[]; total: number; total_pages: number }> {
  const offset = (page - 1) * limit;
  let baseWhere = "a.action = 'terminal_command'";
  const args: any[] = [];
  
  if (start && end) {
    baseWhere += " AND a.timestamp BETWEEN ? AND ?";
    args.push(start.replace('T', ' ').replace('Z', ''), end.replace('T', ' ').replace('Z', ''));
  }

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


export async function getLogMetrics(start?: string, end?: string): Promise<any> {
  const dateWhere = start && end ? "timestamp BETWEEN ? AND ?" : "timestamp >= date('now', '-15 days')";
  const dateArgs = start && end ? [start.replace('T', ' ').replace('Z', ''), end.replace('T', ' ').replace('Z', '')] : [];
  
  let timeFormat = "'%Y-%m-%d'"; // Default to day
  let groupAlias = "day";
  let maxPoints = 31;

  if (start && end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffMs = e - s;
    const hours = diffMs / (1000 * 60 * 60);

    if (hours <= 1) {
      timeFormat = "'%Y-%m-%d %H:%M'";
      groupAlias = "minute";
      maxPoints = 60;
    } else if (hours <= 24) {
      timeFormat = "'%Y-%m-%d %H:00'";
      groupAlias = "hour";
      maxPoints = 24;
    } else {
      timeFormat = "'%Y-%m-%d'";
      groupAlias = "day";
    }
  }

  const totalDaysRes = await db.execute({
    sql: `
    SELECT day, SUM(c) as c FROM (
      SELECT strftime(${timeFormat}, timestamp) as day, COUNT(*) as c FROM audit_logs WHERE ${dateWhere} GROUP BY strftime(${timeFormat}, timestamp)
      UNION ALL
      SELECT strftime(${timeFormat}, timestamp) as day, COUNT(*) as c FROM login_attempts WHERE ${dateWhere} GROUP BY strftime(${timeFormat}, timestamp)
    ) GROUP BY day ORDER BY day DESC LIMIT ${maxPoints}
  `,
    args: [...dateArgs, ...dateArgs]
  });
  
  const authDaysRes = await db.execute({
    sql: `
    SELECT strftime(${timeFormat}, timestamp) as day, 
           COUNT(*) as total,
           SUM(CASE WHEN is_successful = 1 THEN 1 ELSE 0 END) as success
    FROM login_attempts 
    WHERE ${dateWhere}
    GROUP BY strftime(${timeFormat}, timestamp) ORDER BY day DESC LIMIT ${maxPoints}
  `,
    args: dateArgs
  });
  
  const authDays = authDaysRes.rows.map((r: any) => {
    const tot = Number(r.total) || 0;
    const suc = Number(r.success) || 0;
    const rate = tot > 0 ? (suc / tot) * 100 : 100;
    return { day: r.day, c: rate, total: tot, success: suc };
  });

  const mutationDaysRes = await db.execute({
    sql: `SELECT strftime(${timeFormat}, timestamp) as day, COUNT(*) as c FROM audit_logs WHERE (action LIKE '%start%' OR action LIKE '%stop%' OR action LIKE '%restart%' OR action LIKE '%update%' OR action LIKE '%create%') AND ${dateWhere} GROUP BY strftime(${timeFormat}, timestamp) ORDER BY day DESC LIMIT ${maxPoints}`,
    args: dateArgs
  });
  
  const userDaysRes = await db.execute({
    sql: `
    SELECT day, COUNT(DISTINCT username) as c FROM (
      SELECT strftime(${timeFormat}, timestamp) as day, username FROM audit_logs WHERE username IS NOT NULL AND username != '' AND ${dateWhere}
      UNION
      SELECT strftime(${timeFormat}, timestamp) as day, username FROM login_attempts WHERE username IS NOT NULL AND username != '' AND ${dateWhere}
    ) GROUP BY day ORDER BY day DESC LIMIT ${maxPoints}
  `,
    args: [...dateArgs, ...dateArgs]
  });
  
  const totalEvents = totalDaysRes.rows.reduce((sum: number, r: any) => sum + Number(r.c), 0);
  const mutations = mutationDaysRes.rows.reduce((sum: number, r: any) => sum + Number(r.c), 0);
  const periodUsersRes = await db.execute({
    sql: `
    SELECT COUNT(DISTINCT username) as c FROM (
      SELECT username FROM audit_logs WHERE ${dateWhere} AND username != ''
      UNION
      SELECT username FROM login_attempts WHERE ${dateWhere} AND username != ''
    )
  `,
    args: [...dateArgs, ...dateArgs]
  });
  const uniqueUsers = (periodUsersRes.rows[0] as any).c || 0;

  let totalLogins = 0;
  let successfulLogins = 0;
  authDays.forEach(r => {
    totalLogins += r.total;
    successfulLogins += r.success;
  });
  const authRate = totalLogins > 0 ? ((successfulLogins / totalLogins) * 100).toFixed(1) : 100;

  return {
    totalEvents,
    authRate,
    failedLogins: totalLogins - successfulLogins,
    mutations,
    uniqueUsers,
    auditDays: totalDaysRes.rows,
    authDays,
    mutationDays: mutationDaysRes.rows,
    userDays: userDaysRes.rows
  };
}

export async function getLogBounds(): Promise<{ min_time: string | null; max_time: string | null }> {
  const res = await db.execute({
    sql: `
      SELECT MIN(timestamp) as min_time, MAX(timestamp) as max_time FROM (
        SELECT timestamp FROM audit_logs
        UNION ALL
        SELECT timestamp FROM login_attempts
      )
    `,
    args: []
  });
  return res.rows[0] as unknown as { min_time: string | null; max_time: string | null };
}
