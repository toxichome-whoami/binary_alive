import { apiFetch } from './client';
import type { User, PaginatedResult, ApiResponse, Role } from '../types';

export interface CreateUserPayload {
  username: string;
  password: string;
  role: Role;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  role?: Role;
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
};
