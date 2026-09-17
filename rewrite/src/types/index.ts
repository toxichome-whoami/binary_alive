export type Role = 'admin' | 'operator' | 'viewer' | 'auditor';

export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
  hostname?: string;
}

export interface Process {
  id: number;
  name: string;
  group_name: string;
  command: string;
  working_dir: string;
  log_file: string;
  status: 'running' | 'stopped' | 'crashed';
  pid: number | null;
  cpu: string | number;
  mem: string;
  uptime: string;
  restart_count: number;
  auto_restart: number | boolean;
}

export interface User {
  id: number;
  username: string;
  role: Role;
  has_api_token: boolean;
  has_2fa: boolean;
  created_at: string;
  failed_attempts: number;
  locked_until?: string | null;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  details: string | null;
  ip_address: string;
  timestamp: string;
}

export interface LoginAttemptLog {
  id: number;
  ip_address: string;
  username: string | null;
  is_successful: number | boolean;
  timestamp: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface StatusResponse {
  success: boolean;
  data: Process[];
  sys_load: string | number;
}

export interface TerminalResponse {
  success: boolean;
  output: string;
  exit_code: number;
  timed_out: boolean;
  cwd: string;
  message?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
