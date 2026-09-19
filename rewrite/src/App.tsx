import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import type { Permissions } from './types';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Terminal } from './pages/Terminal';
import { Users } from './pages/Users';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { Setup2FA } from './pages/Setup2FA';
import { ApiKeys } from './pages/ApiKeys';
import { Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  permission: keyof Permissions;
  children: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({ permission, children }) => {
  const { hasPermission } = useAuthStore();
  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base dark:bg-base-dark text-brand">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-xs font-medium text-gray-500">Connecting to Binary Alive...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/terminal"
            element={
              <PermissionGuard permission="terminal_access">
                <Terminal />
              </PermissionGuard>
            }
          />
          <Route
            path="/users"
            element={
              <PermissionGuard permission="users_create">
                <Users />
              </PermissionGuard>
            }
          />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route
            path="/logs"
            element={
              <PermissionGuard permission="logs_view_audit">
                <Logs />
              </PermissionGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <PermissionGuard permission="settings_view">
                <Settings />
              </PermissionGuard>
            }
          />
          <Route path="/2fa" element={<Setup2FA />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
