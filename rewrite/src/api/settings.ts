import { apiFetch } from './client';
import type { ApiResponse } from '../types';

export interface SettingsResponse {
  enable_captcha: boolean;
  version: string;
}

export const settingsApi = {
  get: () => apiFetch<ApiResponse<SettingsResponse>>('/settings'),

  toggleCaptcha: (enabled: boolean) =>
    apiFetch<ApiResponse>('/settings/captcha', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
};
