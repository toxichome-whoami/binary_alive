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

export async function getAiHistory(limit = 100, offset = 0): Promise<{ data: AiHistoryRecord[], total: number }> {
  const dataRes = await db.execute({
    sql: `
      SELECT a.*, u.username, u.email 
      FROM ai_history a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [limit, offset],
  });

  const totalRes = await db.execute('SELECT COUNT(*) as count FROM ai_history');

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
