import React, { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import type { User, Role } from '../types';
import { Button } from '../components/ui/Button';
import { RoleBadge } from '../components/shared/RoleBadge';
import { SlideOver } from '../components/ui/SlideOver';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import {
  UserPlus,
  Key,
  ShieldAlert,
  Edit,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const Users: React.FC = () => {
  const { user: currentUser, isMasterAdmin } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('viewer');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<Role>('viewer');
  const [editLoading, setEditLoading] = useState(false);

  // API Token modal state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Confirmation dialogs
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [revokeTokenTarget, setRevokeTokenTarget] = useState<User | null>(null);
  const [remove2faTarget, setRemove2faTarget] = useState<User | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchUsers = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    try {
      const res = await usersApi.list(targetPage, 15);
      if (res.success && res.data) {
        setUsers(res.data.data);
        setTotalPages(res.data.total_pages);
        setTotal(res.data.total);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to load user records');
    } finally {
      setIsLoading(false);
    }
  }, [page, pushToast]);

  useEffect(() => {
    fetchUsers(page);
  }, [fetchUsers, page]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    setCreateLoading(true);

    try {
      const res = await usersApi.create({
        username: newUsername,
        password: newPassword,
        role: newRole,
      });

      if (res.success) {
        pushToast('success', `User "${newUsername}" created!`);
        setNewUsername('');
        setNewPassword('');
        setNewRole('viewer');
        fetchUsers(1);
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditPassword('');
    setEditRole(u.role);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);

    try {
      const res = await usersApi.update(editingUser.id, {
        username: editUsername !== editingUser.username ? editUsername : undefined,
        password: editPassword ? editPassword : undefined,
        role: editRole !== editingUser.role ? editRole : undefined,
      });

      if (res.success) {
        pushToast('success', 'User updated successfully!');
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleGenerateToken = async (u: User) => {
    try {
      const res = await usersApi.generateToken(u.id);
      if (res.success && res.data?.token) {
        setGeneratedToken(res.data.token);
        setTokenCopied(false);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to generate token');
    }
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDialogLoading(true);
    try {
      const res = await usersApi.delete(deleteTarget.id);
      if (res.success) {
        pushToast('success', 'User deleted');
        setDeleteTarget(null);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to delete user');
    } finally {
      setDialogLoading(false);
    }
  };

  const confirmRevokeToken = async () => {
    if (!revokeTokenTarget) return;
    setDialogLoading(true);
    try {
      const res = await usersApi.revokeToken(revokeTokenTarget.id);
      if (res.success) {
        pushToast('success', 'API token revoked');
        setRevokeTokenTarget(null);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to revoke token');
    } finally {
      setDialogLoading(false);
    }
  };

  const confirmRemove2fa = async () => {
    if (!remove2faTarget) return;
    setDialogLoading(true);
    try {
      const res = await usersApi.remove2fa(remove2faTarget.id);
      if (res.success) {
        pushToast('success', '2FA removed for user');
        setRemove2faTarget(null);
        fetchUsers();
      }
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to remove 2FA');
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          User Management
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Role-based access control, security credentials, and API tokens
        </p>
      </div>

      {/* Add User Form Card */}
      <div className="p-5 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-xs">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-brand" />
          Create New User Account
        </h2>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
          >
            <option value="viewer">Viewer (Read-only)</option>
            <option value="operator">Operator (Process Control)</option>
            <option value="auditor">Auditor (Log Viewer)</option>
            <option value="admin" disabled={!isMasterAdmin()}>
              Admin {isMasterAdmin() ? '' : '(Master Admin only)'}
            </option>
          </select>
          <Button type="submit" variant="primary" size="md" isLoading={createLoading}>
            Create User
          </Button>
        </form>
      </div>

      {/* Users Table Card */}
      <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-elevated dark:bg-elevated-dark border-b border-border dark:border-border-dark text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">API Token</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3 text-center">Failed Logins</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {users.map((u) => {
                const isMaster = u.id === 1;
                const isSelf = u.id === currentUser?.id;
                const isOtherAdmin = u.role === 'admin' && !isSelf;
                const canEdit = isMasterAdmin() || (!isMaster && !isOtherAdmin) || isSelf;
                const canDelete = isMasterAdmin() ? !isMaster && !isSelf : !isMaster && !isOtherAdmin && !isSelf;

                return (
                  <tr key={u.id} className="hover:bg-elevated/40 dark:hover:bg-elevated-dark/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{u.id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {u.username}
                      {isSelf && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-brand/10 text-brand font-medium">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} isMaster={isMaster} />
                    </td>
                    <td className="px-4 py-3">
                      {u.has_api_token ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.has_2fa ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                          <XCircle className="w-3.5 h-3.5" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">
                      {u.failed_attempts}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit User"
                              onClick={() => openEditModal(u)}
                            >
                              <Edit className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Generate API Token"
                              onClick={() => handleGenerateToken(u)}
                            >
                              <Key className="w-3.5 h-3.5 text-amber-600" />
                            </Button>

                            {u.has_api_token && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Revoke API Token"
                                onClick={() => setRevokeTokenTarget(u)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              </Button>
                            )}

                            {u.has_2fa && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Force Remove 2FA"
                                onClick={() => setRemove2faTarget(u)}
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                              </Button>
                            )}
                          </>
                        )}

                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete User"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600 hover:text-rose-700" />
                          </Button>
                        ) : (
                          <span className="w-7"></span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* Edit User Drawer */}
      <SlideOver
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title={`Edit User: ${editingUser?.username}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Role
            </label>
            <select
              disabled={editingUser?.id === 1}
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as Role)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="auditor">Auditor</option>
              <option value="admin" disabled={!isMasterAdmin() && editRole !== 'admin'}>
                Admin
              </option>
            </select>
            {editingUser?.id === 1 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                The Master Administrator role is permanent and cannot be modified.
              </p>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border dark:border-border-dark">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={editLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </SlideOver>

      {/* Display Generated Token Modal */}
      <Dialog
        isOpen={generatedToken !== null}
        onClose={() => setGeneratedToken(null)}
        title="API Token Generated"
      >
        <div className="space-y-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <strong>Important:</strong> Copy your new API token now. For security reasons, it is stored as an irreversible SHA-256 hash and cannot be shown again.
          </p>

          <div className="relative">
            <input
              type="text"
              readOnly
              value={generatedToken || ''}
              className="w-full pl-3 pr-20 py-2.5 font-mono text-xs rounded-lg border border-border dark:border-border-dark bg-elevated dark:bg-elevated-dark text-gray-900 dark:text-gray-100 select-all"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyToken}
              className="absolute right-1.5 top-1.5 h-7 px-2.5 text-xs"
            >
              {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {tokenCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setGeneratedToken(null)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteUser}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete user "${deleteTarget?.username}"? This action cannot be undone.`}
        confirmLabel="Delete User"
        variant="danger"
        isLoading={dialogLoading}
      />

      {/* Revoke Token Confirmation */}
      <ConfirmDialog
        isOpen={revokeTokenTarget !== null}
        onClose={() => setRevokeTokenTarget(null)}
        onConfirm={confirmRevokeToken}
        title="Revoke API Token"
        message={`Revoking this token will immediately invalidate any remote scripts or bots relying on it for user "${revokeTokenTarget?.username}".`}
        confirmLabel="Revoke Token"
        variant="danger"
        isLoading={dialogLoading}
      />

      {/* Force Remove 2FA Confirmation */}
      <ConfirmDialog
        isOpen={remove2faTarget !== null}
        onClose={() => setRemove2faTarget(null)}
        onConfirm={confirmRemove2fa}
        title="Force Remove Two-Factor Authentication"
        message={`This will immediately disable 2FA for "${remove2faTarget?.username}". Use this only if the user has lost access to their authenticator device.`}
        confirmLabel="Disable 2FA"
        variant="danger"
        isLoading={dialogLoading}
      />
    </div>
  );
};
