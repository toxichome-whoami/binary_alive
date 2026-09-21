import { db } from './client';

export interface AiHistoryRecord {
  id: number;
  user_id: number;
  message: string;
  response: string;
  created_at: string;
  username?: string; // Joined from users
  email?: string; // Joined from users
}

export async function addAiHistory(userId: number, message: string, response: string): Promise<number> {
  const res = await db.execute({
    sql: `INSERT INTO ai_history (user_id, message, response) VALUES (?, ?, ?) RETURNING id`,
    args: [userId, message, response],
  });
  return res.rows[0].id as number;
}

export async function getMyAiHistory(userId: number, limit = 50, offset = 0): Promise<{ data: AiHistoryRecord[], total: number }> {
  const dataRes = await db.execute({
    sql: `
      SELECT * FROM ai_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [userId, limit, offset],
  });

  const totalRes = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM ai_history WHERE user_id = ?',
    args: [userId],
  });

  return {
    data: dataRes.rows as unknown as AiHistoryRecord[],
    total: totalRes.rows[0].count as number,
  };
}

export async function getAiHistory(limit = 100, offset = 0, startDate?: string, endDate?: string): Promise<{ data: AiHistoryRecord[], total: number }> {
  let dateFilter = '';
  const queryArgs: any[] = [];
  
  if (startDate && endDate) {
    dateFilter = 'WHERE a.created_at BETWEEN ? AND ?';
    queryArgs.push(startDate.replace('T', ' ').replace('Z', ''), endDate.replace('T', ' ').replace('Z', ''));
  } else if (startDate) {
    dateFilter = 'WHERE a.created_at >= ?';
    queryArgs.push(startDate.replace('T', ' ').replace('Z', ''));
  } else if (endDate) {
    dateFilter = 'WHERE a.created_at <= ?';
    queryArgs.push(endDate.replace('T', ' ').replace('Z', ''));
  }

  const dataRes = await db.execute({
    sql: `
      SELECT a.*, u.username, u.email 
      FROM ai_history a
      LEFT JOIN users u ON a.user_id = u.id
      ${dateFilter}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...queryArgs, limit, offset],
  });

  const totalRes = await db.execute({
    sql: `SELECT COUNT(*) as count FROM ai_history a ${dateFilter}`,
    args: queryArgs
  });

  return {
    data: dataRes.rows as unknown as AiHistoryRecord[],
    total: totalRes.rows[0].count as number,
  };
}

export async function deleteAiHistory(id: number): Promise<boolean> {
  const res = await db.execute({
    sql: 'DELETE FROM ai_history WHERE id = ?',
    args: [id],
  });
  return res.rowsAffected > 0;
}

export async function getAiHistoryBounds(): Promise<{ min_time: string | null; max_time: string | null }> {
  const res = await db.execute('SELECT MIN(created_at) as min_time, MAX(created_at) as max_time FROM ai_history');
  return {
    min_time: res.rows[0]?.min_time as string | null,
    max_time: res.rows[0]?.max_time as string | null,
  };
}
