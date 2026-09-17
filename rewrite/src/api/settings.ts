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

  exportConfigUrl: () => '/api/settings/export/config',
  exportDbUrl: () => '/api/settings/export/db',

  importConfig: (formData: FormData) =>
    apiFetch<ApiResponse>('/settings/import/config', {
      method: 'POST',
      body: formData,
    }),
};
