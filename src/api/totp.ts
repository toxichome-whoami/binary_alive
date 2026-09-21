import { apiFetch } from './client';
import type { ApiResponse } from '../types';

export interface TotpSetupResponse {
  secret: string;
  otpauth_url: string;
}

export const totpApi = {
  setup: () => apiFetch<ApiResponse<TotpSetupResponse>>('/2fa/setup'),

  enable: (secret: string, code: string) =>
    apiFetch<ApiResponse>('/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret, code }),
    }),

  disable: (password: string, token: string) =>
    apiFetch<ApiResponse>('/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, token }),
    }),
};
