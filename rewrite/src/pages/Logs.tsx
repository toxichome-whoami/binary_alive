import React, { useState, useEffect, useCallback } from 'react';
import { logsApi } from '../api/logs';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import type { AuditLog, LoginAttemptLog } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { formatDistanceToNow, format } from 'date-fns';
import { RefreshCw, FileText, KeyRound, Terminal as TerminalIcon } from 'lucide-react';

export const Logs: React.FC = () => {
  const { isAdmin } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'audit' | 'login' | 'terminal'>('audit');

  // Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginAttemptLog[]>([]);
  const [termLogs, setTermLogs] = useState<AuditLog[]>([]);

  // Pagination state per tab
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLogs = useCallback(
    async (targetTab = activeTab, targetPage = page) => {
      setIsLoading(true);
      try {
        if (targetTab === 'audit') {
          const res = await logsApi.getAuditLogs(targetPage, 20);
          if (res.success && res.data) {
            setAuditLogs(res.data.data);
            setTotalPages(res.data.total_pages);
            setTotal(res.data.total);
          }
        } else if (targetTab === 'login') {
          const res = await logsApi.getLoginLogs(targetPage, 20);
          if (res.success && res.data) {
            setLoginLogs(res.data.data);
            setTotalPages(res.data.total_pages);
            setTotal(res.data.total);
          }
        } else if (targetTab === 'terminal' && isAdmin()) {
          const res = await logsApi.getTerminalLogs(targetPage, 20);
          if (res.success && res.data) {
            setTermLogs(res.data.data);
            setTotalPages(res.data.total_pages);
            setTotal(res.data.total);
          }
        }
      } catch (err: any) {
        pushToast('error', err.message || 'Failed to fetch logs');
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab, page, isAdmin, pushToast]
  );

  useEffect(() => {
    fetchLogs(activeTab, page);
  }, [fetchLogs, activeTab, page]);

  const handleTabChange = (tab: 'audit' | 'login' | 'terminal') => {
    setActiveTab(tab);
    setPage(1);
  };

  const renderActionBadge = (action: string) => {
    if (action.includes('delete')) {
      return <Badge variant="red">{action}</Badge>;
    }
    if (action.includes('create') || action.includes('start') || action.includes('success')) {
      return <Badge variant="green">{action}</Badge>;
    }
    if (action.includes('restart') || action.includes('warn') || action.includes('stop')) {
      return <Badge variant="yellow">{action}</Badge>;
    }
    if (action.includes('edit') || action.includes('update')) {
      return <Badge variant="blue">{action}</Badge>;
    }
    return <Badge variant="gray">{action}</Badge>;
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return (
        <span title={format(date, 'yyyy-MM-dd HH:mm:ss')}>
          {formatDistanceToNow(date, { addSuffix: true })}
        </span>
      );
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            System & Audit Logs
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Immutable tracking of process actions, user management, and security events
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchLogs()} isLoading={isLoading}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border dark:border-border-dark pb-px">
        <button
          onClick={() => handleTabChange('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Audit Logs
        </button>

        <button
          onClick={() => handleTabChange('login')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'login'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Login Attempts
        </button>

        {isAdmin() && (
          <button
            onClick={() => handleTabChange('terminal')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'terminal'
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
            Terminal History
          </button>
        )}
      </div>

      {/* Logs Table Card */}
      <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-elevated dark:bg-elevated-dark border-b border-border dark:border-border-dark text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {activeTab === 'audit' && (
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">IP Address</th>
                </tr>
              )}
              {activeTab === 'login' && (
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Attempted Username</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3 text-right">Client IP</th>
                </tr>
              )}
              {activeTab === 'terminal' && (
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Executed Command</th>
                  <th className="px-4 py-3 text-right">IP</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {activeTab === 'audit' &&
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-elevated/40 dark:hover:bg-elevated-dark/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {log.username || 'System'}
                    </td>
                    <td className="px-4 py-3">{renderActionBadge(log.action)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 font-mono break-all">
                      {log.details || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-gray-500">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}

              {activeTab === 'login' &&
                loginLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-elevated/40 dark:hover:bg-elevated-dark/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {log.username || 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      {log.is_successful ? (
                        <Badge variant="green">Success</Badge>
                      ) : (
                        <Badge variant="red">Failed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-gray-500">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}

              {activeTab === 'terminal' &&
                termLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-elevated/40 dark:hover:bg-elevated-dark/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {log.username || 'Admin'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">
                      <span className="text-brand font-bold mr-1.5">$</span>
                      {log.details?.replace(/^Command:\s*/, '')}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-gray-500">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
