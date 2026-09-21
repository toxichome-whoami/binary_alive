import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { aiApi, AiHistoryData } from '../api/ai';
import { Bot, Trash2 } from 'lucide-react';

export const AiHistory: React.FC = () => {
  const { isOwner } = useAuthStore();
  const [history, setHistory] = useState<AiHistoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await aiApi.getHistory(1, 100);
      if (res.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner()) {
      fetchHistory();
    } else {
      setIsLoading(false);
    }
  }, [isOwner, fetchHistory]);

  useEffect(() => {
    const handleUpdate = () => {
      if (isOwner()) fetchHistory();
    };
    window.addEventListener('ai-history-updated', handleUpdate);
    return () => window.removeEventListener('ai-history-updated', handleUpdate);
  }, [isOwner, fetchHistory]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this AI conversation history?')) return;
    try {
      const res = await aiApi.deleteHistory(id);
      if (res.success) {
        setHistory(history.filter(h => h.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOwner()) {
    return (
      <div className="w-full h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Bot className="w-12 h-12 text-[#383838] mx-auto" />
          <h2 className="text-[18px] font-medium text-white">Access Denied</h2>
          <p className="text-[14px] text-[#8c8c8c]">Only owners can view AI History.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-white tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-brand" />
            AI History
          </h1>
          <p className="text-[14px] text-[#8c8c8c] mt-1">
            Live feed of all AI Assistant interactions across the platform.
          </p>
        </div>
      </div>

      <div className="bg-[#0e0e0e] border border-[#26282A] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#26282A] bg-[#161718]">
                <th className="px-4 py-3 text-[13px] font-medium text-[#8c8c8c]">User</th>
                <th className="px-4 py-3 text-[13px] font-medium text-[#8c8c8c] w-1/3">Message</th>
                <th className="px-4 py-3 text-[13px] font-medium text-[#8c8c8c] w-1/3">Response</th>
                <th className="px-4 py-3 text-[13px] font-medium text-[#8c8c8c]">Time</th>
                <th className="px-4 py-3 text-[13px] font-medium text-[#8c8c8c] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26282A]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#8c8c8c] text-[14px]">
                    Loading...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#8c8c8c] text-[14px]">
                    No AI history found.
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-[#121314] transition-colors group">
                    <td className="px-4 py-3 text-[14px] text-white">
                      <div>{record.username || `User #${record.user_id}`}</div>
                      <div className="text-[12px] text-[#8c8c8c]">{record.email}</div>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-[#d4d4d4] whitespace-pre-wrap">
                      {record.message}
                    </td>
                    <td className="px-4 py-3 text-[14px] text-[#8c8c8c] whitespace-pre-wrap">
                      {record.response}
                    </td>
                    <td className="px-4 py-3 text-[14px] text-[#8c8c8c] whitespace-nowrap">
                      {new Date(record.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-1.5 text-[#8c8c8c] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
