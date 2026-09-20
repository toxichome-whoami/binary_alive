import { apiFetch } from './client';
import type { AuditLog, LoginAttemptLog, PaginatedResult, ApiResponse } from '../types';

export const logsApi = {
  getAuditLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc') =>
    apiFetch<ApiResponse<PaginatedResult<AuditLog>>>(`/logs/audit?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&dir=${dir}`),

  getLoginLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc') =>
    apiFetch<ApiResponse<PaginatedResult<LoginAttemptLog>>>(`/logs/login?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&dir=${dir}`),

  getTerminalLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc') =>
    apiFetch<ApiResponse<PaginatedResult<AuditLog>>>(`/logs/terminal?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&dir=${dir}`),
};
