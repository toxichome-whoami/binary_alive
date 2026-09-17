import { apiFetch } from './client';
import type { TerminalResponse } from '../types';

export const terminalApi = {
  execute: (cmd: string) =>
    apiFetch<TerminalResponse>('/terminal', {
      method: 'POST',
      body: JSON.stringify({ cmd }),
    }),
};
