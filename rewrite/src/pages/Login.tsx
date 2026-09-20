import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { authApi } from '../api/auth';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [isFirstRun, setIsFirstRun] = useState<boolean>(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState<boolean>(true);
  const [show2fa, setShow2fa] = useState<boolean>(false);
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [isOtpFocused, setIsOtpFocused] = useState<boolean>(false);

  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [captchaEnabled, setCaptchaEnabled] = useState<boolean>(false);
  const [captchaInput, setCaptchaInput] = useState<string>('');
  const [captchaKey, setCaptchaKey] = useState<number>(Date.now());
  const [isCaptchaFocused, setIsCaptchaFocused] = useState<boolean>(false);
  const [captchaValid, setCaptchaValid] = useState<boolean | null>(null);
  const captchaRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let mounted = true;
    if (captchaInput.length === 5) {
      authApi.verifyCaptcha(captchaInput).then(res => {
        if (mounted) setCaptchaValid(res.valid);
      }).catch(() => {
        if (mounted) setCaptchaValid(false);
      });
    } else {
      setCaptchaValid(null);
    }
    return () => { mounted = false; };
  }, [captchaInput, captchaKey]);

  useEffect(() => {
    let mounted = true;
    async function checkSetup() {
      try {
        const res = await authApi.getSetupStatus();
        if (mounted) {
          if (res.setup_mode) setIsFirstRun(true);
          if (res.captcha_enabled) setCaptchaEnabled(true);
        }
      } catch (err) {
        console.error('Failed to fetch setup status', err);
      } finally {
        if (mounted) setIsCheckingSetup(false);
      }
    }
    checkSetup();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (isFirstRun) {
      if (!username || !email || !password || !confirmPassword) {
        pushToast('error', 'Please fill in all fields to complete setup.');
        return;
      }
      if (password !== confirmPassword) {
        pushToast('error', 'Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        pushToast('error', 'Password must be at least 6 characters.');
        return;
      }
    } else {
      if (!username || !password) {
        pushToast('error', 'Please enter your username and password.');
        return;
      }
      if (captchaEnabled && !captchaInput) {
        pushToast('error', 'Please complete the CAPTCHA.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isFirstRun) {
        const res = await authApi.createFirstAdmin({ username: username.trim(), password, email: email.trim() });
        if (res.success) {
          pushToast('success', 'Master Administrator created successfully!');
          // Immediately log them in
          const loginRes = await authApi.login({ username: username.trim(), password });
          if (loginRes.success && loginRes.user) {
            setUser(loginRes.user);
            navigate('/dashboard');
          }
        }
      } else {
        const res = await authApi.login({ username: username.trim(), password, captcha: captchaInput, totp: show2fa ? twoFactorCode : undefined });
        if (res.success && res.user) {
          setUser(res.user);
          pushToast('success', `Welcome back, ${res.user.username}!`);
          navigate('/dashboard');
        } else if (res.requires_2fa) {
          setShow2fa(true);
          setTwoFactorCode('');
          pushToast('warn', 'Two-Factor Authentication required.');
        }
      }
    } catch (err: any) {
      if (err.data?.requires_2fa) {
        setShow2fa(true);
        setTwoFactorCode('');
        pushToast('warn', 'Two-Factor Authentication required.');
        return;
      }
      pushToast('error', err.message || 'Authentication failed');
      if (captchaEnabled) {
        setCaptchaKey(Date.now());
        setCaptchaInput('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0C]">
        <svg className="animate-spin h-8 w-8 text-[#2f80ed]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0B0C] text-gray-100 selection:bg-[#2f80ed] selection:text-white select-none font-['Inter',sans-serif]">
      <div className="w-full max-w-[420px] flex flex-col items-stretch py-8">
        
        {/* Brand header */}
        <div className="text-left mb-6">
          <h1 className="text-[20px] font-semibold text-balance text-white leading-snug">
            {isFirstRun ? 'Initialize Binary Alive' : show2fa ? 'Two-Factor Authentication' : 'Sign in to Binary Alive'}
          </h1>
          <p className="text-[13px] text-[#8c8c8c] mt-1.5 leading-normal">
            {isFirstRun ? 'Create the owner account to get started.' : show2fa ? 'Enter the 6-digit code from your authenticator app.' : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {show2fa && (
            <div className="flex flex-col mb-6">
              <label className="text-[14px] font-semibold mb-3 text-[#f2f2f2] tracking-tight text-center">Authentication Code</label>
              <div className="relative inline-flex items-center justify-center gap-1.5 select-none self-center">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^\d]/g, ''))}
                  onFocus={() => setIsOtpFocused(true)}
                  onBlur={() => setIsOtpFocused(false)}
                  className="absolute inset-0 opacity-0 cursor-text z-20 w-full h-full text-[14px]"
                  aria-label="6-digit authentication code"
                />

                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const digit = twoFactorCode[index] || '';
                  const isCurrent = isOtpFocused && (twoFactorCode.length === index || (index === 5 && twoFactorCode.length === 6));
                  return (
                    <React.Fragment key={index}>
                      {index === 3 && (
                        <span className="text-[#555555] font-mono text-[16px] select-none mx-0.5">-</span>
                      )}
                      <div
                        className={`w-[48px] h-[54px] rounded-[8px] flex items-center justify-center font-['JetBrains_Mono',monospace] text-[20px] font-semibold transition-all duration-150 select-none ${
                          isCurrent
                            ? 'border border-[#2f80ed] bg-[#0B0B0C] text-white ring-[1.5px] ring-[#2f80ed]/50 shadow-[0_0_10px_rgba(47,128,237,0.15)]'
                            : digit
                            ? 'border border-[#383838] bg-[#141414] text-white'
                            : 'border border-[#262626] bg-[#0B0B0C] text-[#555555]'
                        }`}
                      >
                        {digit}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: show2fa ? 'none' : 'block' }} className="space-y-4">
            <div>
            <label className="block text-[14px] font-medium text-white mb-2">
              {isFirstRun ? 'Owner Username' : 'Username or Email'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isFirstRun ? "e.g. system_admin" : "admin"}
              className="w-full h-10 px-3 py-2 text-[14px] rounded-[8px] border border-[#262626] bg-[#0B0B0C] text-white placeholder-[#525252] focus:outline-none focus:border-[#2f80ed] focus:ring-[1.5px] focus:ring-[#2f80ed]/50 transition-colors"
            />
          </div>

          {isFirstRun && (
            <div>
              <label className="block text-[14px] font-medium text-white mb-2">
                Owner Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="w-full h-10 px-3 py-2 text-[14px] rounded-[8px] border border-[#262626] bg-[#0B0B0C] text-white placeholder-[#525252] focus:outline-none focus:border-[#2f80ed] focus:ring-[1.5px] focus:ring-[#2f80ed]/50 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-[14px] font-medium text-white mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-10 px-3 py-2 text-[14px] rounded-[8px] border border-[#262626] bg-[#0B0B0C] text-white placeholder-[#525252] focus:outline-none focus:border-[#2f80ed] focus:ring-[1.5px] focus:ring-[#2f80ed]/50 transition-colors"
            />
          </div>

          {isFirstRun && (
            <div>
              <label className="block text-[14px] font-medium text-white mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-10 px-3 py-2 text-[14px] rounded-[8px] border border-[#262626] bg-[#0B0B0C] text-white placeholder-[#525252] focus:outline-none focus:border-[#2f80ed] focus:ring-[1.5px] focus:ring-[#2f80ed]/50 transition-colors"
              />
            </div>
          )}
          
          {!isFirstRun && captchaEnabled && (
            <div className="mt-4 flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[#f2f2f2] tracking-tight">Security Check</label>
              <div className="flex items-center gap-3 relative">
                <div 
                  className="group h-[46px] w-[140px] rounded-[8px] border border-[#2a2a2a] shrink-0 relative z-10 hover:z-50 cursor-pointer"
                  onClick={() => {
                    setCaptchaKey(Date.now());
                    setCaptchaInput('');
                  }}
                  title="Click to reload CAPTCHA"
                >
                  <img
                    src={`/api/auth/captcha?_t=${captchaKey}`}
                    alt="CAPTCHA"
                    className="w-full h-full object-cover rounded-[8px] transition-all duration-300 ease-out origin-left shadow-sm group-hover:scale-[1.6] group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8)] group-hover:-translate-y-2"
                  />
                </div>
                <div className="inline-flex items-center gap-1.5 flex-1">
                  {[0, 1, 2, 3, 4].map((index) => {
                    const char = captchaInput[index] || '';
                    
                    let stateClasses = 'border border-[#262626] bg-[#0B0B0C] text-white focus:border-[#2f80ed] focus:ring-[1.5px] focus:ring-[#2f80ed]/50';
                    if (captchaValid === true) {
                      stateClasses = 'border border-emerald-500 bg-[#0B0B0C] text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] focus:border-emerald-500 focus:ring-emerald-500/50';
                    } else if (captchaValid === false) {
                      stateClasses = 'border border-red-500 bg-[#0B0B0C] text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)] focus:border-red-500 focus:ring-red-500/50';
                    }

                    return (
                      <input
                        key={index}
                        ref={(el) => (captchaRefs.current[index] = el)}
                        type="text"
                        maxLength={2}
                        value={char}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
                          if (pasted) {
                            setCaptchaInput(pasted);
                            captchaRefs.current[Math.min(pasted.length, 4)]?.focus();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          const lastChar = val.slice(-1);
                          const newArr = captchaInput.padEnd(5, ' ').split('');
                          newArr[index] = lastChar || ' ';
                          const newStr = newArr.join('').trimEnd();
                          setCaptchaInput(newStr);
                          if (lastChar && index < 4) captchaRefs.current[index + 1]?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !char && index > 0) {
                            captchaRefs.current[index - 1]?.focus();
                          } else if (e.key === 'ArrowLeft' && index > 0) {
                            e.preventDefault();
                            captchaRefs.current[index - 1]?.focus();
                          } else if (e.key === 'ArrowRight' && index < 4) {
                            e.preventDefault();
                            captchaRefs.current[index + 1]?.focus();
                          }
                        }}
                        autoComplete="off"
                        className={`w-full min-w-0 h-[46px] rounded-[8px] text-center font-['JetBrains_Mono',monospace] text-[16px] font-semibold transition-all duration-200 outline-none caret-[#2f80ed] ${stateClasses}`}
                        required={index === 0}
                        aria-label={`Security code character ${index + 1}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!isFirstRun && (
            <div
              onClick={() => setRememberDevice(!rememberDevice)}
              className="flex items-start mt-4 mb-6 cursor-pointer select-none group"
            >
              <div className="flex h-5 items-center">
                <div
                  role="checkbox"
                  aria-checked={rememberDevice}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setRememberDevice(!rememberDevice);
                    }
                  }}
                  className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#2f80ed] ${
                    rememberDevice
                      ? 'bg-[#2f80ed] border-[#2f80ed] shadow-[0_1px_2px_rgba(47,128,237,0.4)]'
                      : 'bg-[#141414] border-[#333333] group-hover:border-[#4a4a4a]'
                  }`}
                >
                  {rememberDevice && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="11"
                      height="11"
                      viewBox="0 0 256 256"
                      fill="currentColor"
                      className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                    >
                      <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="ml-2.5 text-[13px] text-[#e5e5e5] group-hover:text-white transition-colors leading-5">
                Save email and login method on this device
              </span>
            </div>
          )}
          </div>

          <button
            type="submit"
            disabled={isLoading || (show2fa && twoFactorCode.length !== 6)}
            className={`group relative flex w-full items-center justify-center h-10 px-4 rounded-lg font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] ${isFirstRun ? 'mt-8' : 'mt-6'}`}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
            <span className="relative flex items-center justify-center gap-2 text-[14px]">
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>{isLoading ? 'Processing...' : (isFirstRun ? 'Complete Setup' : 'Sign in')}</span>
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
