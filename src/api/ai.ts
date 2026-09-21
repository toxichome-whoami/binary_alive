import { apiFetch } from './client';

export interface AiHistoryData {
  id: number;
  user_id: number;
  message: string;
  response: string;
  created_at: string;
  username?: string;
  email?: string;
}

export const aiApi = {
  sendChatMessage: async (message: string, history: any[] = [], context: any = {}) => {
    return apiFetch<any>(`/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history, context }),
    });
  },

  getHistory: async (page = 1, limit = 50, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return apiFetch<any>(`/ai/history?${params.toString()}`);
  },

  getMyHistory: async (page = 1, limit = 50) => {
    return apiFetch<any>(`/ai/my-history?page=${page}&limit=${limit}`);
  },

  getBounds: async () => {
    return apiFetch<any>(`/ai/bounds`);
  },

  deleteHistory: async (id: number) => {
    return apiFetch<any>(`/ai/history/${id}`, {
      method: 'DELETE',
    });
  }
};
