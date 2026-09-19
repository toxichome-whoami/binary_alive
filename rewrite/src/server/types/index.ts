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
}

export type Role = 'owner' | 'member';

export interface User {
  id: number;
  username: string;
  email?: string | null;
  password_hash: string;
  role: Role;
  permissions: Permissions;
  totp_secret: string | null;
  // api_token column is deprecated, moving to api_tokens table
  created_at: string;
  failed_attempts: number;
  locked_until: string | null;
}

export interface ApiTokenRecord {
  id: number;
  user_id: number;
  username?: string;
  email?: string | null;
  name: string;
  token_hash: string;
  permissions: Permissions;
  is_disabled?: boolean | number;
  last_used: string | null;
  expires_at: string | null;
  created_at: string;
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
  email?: string | null;
  action: string;
  details: string | null;
  ip_address: string;
  timestamp: string;
}

export interface LoginAttemptRecord {
  id: number;
  ip_address: string;
  username: string | null;
  email?: string | null;
  is_successful: number;
  timestamp: string;
}
