import React, { useState } from 'react';
import type { Permissions } from '../../types';
import { cn } from '../../utils/cn';

export interface PermissionTableProps {
  value: Permissions;
  onChange?: (p: Permissions) => void;
  disabled?: Partial<Record<keyof Permissions, boolean>>;
  readOnly?: boolean;
}

const GROUPS = [
  {
    id: 'users',
    label: 'User Management',
    items: [
      { key: 'users_view', label: 'View users', desc: 'Can view user accounts' },
      { key: 'users_create', label: 'Create users', desc: 'Can register new accounts' },
      { key: 'users_edit', label: 'Edit users', desc: 'Can modify usernames and passwords' },
      { key: 'users_disable', label: 'Disable users', desc: 'Can lock user accounts' },
      { key: 'users_delete', label: 'Delete users', desc: 'Can permanently remove accounts' },
      { key: 'users_reset_2fa', label: 'Remove 2FA', desc: 'Can force disable two-factor authentication' },
    ],
  },
  {
    id: 'api_keys',
    label: 'API Keys',
    items: [
      { key: 'api_keys_view', label: 'View API keys', desc: 'Can view API tokens' },
      { key: 'api_keys_create', label: 'Create API keys', desc: 'Can generate new API tokens' },
      { key: 'api_keys_edit', label: 'Edit API keys', desc: 'Can modify API token permissions' },
      { key: 'api_keys_disable', label: 'Disable API keys', desc: 'Can lock or suspend API tokens' },
      { key: 'api_keys_delete', label: 'Delete API keys', desc: 'Can revoke API tokens' },
    ],
  },
  {
    id: 'processes',
    label: 'Process Control',
    items: [
      { key: 'processes_view', label: 'View processes', desc: 'Can view process lists and telemetry' },
      { key: 'processes_start', label: 'Start process', desc: 'Can trigger process start commands' },
      { key: 'processes_stop', label: 'Stop process', desc: 'Can trigger graceful or force termination' },
      { key: 'processes_restart', label: 'Restart process', desc: 'Can cycle background workers' },
      { key: 'processes_create', label: 'Create process', desc: 'Can define new process configurations' },
      { key: 'processes_edit', label: 'Edit process', desc: 'Can modify command arguments and working dir' },
      { key: 'processes_delete', label: 'Delete process', desc: 'Can purge process records' },
    ],
  },
  {
    id: 'logs',
    label: 'Audit & Telemetry',
    items: [
      { key: 'logs_view_audit', label: 'View audit logs', desc: 'Can inspect administrative mutation trail' },
      { key: 'logs_view_login', label: 'View login logs', desc: 'Can monitor sign-in events and lockout states' },
      { key: 'logs_view_terminal', label: 'View terminal logs', desc: 'Can view executed command logs' },
    ],
  },
  {
    id: 'settings',
    label: 'System Settings',
    items: [
      { key: 'settings_view', label: 'View settings', desc: 'Can access and view system configuration' },
      { key: 'settings_edit', label: 'Modify settings', desc: 'Can adjust maintenance mode and AI model settings' },
      { key: 'settings_security', label: 'Captcha protection', desc: 'Can toggle login CAPTCHA verification' },
    ],
  },
  {
    id: 'terminal',
    label: 'Terminal Console',
    items: [
      { key: 'terminal_access', label: 'Access terminal', desc: 'Can open interactive shell sessions' },
      { key: 'terminal_unrestricted', label: 'Unrestricted execution', desc: 'Can bypass command blocklists (root-like)' },
    ],
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    items: [
      { key: 'ai_access', label: 'Use AI Assistant', desc: 'Can access and chat with the AI assistant' },
      { key: 'ai_data_read', label: 'AI Data Access (Read)', desc: 'AI can read workspace and system data on behalf of user' },
      { key: 'ai_data_write', label: 'AI Data Access (Write)', desc: 'AI can modify workspace data and perform actions' },
    ],
  },
];

