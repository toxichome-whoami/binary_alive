import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_URL || 'file:local.db';
const authToken = process.env.TURSO_TOKEN || undefined;

export const db: Client = createClient({
  url,
  authToken,
});

export default db;
