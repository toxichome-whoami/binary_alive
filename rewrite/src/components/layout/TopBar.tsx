import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { Menu, Sun, Moon, LogOut, ShieldCheck, Users, Settings as SettingsIcon } from 'lucide-react';
import { RoleBadge } from '../shared/RoleBadge';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, isMasterAdmin, setUser } = useAuthStore();
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

  const displayEmail = user?.username ? `${user.username}@gmail.com` : 'Mrtx18427@gmail.com';

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

        {/* 2. Support Link Button (Exact SVG from conter.html) */}
        <a
          data-kumo-component="LinkButton"
          className="group w-max shrink-0 font-medium border-0 focus:outline-none cursor-pointer gap-1.5 rounded-lg px-3 text-sm text-[#d4d4d4] hover:text-white hover:bg-[#161616] shadow-none bg-inherit flex items-center no-underline select-text h-8 transition-colors"
          href="https://developers.cloudflare.com"
          target="_blank"
          rel="noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 256 256"
            className="w-4 h-4 text-[#8c8c8c] group-hover:text-white transition-colors"
          >
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,168a12,12,0,1,1,12-12A12,12,0,0,1,128,192Zm8-48.72V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36s40,16.15,40,36C168,125.38,154.24,139.93,136,143.28Z" />
          </svg>
          <span className="contents">
            <span className="hidden md:inline">
              <span>Support</span>
            </span>
          </span>
        </a>

        {/* 3. User Menu Button (Exact SVG from conter.html) */}
        <div className="relative" ref={userMenuRef}>
          <button
            data-kumo-component="Button"
            className="group flex shrink-0 font-medium select-none border-0 focus:outline-none cursor-pointer gap-1.5 rounded-lg text-sm items-center justify-center p-0 text-[#8c8c8c] hover:text-white hover:bg-[#161616] shadow-none bg-inherit size-8 transition-colors"
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
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#121212] border border-[#262626] rounded-lg shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95">
              {/* Account header info */}
              <div className="px-3 py-2.5 border-b border-[#222222]">
                <div className="text-xs font-semibold text-white truncate">{displayEmail}</div>
                <div className="mt-1 flex items-center justify-between">
                  <RoleBadge role={user?.role || 'admin'} isMaster={isMasterAdmin()} />
                  <span className="text-[10px] text-[#8c8c8c]">UID: #{user?.id || '1'}</span>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/users');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-[#8c8c8c]" />
                  <span>Members & Roles</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/2fa');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8c8c8c]" />
                  <span>Two-Factor Security</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-[#8c8c8c]" />
                  <span>Configurations</span>
                </button>

                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isDark ? (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
                  </div>
                  <span className="text-[10px] text-[#8c8c8c] font-mono">
                    {isDark ? 'Dark' : 'Light'}
                  </span>
                </button>
              </div>

              {/* Sign out footer */}
              <div className="pt-1 border-t border-[#222222]">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-[#201214] rounded-md transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
