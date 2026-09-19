import { apiFetch } from './client';
import type { CurrentUser, ApiResponse } from '../types';

export interface LoginPayload {
  username: string;
  password: string;
  totp?: string;
  captcha?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: CurrentUser;
  requires_2fa?: boolean;
}

export interface SetupStatusResponse {
  setup_mode: boolean;
  captcha_enabled?: boolean;
}

export const authApi = {
  me: () => apiFetch<ApiResponse<{ user: CurrentUser }>>('/auth/me'),
  
  login: (payload: LoginPayload) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    apiFetch<ApiResponse>('/auth/logout', {
      method: 'POST',
    }),

  getSetupStatus: () =>
    apiFetch<SetupStatusResponse>('/auth/setup'),

  createFirstAdmin: (payload: { username: string; password: string; email?: string }) =>
    apiFetch<ApiResponse>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyCaptcha: (answer: string) =>
    apiFetch<{ valid: boolean }>('/auth/captcha/verify', {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),
};
