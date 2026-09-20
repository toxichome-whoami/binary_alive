const API_BASE = '/api';

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
  sendChatMessage: async (message: string) => {
    const response = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  getHistory: async (page = 1, limit = 50) => {
    const response = await fetch(`${API_BASE}/ai/history?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch AI history');
    return response.json();
  },

  deleteHistory: async (id: number) => {
    const response = await fetch(`${API_BASE}/ai/history/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete history');
    return response.json();
  }
};
