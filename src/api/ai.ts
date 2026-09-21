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
  sendChatMessage: async (message: string, history: any[] = []) => {
    return apiFetch<any>(`/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  getHistory: async (page = 1, limit = 50) => {
    return apiFetch<any>(`/ai/history?page=${page}&limit=${limit}`);
  },

  getMyHistory: async (page = 1, limit = 50) => {
    return apiFetch<any>(`/ai/my-history?page=${page}&limit=${limit}`);
  },

  deleteHistory: async (id: number) => {
    return apiFetch<any>(`/ai/history/${id}`, {
      method: 'DELETE',
    });
  }
};
