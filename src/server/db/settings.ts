import { db } from './client.js';

export async function getSetting(key: string, defaultValue: string | null = null): Promise<string | null> {
  const result = await db.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [key],
  });
  return result.rows[0]?.value !== undefined ? String(result.rows[0].value) : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?) 
          ON CONFLICT(key) DO UPDATE SET value = ?`,
    args: [key, value, value],
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const result = await db.execute('SELECT * FROM settings');
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    if (row.key) map[String(row.key)] = String(row.value);
  }
  return map;
}
