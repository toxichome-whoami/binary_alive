import { apiFetch } from './client';
import type { User, PaginatedResult, ApiResponse, Permissions } from '../types';

export interface CreateUserPayload {
  username: string;
  email?: string;
  password: string;
  permissions?: Permissions;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  password?: string;
  permissions?: Permissions;
  is_disabled?: boolean;
}

export const usersApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<ApiResponse<PaginatedResult<User>>>(`/users?page=${page}&limit=${limit}`),

  create: (payload: CreateUserPayload) =>
    apiFetch<ApiResponse<{ id: number }>>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: UpdateUserPayload) =>
    apiFetch<ApiResponse>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  disable: (id: number) =>
    apiFetch<ApiResponse>(`/users/${id}/disable`, {
      method: 'POST',
    }),

  enable: (id: number) =>
    apiFetch<ApiResponse>(`/users/${id}/enable`, {
      method: 'POST',
    }),

  delete: (id: number) =>
    apiFetch<ApiResponse>(`/users/${id}`, {
      method: 'DELETE',
    }),

  generateToken: (id: number) =>
    apiFetch<ApiResponse<{ token: string }>>(`/users/${id}/token`, {
      method: 'POST',
    }),

  revokeToken: (id: number) =>
    apiFetch<ApiResponse>(`/users/${id}/token`, {
      method: 'DELETE',
    }),

  remove2fa: (id: number) =>
    apiFetch<ApiResponse>(`/users/${id}/2fa`, {
      method: 'DELETE',
    }),

  updateAiPermissions: (permissions: Permissions | null) =>
    apiFetch<ApiResponse>(`/users/me/ai_permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ ai_permissions: permissions }),
    }),
};
