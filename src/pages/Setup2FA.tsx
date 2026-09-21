import React, { useState, useEffect, useRef } from 'react';
import { totpApi } from '../api/totp';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog } from '../components/ui/Dialog';
import { Check, Copy, ShieldCheck, Smartphone } from 'lucide-react';

export const Setup2FA: React.FC = () => {
  const { user } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [is2faEnabled, setIs2faEnabled] = useState<boolean>(false);
  const [secret, setSecret] = useState<string>('');
  const [otpauthUrl, setOtpauthUrl] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [isOtpFocused, setIsOtpFocused] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Disable dialog state
  const [isDisableOpen, setIsDisableOpen] = useState<boolean>(false);
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [disable2faCode, setDisable2faCode] = useState<string>('');
  const [disableLoading, setDisableLoading] = useState<boolean>(false);

  useEffect(() => {
    loadSetup();

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetUserId = customEvent.detail?.targetUserId;
      // Setup2FA is for the current user. Only reset if the event targets us or is global.
      if (targetUserId && targetUserId !== user?.id) {
        return;
      }
      loadSetup();
    };
    
    window.addEventListener('users-refresh', handleRefresh);
    return () => window.removeEventListener('users-refresh', handleRefresh);
  }, []);

  const loadSetup = async () => {
    try {
      const res = await totpApi.setup();
      if (res.success && res.data) {
        setSecret(res.data.secret);
        setOtpauthUrl(res.data.otpauth_url);
        setIs2faEnabled(false);
      }
    } catch {
      setIs2faEnabled(true);
    }
  };

  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopySecret = async () => {
    if (secret) {
      try {
        await navigator.clipboard.writeText(secret);
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        pushToast('error', 'Failed to copy secret');
      }
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setIsLoading(true);

    try {
      const res = await totpApi.enable(secret, verifyCode.trim());
      if (res.success) {
        pushToast('success', 'Two-Factor Authentication enabled');
        setIs2faEnabled(true);
        setVerifyCode('');
      } else {
        pushToast('error', res.message || 'Invalid 2FA code');
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordConfirm || !disable2faCode) return;
    setDisableLoading(true);

    try {
      const res = await totpApi.disable(passwordConfirm, disable2faCode);
      if (res.success) {
        pushToast('success', 'Two-Factor Authentication disabled');
        setIs2faEnabled(false);
        setIsDisableOpen(false);
        setPasswordConfirm('');
        setDisable2faCode('');
        loadSetup();
      } else {
        pushToast('error', res.message || 'Incorrect password');
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-5">
      {/* Page Header — Technical Minimalism */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[20px] font-semibold text-white tracking-tight">Two-Factor Authentication</h1>
        <p className="text-[14px] text-[#8c8c8c]">
          Configure time-based one-time password (TOTP) verification for account access.
        </p>
      </div>

      {/* Cloudflare Signature Double-Border Container */}
      <div className="w-full flex flex-col rounded-[8px] border border-[#222222] bg-black shadow-sm">
        {/* Outer Frame Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#8c8c8c]" />
            <span className="text-[16px] font-medium text-white">Authenticator App</span>
          </div>
        </div>

        {/* Inset Container — Matches Dashboard Table & SlideOver Insets */}
        <div className="mx-[6px] mb-[6px] border border-[#262626] rounded-lg overflow-hidden bg-[#0e0e0e]">
          {is2faEnabled ? (
            /* Compact Single Row when Enabled */
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0 text-[#8c8c8c]">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-medium text-white">TOTP Authenticator</span>
                  <span className="text-[13px] text-[#8c8c8c]">
                    6-digit verification code required on sign-in from untrusted sessions.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDisableOpen(true)}
                className="group relative flex shrink-0 items-center justify-center h-9 px-3.5 rounded-lg font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#991b1b] bg-[#dc2626]"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                <span className="relative flex items-center gap-1.5 text-[14px]">
                  Disable 2FA
                </span>
              </button>
            </div>
          ) : (
            /* Setup State — Partitioned Grid Layout */
            <div className="flex flex-col md:flex-row items-stretch">
              {/* Left Column: QR Code with vertical divider border */}
              <div className="p-6 flex flex-col items-center justify-center gap-2.5 shrink-0 border-b md:border-b-0 md:border-r border-[#222222]">
                <div className="p-2.5 bg-white rounded-lg shadow-sm border border-[#262626]">
                  {otpauthUrl ? (
                    <QRCodeSVG value={otpauthUrl} size={132} />
                  ) : (
                    <div className="w-[132px] h-[132px] bg-gray-100 animate-pulse rounded" />
                  )}
                </div>
                <span className="text-[13px] font-sans text-[#8c8c8c]">Scan with 1Password, Google, etc.</span>
              </div>

              {/* Right Column: Divided into Secret Key (top) and Verification (bottom) */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Upper Block: Secret Key with full-width horizontal divider */}
                <div className="p-5 sm:p-6 border-b border-[#222222] flex flex-col gap-1">
                  <label className="text-[14px] font-medium text-white">
                    Secret key
                  </label>
                  <p className="text-[13px] text-[#8c8c8c] leading-relaxed">
                    If you cannot scan the QR code, enter this secret into your authenticator app manually.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={secret}
                      className="h-9 px-3 text-[14px] font-['JetBrains_Mono',monospace] font-medium tracking-[0.06em] rounded-lg border border-[#262626] bg-[#141414] text-white outline-none select-all focus:border-[#383838] transition-colors w-full max-w-[320px]"
                    />
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="h-9 px-3 rounded-lg border border-[#262626] bg-transparent hover:bg-[#161616] hover:border-[#383838] text-[#cccccc] hover:text-white transition-colors flex items-center gap-1.5 text-[13px] font-medium cursor-pointer shrink-0"
                      title="Copy secret key"
                      aria-label="Copy secret key"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#30a46c]" /> : <Copy className="w-3.5 h-3.5 text-[#8c8c8c]" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Lower Block: Verification Code */}
                <div className="p-5 sm:p-6 flex flex-col gap-1">
                  <label className="text-[14px] font-medium text-white">
                    Verification code
                  </label>
                  <p className="text-[13px] text-[#8c8c8c] leading-relaxed">
                    Enter the 6-digit one-time code generated by your authenticator app.
                  </p>
                  <form onSubmit={handleEnable2FA} className="mt-2.5 flex flex-wrap items-center gap-3">
                    {/* Segmented OTP 6-slot container */}
                    <div className="relative inline-flex items-center gap-1.5 select-none">
                      {/* Invisible overlaid native input handling focus, paste, typing, mobile numeric keypad */}
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        onFocus={() => setIsOtpFocused(true)}
                        onBlur={() => setIsOtpFocused(false)}
                        className="absolute inset-0 opacity-0 cursor-text z-20 w-full h-full text-[14px]"
                        aria-label="6-digit authentication code"
                      />

                      {/* 6 Visual segmented digit slots */}
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const digit = verifyCode[index] || '';
                        const isCurrent = isOtpFocused && (verifyCode.length === index || (index === 5 && verifyCode.length === 6));
                        return (
                          <React.Fragment key={index}>
                            {index === 3 && (
                              <span className="text-[#555555] font-mono text-[14px] select-none mx-0.5">
                                –
                              </span>
                            )}
                            <div
                              className={`w-9 h-10 rounded-lg flex items-center justify-center font-['JetBrains_Mono',monospace] text-[14px] font-semibold transition-all duration-150 select-none ${
                                isCurrent
                                  ? 'border border-[#2f80ed] bg-[#141414] text-white ring-2 ring-[#2f80ed]/25'
                                  : digit
                                  ? 'border border-[#383838] bg-[#141414] text-white'
                                  : 'border border-[#262626] bg-[#0c0c0c] text-[#555555]'
                              }`}
                            >
                              {digit ? (
                                digit
                              ) : isCurrent ? (
                                <span className="w-0.5 h-4 bg-[#2f80ed] animate-pulse" />
                              ) : null}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Submit / Activate button */}
                    <button
                      type="submit"
                      disabled={isLoading || verifyCode.length !== 6}
                      className="group relative flex shrink-0 items-center justify-center h-10 px-4 rounded-lg font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb]"
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                      <span className="relative flex items-center gap-1.5 text-[14px]">
                        {isLoading ? 'Activating...' : 'Activate 2FA'}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Removal Confirmation Dialog */}
      <Dialog
        isOpen={isDisableOpen}
        onClose={() => setIsDisableOpen(false)}
        title="Confirm 2FA Removal"
      >
        <form onSubmit={handleDisable2FA} className="flex flex-col gap-4">
          <p className="text-[14px] text-[#a1a1a1] leading-relaxed">
            To disable Two-Factor Authentication, please enter your current account password and a 6-digit 2FA code to verify your identity.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-white">
              Account Password
            </label>
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••••••"
              className="h-9 px-3 text-[14px] rounded-lg border border-[#262626] focus:border-[#2f80ed] hover:border-[#383838] bg-[#141414] text-white w-full outline-none transition-colors font-sans"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-white">
              Current 2FA Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={disable2faCode}
              onChange={(e) => setDisable2faCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="h-9 px-3 text-[14px] font-['JetBrains_Mono',monospace] rounded-lg border border-[#262626] focus:border-[#2f80ed] hover:border-[#383838] bg-[#141414] text-white w-full outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent border border-[#262626] hover:border-[#383838] hover:bg-[#161616] transition-colors cursor-pointer"
              onClick={() => setIsDisableOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disableLoading}
              className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-lg font-medium text-white shadow-xs outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden ring-1 ring-[#991b1b] bg-[#dc2626]"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
              <span className="relative flex items-center gap-1.5 text-[14px]">
                {disableLoading ? 'Disabling...' : 'Disable 2FA'}
              </span>
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

