import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Shield, Lock, User, ArrowRight } from 'lucide-react';
import type { CurrentUser } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleDevLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    const devUser: CurrentUser = {
      id: 1,
      username: username.trim() || 'admin',
      role: 'admin',
      hostname: 'localhost',
    };

    localStorage.setItem('binary_alive_dev_user', JSON.stringify(devUser));
    setUser(devUser);
    pushToast('success', `Welcome back, ${devUser.username}!`);
    navigate('/dashboard');
    window.location.hash = '/dashboard';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#000000] text-gray-100 selection:bg-brand selection:text-white select-none">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#141414] border border-[#262626] text-[#2f80ed] mb-3.5 shadow-sm">
            <Shield className="w-5 h-5 text-[#2f80ed]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Binary Alive
          </h1>
          <p className="text-xs text-[#8c8c8c] mt-1">
            Cloudflare-Protected Process Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0c0c0c] border border-[#222222] rounded-xl p-7 shadow-xl">
          {/* Dev Mode Banner */}
          <div className="mb-5 p-3 rounded-lg bg-[#141414] border border-[#2f80ed]/40 flex items-center justify-between text-xs text-[#d4d4d8]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#30a46c] animate-pulse"></span>
              <span className="font-medium text-white">Dev Mode Active</span>
            </div>
            <span className="text-[11px] text-[#8c8c8c]">Auth Bypassed</span>
          </div>

          <form onSubmit={handleDevLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#a1a1aa] mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#71717a]">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-[#27272a] bg-[#141414] text-white placeholder-[#71717a] focus:outline-none focus:border-[#2f80ed] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#a1a1aa] mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#71717a]">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-[#27272a] bg-[#141414] text-white placeholder-[#71717a] focus:outline-none focus:border-[#2f80ed] transition-colors"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDevLogin()}
              className="w-full mt-6 py-2.5 px-4 rounded-md bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1d4ed8] text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-none cursor-pointer"
            >
              <span>Log in</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-[11px] text-[#71717a]">
          Development mode · Click Log in to enter dashboard immediately
        </div>
      </div>
    </div>
  );
};
