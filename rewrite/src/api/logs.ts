import { apiFetch } from './client';
import type { AuditLog, LoginAttemptLog, PaginatedResult, ApiResponse } from '../types';

export const logsApi = {

  getMetrics: (start?: string, end?: string) =>
    apiFetch<ApiResponse<any>>(`/logs/metrics?${start ? `start=${start}` : ''}${end ? `&end=${end}` : ''}`),

  getAuditLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc', start?: string, end?: string) =>
    apiFetch<ApiResponse<PaginatedResult<AuditLog>>>(`/logs/audit?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&dir=${dir}${start ? `&start=${start}` : ''}${end ? `&end=${end}` : ''}`),

  getLoginLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc', start?: string, end?: string) =>
    apiFetch<ApiResponse<PaginatedResult<LoginAttemptLog>>>(`/logs/login?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&dir=${dir}${start ? `&start=${start}` : ''}${end ? `&end=${end}` : ''}`),

  getTerminalLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc', start?: string, end?: string) =>
    apiFetch<ApiResponse<PaginatedResult<AuditLog>>>(`/logs/terminal?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&dir=${dir}${start ? `&start=${start}` : ''}${end ? `&end=${end}` : ''}`),
  getBounds: () =>
    apiFetch<ApiResponse<{ min_time: string | null; max_time: string | null }>>('/logs/bounds'),

};
