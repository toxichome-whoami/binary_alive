import { apiFetch } from './client';
import type { ApiToken, ApiResponse } from '../types';
import type { Permissions } from '../types';

export interface CreateApiTokenPayload {
  name: string;
  permissions: Permissions;
  expires_at?: string | null;
}

export interface UpdateApiTokenPayload {
  name?: string;
  permissions?: Permissions;
}

export const apiTokensApi = {
  list: () =>
    apiFetch<ApiResponse<ApiToken[]>>('/api-tokens'),

  listAll: () =>
    apiFetch<ApiResponse<ApiToken[]>>('/api-tokens/all'),

  create: (payload: CreateApiTokenPayload) =>
    apiFetch<ApiResponse<{ id: number; token: string }>>('/api-tokens', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: UpdateApiTokenPayload) =>
    apiFetch<ApiResponse>('/api-tokens/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  disable: (id: number) =>
    apiFetch<ApiResponse>('/api-tokens/' + id + '/disable', {
      method: 'POST',
    }),

  enable: (id: number) =>
    apiFetch<ApiResponse>('/api-tokens/' + id + '/enable', {
      method: 'POST',
    }),

  delete: (id: number) =>
    apiFetch<ApiResponse>('/api-tokens/' + id, {
      method: 'DELETE',
    }),
};
