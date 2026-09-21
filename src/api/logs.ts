import { apiFetch } from './client';
import type { AuditLog, LoginAttemptLog, PaginatedResult, ApiResponse } from '../types';

export const logsApi = {

  getMetrics: (start?: string, end?: string) => {
    const qs = new URLSearchParams();
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    return apiFetch<ApiResponse<any>>(`/logs/metrics?${qs.toString()}`);
  },

  getAuditLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc', start?: string, end?: string) => {
    const qs = new URLSearchParams();
    qs.set('page', page.toString());
    qs.set('limit', limit.toString());
    if (search) qs.set('search', search);
    qs.set('sort', sort);
    qs.set('dir', dir);
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    return apiFetch<ApiResponse<PaginatedResult<AuditLog>>>(`/logs/audit?${qs.toString()}`);
  },

  getLoginLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc', start?: string, end?: string) => {
    const qs = new URLSearchParams();
    qs.set('page', page.toString());
    qs.set('limit', limit.toString());
    if (search) qs.set('search', search);
    qs.set('sort', sort);
    qs.set('dir', dir);
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    return apiFetch<ApiResponse<PaginatedResult<LoginAttemptLog>>>(`/logs/login?${qs.toString()}`);
  },

  getTerminalLogs: (page = 1, limit = 20, search = '', sort = 'timestamp', dir = 'desc', start?: string, end?: string) => {
    const qs = new URLSearchParams();
    qs.set('page', page.toString());
    qs.set('limit', limit.toString());
    if (search) qs.set('search', search);
    qs.set('sort', sort);
    qs.set('dir', dir);
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    return apiFetch<ApiResponse<PaginatedResult<AuditLog>>>(`/logs/terminal?${qs.toString()}`);
  },
  getBounds: () =>
    apiFetch<ApiResponse<{ min_time: string | null; max_time: string | null }>>('/logs/bounds'),

};
