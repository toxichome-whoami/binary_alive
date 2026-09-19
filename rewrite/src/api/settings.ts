import { apiFetch } from './client';
import type { ApiResponse } from '../types';

export interface SettingsResponse {
  enable_captcha: boolean;
  maintenance_mode: boolean;
  ai_provider?: string;
  ai_model?: string;
  ai_base_url?: string;
  has_ai_key?: boolean;
  version: string;
}

export interface AiSettingsPayload {
  provider: string;
  model: string;
  base_url: string;
  api_key?: string;
}

export const settingsApi = {
  get: () => apiFetch<ApiResponse<SettingsResponse>>('/settings'),

  toggle: (key: string, enabled: boolean) =>
    apiFetch<ApiResponse>('/settings/toggle', {
      method: 'POST',
      body: JSON.stringify({ key, enabled }),
    }),

  updateAi: (payload: AiSettingsPayload) =>
    apiFetch<ApiResponse>('/settings/ai', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
