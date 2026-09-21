import React, { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

const SquircleToggle = ({ 
  checked, 
  onChange, 
  ariaLabel,
  disabled = false
}: { 
  checked: boolean; 
  onChange: () => void; 
  ariaLabel: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onChange}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    className={`relative inline-flex items-center border-none p-0 ring-1 focus:outline-none transition-colors duration-150 ease-out h-[18px] w-9 rounded-[5px] ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
    } ${
      checked ? 'bg-[#F2F3F3] ring-[#F2F3F3]' : 'bg-[#0B0B0C] ring-[#26282A]'
    }`}
  >
    <div
      className={`absolute top-0 bottom-0 shadow-[0_0_1px_0.5px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.4)] w-[18px] rounded-[5px] transition-all duration-150 ease-out ${
        checked ? 'left-[18px] bg-[#0B0B0C]' : 'left-0 bg-[#383838]'
      }`}
    ></div>
  </button>
);

export const Settings: React.FC = () => {
  const { push: pushToast } = useToastStore();
  const { hasPermission } = useAuthStore();
  
  const canEditMaintenance = hasPermission('settings_maintenance');
  const canEditSecurity = hasPermission('settings_captcha');
  const canEditAi = hasPermission('settings_ai');

  const [settings, setSettings] = useState({
    enable_captcha: false,
    maintenance_mode: false,
  });

  const [aiConfig, setAiConfig] = useState({
    provider: '',
    model: '',
    base_url: '',
    api_key: '',
    has_key: false,
  });
  const [isSavingAi, setIsSavingAi] = useState(false);

  useEffect(() => {
    const fetchSettings = () => {
      import('../api/settings').then(({ settingsApi }) => {
        settingsApi.get().then((res) => {
          if (res.success && res.data) {
            setSettings({
              enable_captcha: res.data.enable_captcha,
              maintenance_mode: res.data.maintenance_mode,
            });
            setAiConfig({
              provider: res.data.ai_provider || '',
              model: res.data.ai_model || '',
              base_url: res.data.ai_base_url || '',
              api_key: res.data.has_ai_key ? '••••••••••••••••' : '',
              has_key: !!res.data.has_ai_key,
            });
          }
        });
      });
    };

    fetchSettings();

    const handleRefresh = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data && data.key && (data.key === 'enable_captcha' || data.key === 'maintenance_mode')) {
        setSettings(prev => ({ ...prev, [data.key]: data.value === '1' }));
      } else {
        fetchSettings();
      }
    };

    window.addEventListener('settings-refresh', handleRefresh);
    return () => window.removeEventListener('settings-refresh', handleRefresh);
  }, []);
  
  const handleToggle = async (key: keyof typeof settings) => {
    if (key === 'maintenance_mode' && !canEditMaintenance) {
      pushToast('error', 'You do not have permission to change maintenance mode');
      return;
    }
    if (key === 'enable_captcha' && !canEditSecurity) {
      pushToast('error', 'You do not have permission to change captcha settings');
      return;
    }

    const nextState = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: nextState }));
    
    try {
      const { settingsApi } = await import('../api/settings');
      const res = await settingsApi.toggle(key, nextState);
      if (res.success) {
        pushToast('success', res.message || 'Setting updated');
      } else {
        setSettings((prev) => ({ ...prev, [key]: !nextState }));
        pushToast('error', res.message || 'Failed to update setting');
      }
    } catch (err: any) {
      setSettings((prev) => ({ ...prev, [key]: !nextState }));
      pushToast('error', err.message || 'Failed to update setting');
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditAi) {
      pushToast('error', 'You do not have permission to modify AI configuration');
      return;
    }

    setIsSavingAi(true);
    try {
      const { settingsApi } = await import('../api/settings');
      const res = await settingsApi.updateAi({
        provider: aiConfig.provider,
        model: aiConfig.model,
        base_url: aiConfig.base_url,
        api_key: aiConfig.api_key !== '••••••••••••••••' ? aiConfig.api_key : undefined,
      });

      if (res.success) {
        pushToast('success', res.message || 'AI configuration saved');
        if (aiConfig.api_key && aiConfig.api_key !== '••••••••••••••••') {
          setAiConfig((prev) => ({ ...prev, api_key: '••••••••••••••••', has_key: true }));
        }
      } else {
        pushToast('error', res.message || 'Failed to save AI configuration');
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to save AI configuration');
    } finally {
      setIsSavingAi(false);
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
          Manage system-wide configuration, access control, and AI model parameters.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Maintenance Mode Card */}
        <section className="border border-[#26282A] rounded-[8px] bg-[#0B0B0C] flex flex-col shadow-sm">
          <div className="p-5 flex flex-col gap-2">
            <h2 className="text-[14px] font-semibold text-[#F2F3F3] tracking-[-0.01em]">
              Maintenance Mode
            </h2>
            <p className="text-[13px] text-[#A1A1A1] leading-relaxed max-w-[600px]">
              Lock down the application to non-admin users. When enabled, all active sessions for regular members will be temporarily suspended and new logins will be blocked.
            </p>
          </div>
          <div className="px-5 py-3 border-t border-[#26282A] bg-[#161718] flex items-center justify-between rounded-b-[8px]">
            <span className="text-[13px] text-[#A1A1A1]">
              The application is currently <strong className="text-[#F2F3F3] font-medium">{settings.maintenance_mode ? 'offline' : 'online'}</strong>.
            </span>
            <SquircleToggle 
              checked={settings.maintenance_mode} 
              onChange={() => handleToggle('maintenance_mode')} 
              ariaLabel="Toggle Maintenance Mode" 
              disabled={!canEditMaintenance}
            />
          </div>
        </section>

        {/* Captcha Protection Card */}
        <section className="border border-[#26282A] rounded-[8px] bg-[#0B0B0C] flex flex-col shadow-sm">
          <div className="p-5 flex flex-col gap-2">
            <h2 className="text-[14px] font-semibold text-[#F2F3F3] tracking-[-0.01em]">
              Login Captcha
            </h2>
            <p className="text-[13px] text-[#A1A1A1] leading-relaxed max-w-[600px]">
              Require users to complete a CAPTCHA challenge during login to prevent automated credential stuffing and brute-force attacks.
            </p>
          </div>
          <div className="px-5 py-3 border-t border-[#26282A] bg-[#161718] flex items-center justify-between rounded-b-[8px]">
            <span className="text-[13px] text-[#A1A1A1]">
              Login protection is <strong className="text-[#F2F3F3] font-medium">{settings.enable_captcha ? 'active' : 'disabled'}</strong>.
            </span>
            <SquircleToggle 
              checked={settings.enable_captcha} 
              onChange={() => handleToggle('enable_captcha')} 
              ariaLabel="Toggle Captcha" 
              disabled={!canEditSecurity}
            />
          </div>
        </section>

        {/* Custom AI Model Configuration Card */}
        <section className="border border-[#26282A] rounded-[8px] bg-[#0B0B0C] flex flex-col shadow-sm">
          <form onSubmit={handleSaveAi}>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-[14px] font-semibold text-[#F2F3F3] tracking-[-0.01em]">
                  AI Model Configuration
                </h2>
                <p className="text-[13px] text-[#A1A1A1] leading-relaxed max-w-[600px] mt-0.5">
                  Configure your Gemini, OpenAI, or custom model endpoint, provider credentials, and model identifiers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Provider Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#F2F3F3]">
                    AI Provider
                  </label>
                  <input
                    type="text"
                    value={aiConfig.provider}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, provider: e.target.value }))}
                    disabled={!canEditAi}
                    placeholder="e.g. Google Gemini, OpenAI, Anthropic"
                    className="h-9 px-3 rounded-[6px] bg-[#161718] border border-[#26282A] text-[13px] text-[#F2F3F3] placeholder-[#6E6E6E] outline-none focus:border-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  />
                </div>

                {/* Model Identifier */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#F2F3F3]">
                    Model Identifier
                  </label>
                  <input
                    type="text"
                    value={aiConfig.model}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                    disabled={!canEditAi}
                    placeholder="e.g. gemini-1.5-pro or gpt-4o"
                    className="h-9 px-3 rounded-[6px] bg-[#161718] border border-[#26282A] text-[13px] text-[#F2F3F3] placeholder-[#6E6E6E] outline-none focus:border-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono"
                  />
                </div>

                {/* Base URL */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#F2F3F3]">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={aiConfig.base_url}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, base_url: e.target.value }))}
                    disabled={!canEditAi}
                    placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                    className="h-9 px-3 rounded-[6px] bg-[#161718] border border-[#26282A] text-[13px] text-[#F2F3F3] placeholder-[#6E6E6E] outline-none focus:border-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono"
                  />
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#F2F3F3] flex items-center justify-between">
                    <span>API Key / Secret</span>
                    {aiConfig.has_key && (
                      <span className="text-[11px] text-[#0E9F6E] font-normal">Configured</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={aiConfig.api_key}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, api_key: e.target.value }))}
                    disabled={!canEditAi}
                    placeholder={aiConfig.has_key ? '••••••••••••••••' : 'Enter API key...'}
                    className="h-9 px-3 rounded-[6px] bg-[#161718] border border-[#26282A] text-[13px] text-[#F2F3F3] placeholder-[#6E6E6E] outline-none focus:border-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#26282A] bg-[#161718] flex items-center justify-between rounded-b-[8px]">
              <span className="text-[13px] text-[#A1A1A1]">
                Active provider: <strong className="text-[#F2F3F3] font-medium">{aiConfig.provider || 'None configured'}</strong>
              </span>
              <button
                type="submit"
                disabled={!canEditAi || isSavingAi}
                className="group relative flex shrink-0 items-center justify-center h-8 px-3.5 rounded-[6px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb] font-sans"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
                <span className="relative flex items-center text-[13px] font-sans">
                  {isSavingAi ? 'Saving...' : 'Save AI Settings'}
                </span>
              </button>
            </div>
          </form>
        </section>

      </div>
    </div>
  );
};
