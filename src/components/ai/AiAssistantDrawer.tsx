import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import { Send, Sparkles, X, Settings as SettingsIcon, ChevronLeft, Clock, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { PermissionTable } from '../shared/PermissionTable';
import { aiApi, type AiHistoryData } from '../../api/ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Permissions } from '../../types';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [myHistory, setMyHistory] = useState<AiHistoryData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'bot', content: string}[]>([]);
  

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, chatHistory]);

  const handleNewChat = () => {
    setChatHistory([]);
    setIsHistoryOpen(false);
  };

  const [isTyping, setIsTyping] = useState(false);
  const { user, hasPermission } = useAuthStore();
  const canAccessAi = hasPermission('ai_access');

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await aiApi.getMyHistory();
      if (res.success) {
        setMyHistory(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

    const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const msg = inputValue.trim();
    setInputValue('');
    
    // take the last 4 messages for context to save tokens
    const historyContext = chatHistory.slice(-4);
    
    setChatHistory(prev => [...prev, { role: 'user', content: msg }].slice(-100));
    setIsTyping(true);

    try {
      const context = { currentPage: window.location.pathname };
      const res = await aiApi.sendChatMessage(msg, historyContext, context);
      if (res.success) {
        setChatHistory(prev => [...prev, { role: 'bot', content: res.data.response }].slice(-100));
        // refresh history in background if open
        if (isHistoryOpen) loadHistory();
      } else {
        setChatHistory(prev => [...prev, { role: 'bot', content: 'Error: Could not get response.' }].slice(-100));
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'bot', content: `Error: Request failed. Details: ${err?.message || err}` }].slice(-100));
    } finally {
      setIsTyping(false);
    }
  };

  // Track the subset of permissions the user explicitly grants to the AI session
  const [aiPermissions, setAiPermissions] = useState<Permissions | null>(null);
  const [lastUserId, setLastUserId] = useState<number | null>(null);

  // Initialize the AI permissions based on what the user actually has
  useEffect(() => {
    if (user) {
      if (user.id !== lastUserId || !aiPermissions) {
        setLastUserId(user.id);
        setAiPermissions({ ...user.permissions });
      }
    } else {
      setAiPermissions(null);
      setLastUserId(null);
    }
  }, [user, aiPermissions, lastUserId]);

  if (!canAccessAi) return null;

  // Calculate which permissions should be disabled (user doesn't have them)
  const disabledPermissions = Object.keys(aiPermissions || {}).reduce((acc, key) => {
    // If they aren't the owner and they don't have this permission, disable the toggle
    if (user?.role !== 'owner' && !user?.permissions[key as keyof Permissions]) {
      acc[key as keyof Permissions] = true;
    }
    return acc;
  }, {} as Partial<Record<keyof Permissions, boolean>>);

  return (
    <aside 
      className={cn(
        "shrink-0 bg-[#0B0B0C] flex flex-col h-screen sticky top-0 transition-[width,border-color] duration-200 z-30 overflow-hidden",
        isOpen ? "w-[320px] md:w-[360px] border-l border-[#222222]" : "w-0 border-l-transparent border-l-0"
      )}
    >
      {/* Header */}
      <div className="h-[58px] border-b border-[#222222] flex items-center justify-between px-4 shrink-0 w-[320px] md:w-[360px]">
        {isSettingsOpen || isHistoryOpen ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsSettingsOpen(false);
                setIsHistoryOpen(false);
              }}
              className="p-1 -ml-1 text-[#8c8c8c] hover:text-white rounded-lg hover:bg-[#161616] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-[14px] font-medium text-white">{isHistoryOpen ? 'Chat History' : 'AI Permissions'}</h2>
          </div>
        ) : (
          <h2 className="text-[14px] font-medium text-white">AI Assistant</h2>
        )}
        <div className="flex items-center gap-1">
          {!isSettingsOpen && !isHistoryOpen && (
            <>
              <button
                onClick={handleNewChat}
                className="p-1.5 text-[#8c8c8c] hover:text-white rounded-lg hover:bg-[#161616] transition-colors"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsHistoryOpen(true);
                  loadHistory();
                }}
                className="p-1.5 text-[#8c8c8c] hover:text-white rounded-lg hover:bg-[#161616] transition-colors"
                title="View History"
              >
                <Clock className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-[#8c8c8c] hover:text-white rounded-lg hover:bg-[#161616] transition-colors"
                title="Configure AI Session Permissions"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-[#8c8c8c] hover:text-white rounded-lg hover:bg-[#161616] transition-colors"
            title="Close AI Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isSettingsOpen ? (
        /* Settings Area */
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[#222222] w-[320px] md:w-[360px]">
          <div className="mb-4">
            <p className="text-[13px] text-[#A1A1A1] leading-relaxed">
              Limit what this AI can access and perform on your behalf.
            </p>
          </div>
          {aiPermissions && (
            <PermissionTable
              value={aiPermissions}
              onChange={setAiPermissions}
              disabled={disabledPermissions}
            />
          )}
        </div>
      ) : isHistoryOpen ? (
        /* History Area */
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[#222222] w-[320px] md:w-[360px] flex flex-col gap-4">
          {isLoadingHistory ? (
            <div className="text-center text-[#8c8c8c] text-[13px] mt-4">Loading history...</div>
          ) : myHistory.length === 0 ? (
            <div className="text-center text-[#8c8c8c] text-[13px] mt-4">No history found.</div>
          ) : (
            myHistory.map(item => (
              <div key={item.id} className="bg-[#161718] border border-[#26282A] rounded-lg p-3">
                <div className="text-[12px] text-[#8c8c8c] mb-2">{new Date(item.created_at).toLocaleString()}</div>
                <div className="text-[13px] text-white mb-2 font-medium">You: {item.message}</div>
                <div className="text-[13px] text-[#A1A1A1] line-clamp-3">AI: {item.response}</div>
                <button 
                  onClick={() => {
                    // Start a new chat seeded with this history item
                    setChatHistory([
                      { role: 'user', content: item.message },
                      { role: 'bot', content: item.response }
                    ]);
                    setIsHistoryOpen(false);
                  }}
                  className="mt-3 w-full py-1.5 text-[12px] font-medium text-white bg-[#222222] hover:bg-[#333333] rounded transition-colors"
                >
                  Resume from here
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-[#222222] w-[320px] md:w-[360px] flex flex-col gap-4">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center mt-8 mb-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#161718] border border-[#26282A] flex items-center justify-center shadow-sm mb-1">
                  <Sparkles className="w-6 h-6 text-[#A1A1A1]" />
                </div>
                <h3 className="text-[16px] font-medium text-white tracking-tight">
                  How can I assist you today?
                </h3>
                <p className="text-[13px] text-[#8c8c8c] max-w-[280px] leading-relaxed">
                  Monitor processes, inspect audit logs, run shell commands, or manage API keys.
                </p>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}>
                  <div className={`px-3 py-2 rounded-lg text-[13px] ${msg.role === 'user' ? 'whitespace-pre-wrap bg-[#2f80ed] text-white selection:bg-white/30' : 'bg-[#161718] border border-[#26282A] text-[#d4d4d4] w-full markdown-body selection:bg-[#2f80ed] selection:text-white'}`}>
                    {msg.role === 'user' ? msg.content : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))
            )}
            {isTyping && (
              <div className="flex items-start">
                <div className="px-3 py-2 rounded-lg bg-[#161718] border border-[#26282A] text-[#8c8c8c] text-[13px]">
                  Typing...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#0B0B0C] border-t border-[#26282A] shrink-0 w-[320px] md:w-[360px]">
            <div className="relative flex items-center bg-[#161718] border border-[#26282A] rounded-[8px] focus-within:border-[#383838] focus-within:ring-1 focus-within:ring-[#383838] transition-all">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Ask anything..."
                rows={1}
                className="w-full bg-transparent border-none text-[14px] text-white placeholder-[#A1A1A1] px-4 py-3 pr-10 outline-none resize-none overflow-y-auto max-h-[150px]"
                style={{ minHeight: '44px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputValue.trim()) {
                      handleSendMessage();
                      e.currentTarget.style.height = 'auto';
                    }
                  }
                }}
              />
                <button
                  disabled={!inputValue.trim() || isTyping}
                  onClick={() => {
                    handleSendMessage();
                    if (textareaRef.current) textareaRef.current.style.height = 'auto';
                  }}
                  className="absolute right-2 bottom-[6px] p-1.5 text-[#A1A1A1] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-[6px] hover:bg-[#26282A] transition-colors"
                >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center mt-3">
              <p className="text-[11px] text-[#A1A1A1]">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
