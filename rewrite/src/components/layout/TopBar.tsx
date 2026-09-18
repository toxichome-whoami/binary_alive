import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { Menu, Sun, Moon, LogOut, ShieldCheck, Users, Settings as SettingsIcon, FileText } from 'lucide-react';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, isMasterAdmin, isAdmin, setUser } = useAuthStore();
  const [isDark, setIsDark] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    }
    localStorage.removeItem('api_token');
    localStorage.removeItem('binary_alive_dev_user');
    setUser(null);
    navigate('/login');
  };

  return (
    <header
      className="h-[58px] bg-[#000000] shrink-0 border-b border-[#222222] flex items-center px-4 z-20 sticky top-0 gap-2 select-none"
      data-sentry-component="CollapsedHeaderInner"
      data-sentry-source-file="CollapsedHeader.tsx"
    >
      {/* Mobile drawer toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 -ml-1 text-[#8c8c8c] hover:text-white rounded-lg md:hidden hover:bg-[#161616] transition-colors"
        aria-label="Toggle navigation"
        type="button"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Left empty container matching Cloudflare CollapsedHeader */}
      <div></div>

      {/* Right controls matching Cloudflare CollapsedHeader */}
      <div className="ml-auto flex items-center gap-1">
        {/* 1. Ask AI Button (Exact SVG from conter.html) */}
        <button
          data-kumo-component="Button"
          className="group flex w-max shrink-0 items-center font-medium select-none border-0 focus:outline-none cursor-pointer gap-1.5 rounded-lg px-3 text-sm text-[#d4d4d4] hover:text-white hover:bg-[#161616] shadow-none bg-inherit h-8 transition-colors"
          type="button"
          onClick={() => navigate('/terminal')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 256 256"
            className="w-4 h-4 -translate-y-px text-neutral-500 group-hover:text-white transition-colors"
          >
            <path d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" />
          </svg>
          <span className="contents">
            <span className="hidden md:inline-flex items-center gap-2">
              <span>Ask AI</span>
            </span>
          </span>
        </button>
        {/* 2. User Menu Button */}
        <div className="relative" ref={userMenuRef}>
          <button
            data-kumo-component="Button"
            className={`group flex shrink-0 font-medium select-none border-0 focus:outline-none cursor-pointer gap-1.5 rounded-lg text-sm items-center justify-center p-0 shadow-none size-8 transition-colors ${
              isUserMenuOpen
                ? 'text-white bg-[#1a1a1a]'
                : 'text-[#8c8c8c] hover:text-white hover:bg-[#161616]'
            }`}
            type="button"
            aria-label="User menu"
            data-testid="kumo-user-dropdown-button"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
              className="w-4 h-4 text-[#8c8c8c] group-hover:text-white transition-colors"
            >
              <path d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z" />
            </svg>
          </button>

          {/* User Dropdown Menu Popover */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-[260px] bg-[#0e0e0e] border border-[#262626] rounded-xl shadow-2xl p-1.5 z-50 select-none animate-in fade-in zoom-in-95 font-sans">
              {/* Account info header */}
              <div className="p-2.5 rounded-lg bg-[#141414] border border-[#1f1f1f] mb-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[14px] font-medium text-white truncate leading-tight">
                    {user?.username || 'admin'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-[#8c8c8c] bg-[#1a1a1a] border border-[#262626] capitalize shrink-0">
                    {isMasterAdmin() ? 'Master' : user?.role || 'Admin'}
                  </span>
                </div>
                <p className="text-[13px] text-[#8c8c8c] truncate leading-tight mt-1">
                  {user?.hostname ? `${user.username}@${user.hostname}` : `${user?.username || 'admin'}@localhost`}
                </p>
              </div>

              {/* Navigation Items */}
              <div className="space-y-0.5 py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[14px] font-normal text-[#d4d4d4] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer text-left"
                >
                  <SettingsIcon className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                  <span>Settings</span>
                </button>

                {isAdmin() && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/users');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[14px] font-normal text-[#d4d4d4] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <Users className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                    <span>Users & Access</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/2fa');
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[14px] font-normal text-[#d4d4d4] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer text-left"
                >
                  <ShieldCheck className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                  <span>Two-Factor Security</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/logs');
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[14px] font-normal text-[#d4d4d4] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer text-left"
                >
                  <FileText className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                  <span>Audit Logs</span>
                </button>
              </div>

              {/* Edge-to-edge line through padding */}
              <div className="-mx-1.5 h-px bg-[#222222] my-1.5" />

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[14px] font-normal text-[#d4d4d4] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  {isDark ? (
                    <Moon className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                  ) : (
                    <Sun className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                  )}
                  <span>Theme</span>
                </div>
                <span className="text-[13px] text-[#8c8c8c] font-normal">
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </button>

              {/* Edge-to-edge line through padding */}
              <div className="-mx-1.5 h-px bg-[#222222] my-1.5" />

              {/* Sign out */}
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[14px] font-normal text-[#d4d4d4] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4 text-[#8c8c8c] shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
