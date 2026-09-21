import { db } from './client.js';
import type { ProcessRecord } from '../types/index.js';

export async function getAllProcesses(): Promise<ProcessRecord[]> {
  const result = await db.execute('SELECT * FROM processes ORDER BY group_name ASC, name ASC');
  return (result.rows as unknown as ProcessRecord[]) || [];
}

export async function getProcessById(id: number): Promise<ProcessRecord | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM processes WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as ProcessRecord) || null;
}

export async function createProcess(p: {
  name: string;
  group_name?: string;
  command: string;
  working_dir?: string;
  log_file?: string;
}): Promise<number> {
  const result = await db.execute({
    sql: 'INSERT INTO processes (name, group_name, command, working_dir, log_file) VALUES (?, ?, ?, ?, ?)',
    args: [
      p.name,
      p.group_name || 'Default',
      p.command,
      p.working_dir || null,
      p.log_file || null,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function updateProcess(
  id: number,
  updates: Partial<ProcessRecord>
): Promise<void> {
  const fields: string[] = [];
  const args: any[] = [];

  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    args.push(val);
  }

  if (fields.length === 0) return;

  args.push(id);
  await db.execute({
    sql: `UPDATE processes SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function deleteProcess(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM processes WHERE id = ?',
    args: [id],
  });
}
