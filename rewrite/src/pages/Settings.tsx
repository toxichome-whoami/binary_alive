import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api/settings';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Shield,
  Download,
  Upload,
  Info,
  Database,
  FileCode,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { push: pushToast } = useToastStore();

  const [captchaEnabled, setCaptchaEnabled] = useState<boolean>(true);
  const [version, setVersion] = useState<string>('2.0.0');
  const [toggleLoading, setToggleLoading] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState<boolean>(false);

  useEffect(() => {
    settingsApi.get().then((res) => {
      if (res.success && res.data) {
        setCaptchaEnabled(res.data.enable_captcha);
        setVersion(res.data.version || '2.0.0');
      }
    }).catch(() => {});
  }, []);

  const handleToggleCaptcha = async () => {
    setToggleLoading(true);
    const nextState = !captchaEnabled;
    try {
      const res = await settingsApi.toggleCaptcha(nextState);
      if (res.success) {
        setCaptchaEnabled(nextState);
        pushToast('success', `Login CAPTCHA ${nextState ? 'enabled' : 'disabled'}.`);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update CAPTCHA setting');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImportLoading(true);
    const fd = new FormData();
    fd.append('config_file', importFile);

    try {
      const res = await settingsApi.importConfig(fd);
      if (res.success) {
        pushToast('success', 'Configuration imported successfully!');
        setImportFile(null);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to import configuration');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          System Settings
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Global security controls, database backup, and configuration import/export
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Controls */}
        <div className="p-6 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Shield className="w-4 h-4 text-brand" />
            Security & Authentication
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Control automated brute-force protection features on the login portal.
          </p>

          <div className="pt-2 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Login CAPTCHA
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Requires solving a visual CAPTCHA code before submitting credentials.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={captchaEnabled ? 'green' : 'gray'}>
                {captchaEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button
                size="sm"
                variant={captchaEnabled ? 'outline' : 'primary'}
                isLoading={toggleLoading}
                onClick={handleToggleCaptcha}
              >
                {captchaEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        </div>

        {/* Data Export Card */}
        <div className="p-6 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Download className="w-4 h-4 text-brand" />
            Export Backups
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Download your server configuration or export records stored in Turso.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href={settingsApi.exportConfigUrl()}
              download="binary_alive_config.json"
              className="inline-flex"
            >
              <Button size="sm" variant="outline">
                <FileCode className="w-4 h-4 text-brand" />
                Export Config (JSON)
              </Button>
            </a>

            <a
              href={settingsApi.exportDbUrl()}
              download="binary_alive_turso_dump.json"
              className="inline-flex"
            >
              <Button size="sm" variant="outline">
                <Database className="w-4 h-4 text-sky-500" />
                Export Turso DB (JSON)
              </Button>
            </a>
          </div>
        </div>

        {/* Configuration Import */}
        <div className="p-6 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Upload className="w-4 h-4 text-brand" />
            Import Configuration
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Restore settings from an existing <code className="text-brand">config.json</code> file.
          </p>

          <form onSubmit={handleImportSubmit} className="pt-2 space-y-3">
            <input
              type="file"
              accept=".json"
              required
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-elevated dark:file:bg-elevated-dark file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-700 cursor-pointer"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!importFile}
              isLoading={importLoading}
            >
              Upload & Apply Configuration
            </Button>
          </form>
        </div>

        {/* System Info Overview */}
        <div className="p-6 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Info className="w-4 h-4 text-brand" />
            System Architecture
          </div>
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex justify-between py-1 border-b border-border dark:border-border-dark">
              <span className="text-gray-500">System Version</span>
              <span className="font-semibold">{version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border dark:border-border-dark">
              <span className="text-gray-500">API Architecture</span>
              <span className="font-semibold">Hono + Node.js</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border dark:border-border-dark">
              <span className="text-gray-500">Database Engine</span>
              <span className="font-semibold">Turso (libSQL)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Frontend Stack</span>
              <span className="font-semibold">React 18 + TypeScript + Tailwind</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
