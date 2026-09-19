export interface Permissions {
  users_view: boolean;
  users_create: boolean;
  users_edit: boolean;
  users_disable: boolean;
  users_delete: boolean;
  users_reset_2fa: boolean;

  api_keys_view: boolean;
  api_keys_create: boolean;
  api_keys_edit: boolean;
  api_keys_disable: boolean;
  api_keys_delete: boolean;

  processes_view: boolean;
  processes_start: boolean;
  processes_stop: boolean;
  processes_restart: boolean;
  processes_create: boolean;
  processes_edit: boolean;
  processes_delete: boolean;

  logs_view_audit: boolean;
  logs_view_login: boolean;
  logs_view_terminal: boolean;

  settings_view: boolean;
  settings_edit: boolean;
  settings_security: boolean;

  terminal_access: boolean;
  terminal_unrestricted: boolean;

  ai_access: boolean;
  ai_data_read: boolean;
  ai_data_write: boolean;
}

export type Role = 'owner' | 'member';

export interface CurrentUser {
  id: number;
  username: string;
  email?: string | null;
  role: Role;
  permissions: Permissions;
  hostname?: string;
}

export interface ApiToken {
  id: number;
  user_id: number;
  username?: string;
  email?: string | null;
  name: string;
  permissions: Permissions;
  is_disabled?: boolean | number;
  last_used: string | null;
  expires_at: string | null;
  created_at: string;
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
  email?: string | null;
  role: Role;
  permissions: Permissions;
  api_keys_count: number;
  has_2fa: boolean;
  created_at: string;
  failed_attempts: number;
  locked_until?: string | null;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  email?: string | null;
  action: string;
  details: string | null;
  ip_address: string;
  timestamp: string;
}

export interface LoginAttemptLog {
  id: number;
  ip_address: string;
  username: string | null;
  email?: string | null;
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
