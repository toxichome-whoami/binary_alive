import React, { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import {
  Database,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { push: pushToast } = useToastStore();
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  useEffect(() => {
    import('../api/settings').then(({ settingsApi }) => {
      settingsApi.get().then((res) => {
        if (res.success && res.data) {
          setCaptchaEnabled(res.data.enable_captcha);
        }
      });
    });
  }, []);
  
  const handleToggleCaptcha = async () => {
    const nextState = !captchaEnabled;
    // Optimistic update
    setCaptchaEnabled(nextState);
    
    try {
      const { settingsApi } = await import('../api/settings');
      const res = await settingsApi.toggleCaptcha(nextState);
      if (res.success) {
        pushToast('success', res.message || `Captcha protection ${nextState ? 'enabled' : 'disabled'}`);
      } else {
        // Revert on failure
        setCaptchaEnabled(!nextState);
        pushToast('error', res.message || 'Failed to update Captcha settings');
      }
    } catch (err: any) {
      setCaptchaEnabled(!nextState);
      pushToast('error', err.message || 'Failed to update Captcha settings');
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-8 select-none font-sans">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-[20px] font-semibold text-[#F2F3F3] tracking-[-0.01em] leading-tight">
          System Settings
        </h1>
        <p className="text-[13px] font-normal text-[#A1A1A1] leading-normal">
          Manage database connections and security configurations.
        </p>
      </div>



      {/* Security Configuration */}
      <div className="rounded-[8px] border border-[#26282A] bg-[#161718] p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[#0B0B0C] border border-[#26282A] shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#F2F3F3]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-[#F2F3F3] tracking-[-0.01em] leading-snug">
                  Captcha Protection
                </h2>
                <p className="text-[13px] font-normal text-[#A1A1A1] leading-normal mt-0.5">
                  Require users to complete a CAPTCHA challenge during login to prevent automated attacks.
                </p>
              </div>
              
              {/* Toggle Switch */}
              <button
                type="button"
                onClick={handleToggleCaptcha}
                role="switch"
                aria-checked={captchaEnabled}
                aria-label="Toggle Captcha"
                className={`relative inline-flex cursor-pointer items-center border-none p-0 ring-1 focus:outline-none transition-colors duration-150 ease-out h-[18px] w-9 rounded-[5px] ${
                  captchaEnabled ? 'bg-[#F2F3F3] ring-[#F2F3F3]' : 'bg-[#0B0B0C] ring-[#26282A]'
                }`}
              >
                <div
                  className={`absolute top-0 bottom-0 shadow-[0_0_1px_0.5px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.4)] w-[18px] rounded-[5px] transition-all duration-150 ease-out ${
                    captchaEnabled ? 'left-[18px] bg-[#0B0B0C]' : 'left-0 bg-[#383838]'
                  }`}
                ></div>
              </button>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
