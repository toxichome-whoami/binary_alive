import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import type { Role } from './types';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Terminal } from './pages/Terminal';
import { Users } from './pages/Users';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { Setup2FA } from './pages/Setup2FA';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  roles: Role[];
  children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ roles, children }) => {
  const { hasRole } = useAuthStore();
  if (!hasRole(roles)) {
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
              <RoleGuard roles={['admin']}>
                <Terminal />
              </RoleGuard>
            }
          />
          <Route
            path="/users"
            element={
              <RoleGuard roles={['admin']}>
                <Users />
              </RoleGuard>
            }
          />
          <Route
            path="/logs"
            element={
              <RoleGuard roles={['admin', 'auditor', 'operator']}>
                <Logs />
              </RoleGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleGuard roles={['admin']}>
                <Settings />
              </RoleGuard>
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
