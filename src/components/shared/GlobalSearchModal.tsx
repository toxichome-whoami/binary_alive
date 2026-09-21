import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Users, Key, Activity, FileText, Settings, Terminal, Bot, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SearchItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
}

const ALL_ITEMS: SearchItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: Home },
  { id: 'users', label: 'Users Management', path: '/users', icon: Users, permission: 'users_view' },
  { id: 'api_keys', label: 'API Keys', path: '/api-keys', icon: Key, permission: 'api_keys_view' },
  { id: 'processes', label: 'Process Control', path: '/processes', icon: Activity, permission: 'processes_view' },
  { id: 'logs', label: 'Audit & Telemetry', path: '/logs', icon: FileText, permission: 'logs_view_audit' },
  { id: 'settings', label: 'System Settings', path: '/settings', icon: Settings, permission: 'settings_view' },
  { id: 'terminal', label: 'Terminal Console', path: '/terminal', icon: Terminal, permission: 'terminal_access' },
  { id: 'ai', label: 'AI Assistant', path: '/ai-assistant', icon: Bot, permission: 'ai_access' },
];

export const GlobalSearchModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { hasPermission, isOwner } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    const handleCustomOpen = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-global-search', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-global-search', handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const availableItems = [
    ...ALL_ITEMS.filter((item) => !item.permission || hasPermission(item.permission as any)),
    ...(isOwner() ? [{ id: 'ai-history', label: 'AI History', path: '/ai-history', icon: Sparkles }] : []),
  ];

  const filteredItems = availableItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    setIsOpen(false);
    if (path === '/ai-assistant') {
      window.dispatchEvent(new CustomEvent('open-ai-panel'));
    } else {
      navigate(path);
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex].path);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-lg bg-[#0c0c0c] border border-[#262626] rounded-[10px] shadow-2xl p-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#0e0e0e] border border-[#222222] rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center px-4 py-3 border-b border-[#222222]">
            <Search className="w-5 h-5 text-[#8c8c8c] mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-white placeholder-[#8c8c8c]"
              placeholder="Search for pages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleModalKeyDown}
            />
            <kbd className="ml-2 font-sans text-[10px] font-semibold text-[#8c8c8c] bg-[#1a1a1a] px-2 py-1 rounded border border-[#262626] select-none">
              ESC
            </kbd>
          </div>
        
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8c8c8c] text-sm">
              No results found for "{query}"
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.path)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#8c8c8c] hover:bg-[#111111] hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-3 ${index === selectedIndex ? 'opacity-100' : 'opacity-60'}`} />
                  {item.label}
                </button>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
