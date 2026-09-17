export type Role = 'admin' | 'operator' | 'viewer' | 'auditor';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  totp_secret: string | null;
  api_token: string | null;
  created_at: string;
  failed_attempts: number;
  locked_until: string | null;
}

export interface ProcessRecord {
  id: number;
  name: string;
  group_name: string;
  command: string;
  working_dir: string | null;
  log_file: string | null;
  auto_restart: number;
  status: 'running' | 'stopped' | 'crashed';
  pid: number | null;
  last_restart: string | null;
  restart_count: number;
}

export interface SessionRecord {
  id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

export interface AuditLogRecord {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  details: string | null;
  ip_address: string;
  timestamp: string;
}

export interface LoginAttemptRecord {
  id: number;
  ip_address: string;
  username: string | null;
  is_successful: number;
  timestamp: string;
}
