import { apiFetch } from './client';
import type { Process, StatusResponse, ApiResponse } from '../types';

export interface CreateProcessPayload {
  name: string;
  group_name?: string;
  command: string;
  working_dir?: string;
  log_file?: string;
}

export interface UpdateProcessPayload extends Partial<CreateProcessPayload> {
  auto_restart?: boolean | number;
}

export const processesApi = {
  getStatus: () => apiFetch<StatusResponse>('/processes'),
    getTelemetryBounds: () => apiFetch<ApiResponse<{ min_time: string | null }>>('/processes/telemetry/bounds'),
  getTelemetry: (minutes: number, start?: string, end?: string) => apiFetch<ApiResponse<any[]>>(`/processes/telemetry?minutes=${minutes}${start && end ? `&start=${start}&end=${end}` : ''}`),


  getOne: (id: number) => apiFetch<ApiResponse<{ process: Process }>>(`/processes/${id}`),

  create: (payload: CreateProcessPayload) =>
    apiFetch<ApiResponse<{ id: number }>>('/processes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: UpdateProcessPayload) =>
    apiFetch<ApiResponse>(`/processes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (id: number) =>
    apiFetch<ApiResponse>(`/processes/${id}`, {
      method: 'DELETE',
    }),

  control: (id: number, cmd: 'start' | 'stop' | 'restart') =>
    apiFetch<ApiResponse<{ pid?: number }>>(`/processes/${id}/control`, {
      method: 'POST',
      body: JSON.stringify({ cmd }),
    }),

  bulkControl: (ids: number[], cmd: 'start' | 'stop' | 'restart') =>
    apiFetch<ApiResponse<{ results: Record<number, { success: boolean; pid?: number }> }>>('/processes/bulk/control', {
      method: 'POST',
      body: JSON.stringify({ ids, cmd }),
    }),
};