export const PermissionTable: React.FC<PermissionTableProps> = ({
  value,
  onChange,
  disabled = {},
  readOnly = false,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    users: true,
  });

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleToggle = (key: keyof Permissions) => {
    if (readOnly || disabled[key]) return;
    onChange?.({ ...value, [key]: !value[key] });
  };

  const handleToggleGroup = (items: { key: string }[]) => {
    if (readOnly) return;

    const enableableItems = items.filter((item) => !disabled[item.key as keyof Permissions]);
    if (enableableItems.length === 0) return;

    const allChecked = enableableItems.every((item) => value[item.key as keyof Permissions]);

    const newValue = { ...value };
    for (const item of enableableItems) {
      newValue[item.key as keyof Permissions] = !allChecked;
    }
    onChange?.(newValue);
  };

  return (
    <div className="w-full border border-[#222222] rounded-[8px] overflow-hidden bg-[#0c0c0c] divide-y divide-[#222222] font-sans select-none">
      {GROUPS.map((group) => {
        const isExpanded = !!expandedGroups[group.id];
        const enableableItems = group.items.filter((item) => !disabled[item.key as keyof Permissions]);
        const checkedCount = group.items.filter((i) => value[i.key as keyof Permissions]).length;
        const isGroupIndeterminate =
          enableableItems.some((i) => value[i.key as keyof Permissions]) &&
          !enableableItems.every((i) => value[i.key as keyof Permissions]);
        const isGroupChecked =
          enableableItems.length > 0 && enableableItems.every((i) => value[i.key as keyof Permissions]);
        const isGroupDisabled = enableableItems.length === 0;

        return (
          <div key={group.id} className="w-full">
            {/* Expandable Header */}
            <div
              onClick={() => toggleExpand(group.id)}
              className="flex items-center justify-between px-3.5 py-2.5 bg-[#141414] hover:bg-[#181818] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 256 256"
                  fill="currentColor"
                  className={cn(
                    "text-[#8c8c8c] shrink-0 transition-transform duration-150",
                    isExpanded && "rotate-90 text-white"
                  )}
                >
                  <path d="M92.69,216.49a12,12,0,0,1-17-17L147,128,75.71,56.49a12,12,0,0,1,17-17l80,80a12,12,0,0,1,0,17Z" />
                </svg>
                <span className="text-[14px] font-medium text-white truncate">{group.label}</span>
                <span
                  className={cn(
                    "text-[13px] tabular-nums",
                    checkedCount > 0 ? "text-[#2f80ed] font-medium" : "text-[#777777]"
                  )}
                >
                  ({checkedCount}/{enableableItems.length})
                </span>
              </div>

              <button
                type="button"
                role="checkbox"
                aria-checked={isGroupChecked ? 'true' : isGroupIndeterminate ? 'mixed' : 'false'}
                disabled={readOnly || isGroupDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleGroup(group.items);
                }}
                className={cn(
                  "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-[#141414] ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none transition-all cursor-pointer",
                  isGroupChecked && "bg-[#2f80ed] ring-[#2f80ed]",
                  isGroupIndeterminate && "bg-[#2f80ed] ring-[#2f80ed]",
                  (readOnly || isGroupDisabled) && "opacity-40 cursor-not-allowed"
                )}
                title={isGroupChecked ? "Deselect group" : "Select all in group"}
              >
                {isGroupChecked ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                    <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                ) : isGroupIndeterminate ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                    <path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z" />
                  </svg>
                ) : null}
              </button>
            </div>

            {/* Dropdown Content */}
            {isExpanded && (
              <div className="divide-y divide-[#1e1e1e] bg-[#0c0c0c] border-t border-[#222222]">
                {group.items.map((item) => {
                  const itemKey = item.key as keyof Permissions;
                  const isChecked = !!value[itemKey];
                  const isDisabled = readOnly || disabled[itemKey];

                  return (
                    <div
                      key={itemKey}
                      onClick={() => handleToggle(itemKey)}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors cursor-pointer",
                        isDisabled ? "bg-[#090909] opacity-50 cursor-not-allowed" : "hover:bg-[#141414]"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2 pl-3">
                        <span
                          className={cn(
                            "text-[14px] font-medium leading-tight",
                            isDisabled ? "text-[#777777]" : "text-white"
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="text-[13px] text-[#777777] leading-normal mt-0.5 truncate" title={item.desc}>
                          {item.desc}
                        </span>
                      </div>

                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        disabled={isDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(itemKey);
                        }}
                        className={cn(
                          "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-0 bg-[#141414] ring-1 ring-[#3a3a3a] hover:ring-[#555555] focus:outline-none transition-all cursor-pointer",
                          isChecked && !isDisabled && "bg-[#2f80ed] ring-[#2f80ed]",
                          isChecked && isDisabled && "bg-[#2a2a2a] ring-[#3a3a3a]",
                          isDisabled && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {isChecked && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="text-white">
                            <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
