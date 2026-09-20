import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useWebSocketInit } from './hooks/useWebSocket';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import type { Permissions } from './types';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { Setup2FA } from './pages/Setup2FA';
import { ApiKeys } from './pages/ApiKeys';
import { Loader2 } from 'lucide-react';
import { ToastContainer } from './components/ui/Toast';



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
  useWebSocketInit();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0C]">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-[#2f80ed]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span className="text-[13px] font-medium text-[#8c8c8c]">Connecting...</span>
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
    <>
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
                <></>
              </PermissionGuard>
            }
          />
          <Route
            path="/users"
            element={
              <PermissionGuard permission="users_view">
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
    <ToastContainer />
    </>
  );
};

export default App;
