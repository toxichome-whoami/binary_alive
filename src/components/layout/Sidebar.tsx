import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { Permissions } from '../../types';
import {
  Home,
  Terminal as TerminalIcon,
  ShieldCheck,
  Shield,
  Settings as SettingsIcon,
  Search,
  X,
  Key,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface SubRouteLeaf {
  id: string;
  label: string;
  to?: string;
  badge?: 'Beta' | 'New' | '2FA';
  permission?: keyof Permissions;
}

interface SubRouteGroup {
  id: string;
  label: string;
  badge?: 'Beta' | 'New';
  permission?: keyof Permissions;
  children: SubRouteLeaf[];
}

type SubRouteItem = SubRouteLeaf | SubRouteGroup;

interface NavGroupItem {
  id: string;
  label: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'Beta' | 'New' | '2FA';
  permission?: keyof Permissions;
  subRoutes?: SubRouteItem[];
}

interface NavSectionData {
  title: string | null;
  items: NavGroupItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});



  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sections: NavSectionData[] = [
    {
      title: 'Analytics & Logs',
      items: [
        {
          id: 'auditLogs',
          label: 'Audit Logs',
          icon: Search,
          to: '/logs',
          permission: 'logs_view_audit',
        },
        ...(user?.role === 'owner' ? [{
          id: 'aiHistory',
          label: 'AI History',
          icon: Sparkles,
          to: '/ai-history',
        }] : []),
      ],
    },
    {
      title: 'Security & Access',
      items: [
        {
          id: 'accessControl',
          label: 'Members',
          icon: Shield,
          to: '/users',
          permission: 'users_view',
        },
        {
          id: 'apiKeys',
          label: 'API Keys',
          icon: Key,
          to: '/api-keys',
          permission: 'api_keys_view',
        },
        {
          id: 'twoFactor',
          label: 'Two-Factor Auth',
          icon: ShieldCheck,
          to: '/2fa',
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          id: 'terminal',
          label: 'Terminal Console',
          icon: TerminalIcon,
          to: '/terminal',
          permission: 'terminal_access',
        },
        {
          id: 'settings',
          label: 'System Settings',
          icon: SettingsIcon,
          to: '/settings',
          permission: 'settings_view',
        },
      ],
    },
  ];

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return sections
      .map((sec) => {
        const filteredItems = sec.items
          .map((item) => {
            // Unconditionally filter out items the user lacks permission for
            if (item.permission && !hasPermission(item.permission)) return null;

            const matchesItem = q ? item.label.toLowerCase().includes(q) : true;

            if (item.subRoutes) {
              const matchingSubRoutes = item.subRoutes.filter((sub) => {
                if (sub.permission && !hasPermission(sub.permission)) return false;
                
                if (!q) return true;
                if (sub.label.toLowerCase().includes(q)) return true;
                if ('children' in sub && sub.children) {
                  return sub.children.some((c) => {
                    if (c.permission && !hasPermission(c.permission)) return false;
                    return c.label.toLowerCase().includes(q);
                  });
                }
                return false;
              });

              if (matchesItem || matchingSubRoutes.length > 0) {
                return {
                  ...item,
                  // If searching and item name matches, keep all (permission-filtered) subroutes
                  // If searching and item name doesn't match, only keep matching subroutes
                  subRoutes: (matchesItem && !q) ? matchingSubRoutes : matchingSubRoutes, 
                  // Wait, actually `matchingSubRoutes` is already permission-filtered.
                  // Let's just always use `matchingSubRoutes`. If `!q` it contains all permitted subroutes.
                };
              }
              return null;
            }

            return matchesItem ? item : null;
          })
          .filter(Boolean) as NavGroupItem[];

        return {
          ...sec,
          items: filteredItems,
        };
      })
      .filter((sec) => sec.items.length > 0);
  }, [searchQuery, sections, hasPermission, user]);

  const handleNavigate = (path?: string) => {
    if (path) {
      navigate(path);
      onClose();
    }
  };

  const isCurrentActive = (targetPath?: string) => {
    if (!targetPath) return false;
    if (targetPath === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === targetPath;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        data-sidebar="sidebar"
        className={cn(
          'flex min-h-screen shrink-0 flex-col bg-[#000000] border-r border-[#222222] transition-[width,transform] duration-200 select-none z-40',
          isCollapsed ? 'w-[58px]' : 'w-[260px]',
          'fixed md:sticky top-0 h-screen',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* ========================================== */}
        {/* Top Header: Name and Version               */}
        {/* ========================================== */}
        <div
          data-sidebar="header"
          className={cn(
            'flex h-[58px] shrink-0 items-center justify-center border-b border-[#222222] transition-[padding] duration-200 select-none relative z-30',
            isCollapsed ? 'px-2' : 'px-4'
          )}
        >
          <button
            onClick={() => handleNavigate('/dashboard')}
            aria-label="Binary Alive Dashboard"
            className="flex items-center justify-center gap-2 bg-transparent border-0 p-0 text-center cursor-pointer min-w-0 group"
          >
            {isCollapsed ? (
              <span className="font-['Montserrat',sans-serif] font-semibold text-[13px] text-[#F2F3F3] tracking-widest uppercase">
                BA
              </span>
            ) : (
              <div className="flex items-center justify-center gap-2 min-w-0">
                <span className="font-['Montserrat',sans-serif] text-[17px] text-[#F2F3F3] font-semibold tracking-[0.1em] truncate">
                  Binary Alive
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#161718] border border-[#26282A] text-[12px] text-[#A1A1A1] tracking-normal">
                  v2.4.1
                </span>
              </div>
            )}
          </button>

          {/* Mobile close button positioned absolute right to maintain centering */}
          <button
            onClick={onClose}
            className="p-1 text-[#8c8c8c] hover:text-white md:hidden absolute right-3 shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================== */}
        {/* Navigation Viewport & Scroll Area          */}
        {/* ========================================== */}
        <nav
          data-sidebar="content"
          className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden px-[11px] py-3 scrollbar-thin scrollbar-thumb-[#222222]"
        >
          {/* Quick Search Bar */}
          <div className="w-full shrink-0 px-0.5 pt-[0.5px] mb-3">
            {isCollapsed ? (
              <button
                onClick={onToggleCollapse}
                title="Quick search (Ctrl K)"
                className="flex size-8.5 items-center justify-center rounded-lg bg-[#0c0c0c] ring-1 ring-[#262626] text-[#8c8c8c] hover:bg-[#161616] hover:text-white mx-auto transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                  className="opacity-60"
                >
                  <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                </svg>
              </button>
            ) : (
              <div className="relative flex items-center group">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                  className="group items-center select-none border-0 rounded-lg bg-[#0c0c0c] text-[#d4d4d4] ring-1 ring-[#262626] hover:ring-[#3b82f6] flex h-8 text-sm font-normal shrink-0 w-full overflow-hidden px-3 gap-2.5 transition-all cursor-pointer text-left"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    fill="currentColor"
                    viewBox="0 0 256 256"
                    className="text-[#8c8c8c] shrink-0 opacity-60"
                  >
                    <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                  </svg>
                  <span className="w-full text-xs text-[#8c8c8c] font-normal flex-1">Quick search...</span>
                  <kbd className="ml-auto font-sans text-xs font-semibold text-[#d4d4d4] whitespace-nowrap select-none pointer-events-none shrink-0">
                    <span className="text-[#8c8c8c] font-medium">Ctrl</span>&nbsp;K
                  </kbd>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Menu Tree */}
          <ul data-sidebar="menu" className="m-0 flex min-w-0 list-none flex-col items-stretch gap-y-px p-0">
            {/* 1. Dashboard */}
            {(!searchQuery || 'dashboard'.includes(searchQuery.toLowerCase())) && (
              <li data-sidebar="menu-item" className="relative">
                <button
                  type="button"
                  onClick={() => handleNavigate('/dashboard')}
                  title="Dashboard"
                  className={cn(
                    'group/menu-button relative flex w-full min-w-0 cursor-pointer items-center rounded-lg outline-none min-h-[34px] py-0 text-sm font-medium transition-colors duration-150',
                    isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
                    isCurrentActive('/dashboard') && !searchQuery
                      ? 'bg-[#111111] text-white'
                      : 'text-[#d4d4d4] hover:bg-[#161616] hover:text-white'
                  )}
                >
                  <div className={cn("flex min-w-0 flex-1 items-center", isCollapsed ? "justify-center" : "gap-3")}>
                    <Home className="w-4 h-4 shrink-0 opacity-50 group-hover/menu-button:opacity-80" />
                    {!isCollapsed && <span className="truncate">Dashboard</span>}
                  </div>
                </button>
              </li>
            )}


            {/* Sections (Observe, Build, Protect & Connect, Manage Account) */}
            {filteredSections.map((sec, secIdx) => (
              <div key={secIdx} data-sidebar="group" className="flex min-w-0 flex-col gap-y-px">
                {/* Section Header */}
                {!isCollapsed && sec.title && (
                  <div data-sidebar="group-label" className="grid overflow-hidden">
                    <div className="mt-4 mb-2 truncate px-3 text-sm font-medium text-[#8c8c8c]">
                      {sec.title}
                    </div>
                  </div>
                )}

                {/* Section Items */}
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isExpanded = expandedGroups[item.id] || !!searchQuery;
                  const hasSubRoutes = item.subRoutes && item.subRoutes.length > 0;
                  const active = isCurrentActive(item.to);

                  return (
                    <li key={item.id} data-sidebar="menu-item" className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasSubRoutes) {
                            toggleGroup(item.id);
                          } else if (item.to) {
                            handleNavigate(item.to);
                          }
                        }}
                        title={item.label}
                        className={cn(
                          'group/menu-button relative flex w-full min-w-0 cursor-pointer items-center rounded-lg outline-none min-h-[34px] py-0 text-sm font-medium transition-colors duration-150',
                          isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
                          active
                            ? 'bg-[#111111] text-white'
                            : 'text-[#d4d4d4] hover:bg-[#161616] hover:text-white'
                        )}
                      >
                        <div className={cn("flex min-w-0 flex-1 items-center", isCollapsed ? "justify-center" : "gap-3")}>
                          <Icon className="w-4 h-4 shrink-0 opacity-50 group-hover/menu-button:opacity-80" />
                          {!isCollapsed && (
                            <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-[#383838] px-1.5 py-0.5 text-[11px]/none font-medium text-[#d4d4d4] select-none">
                                  {item.badge}
                                </span>
                              )}
                              {hasSubRoutes && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="12"
                                  height="12"
                                  fill="currentColor"
                                  viewBox="0 0 256 256"
                                  className={cn(
                                    'ml-auto shrink-0 opacity-40 transition-transform duration-200 group-hover/menu-button:opacity-100',
                                    isExpanded ? 'rotate-90' : ''
                                  )}
                                >
                                  <path d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Sub-routes */}
                      {!isCollapsed && hasSubRoutes && isExpanded && (
                        <div className="overflow-hidden">
                          <ul
                            data-sidebar="menu-sub"
                            className="relative m-0 flex min-w-0 list-none flex-col gap-y-px overflow-hidden p-0 pr-0 pl-7"
                          >
                            <div className="absolute inset-y-px left-[19px] z-10 w-px bg-[#262626]" />
                            {item.subRoutes!.map((sub) => {
                              // If leaf item:
                              if (!('children' in sub)) {
                                const subActive = isCurrentActive(sub.to);
                                return (
                                  <li key={sub.id} data-sidebar="menu-sub-item" className="relative">
                                    <a
                                      href={`#${sub.to || '/dashboard'}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleNavigate(sub.to || '/dashboard');
                                      }}
                                      className={cn(
                                        'group/menu-button relative flex min-h-[34px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-0 text-sm font-medium outline-none transition-colors duration-150',
                                        subActive
                                          ? 'bg-[#111111] text-white'
                                          : 'text-[#a3a3a3] hover:text-white hover:bg-[#161616]'
                                      )}
                                    >
                                      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
                                        <span className="truncate">{sub.label}</span>
                                        {sub.badge && (
                                          <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-[#383838] px-1.5 py-0.5 text-[11px]/none font-medium text-[#d4d4d4] select-none">
                                            {sub.badge}
                                          </span>
                                        )}
                                      </span>
                                    </a>
                                  </li>
                                );
                              }

                              // If nested expandable sub-group (e.g. Email Service, Log Explorer, Insights):
                              const isSubGroupExpanded = expandedGroups[sub.id] || !!searchQuery;
                              return (
                                <li key={sub.id} data-sidebar="menu-sub-item" className="relative">
                                  <button
                                    type="button"
                                    onClick={() => toggleGroup(sub.id)}
                                    className="group/menu-button relative flex min-h-[34px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-0 text-sm font-medium outline-none text-[#a3a3a3] hover:text-white hover:bg-[#161616] transition-colors duration-150"
                                  >
                                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
                                      <span className="truncate">{sub.label}</span>
                                      {sub.badge && (
                                        <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-[#383838] px-1.5 py-0.5 text-[11px]/none font-medium text-[#d4d4d4] select-none">
                                          {sub.badge}
                                        </span>
                                      )}
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        fill="currentColor"
                                        viewBox="0 0 256 256"
                                        className={cn(
                                          'ml-auto shrink-0 opacity-40 transition-transform duration-200 group-hover/menu-button:opacity-100',
                                          isSubGroupExpanded ? 'rotate-90' : ''
                                        )}
                                      >
                                        <path d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z" />
                                      </svg>
                                    </span>
                                  </button>

                                  {/* Level 3 Children */}
                                  {isSubGroupExpanded && (
                                    <div className="overflow-hidden">
                                      <ul
                                        data-sidebar="menu-sub"
                                        className="relative m-0 flex min-w-0 list-none flex-col gap-y-px overflow-hidden p-0 pr-0 pl-7"
                                      >
                                        <div className="absolute inset-y-px left-[19px] z-10 w-px bg-[#262626]" />
                                        {sub.children.map((child) => (
                                          <li
                                            key={child.id}
                                            data-sidebar="menu-sub-item"
                                            className="relative"
                                          >
                                            <a
                                              href={`#${child.to || '/dashboard'}`}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                handleNavigate(child.to || '/dashboard');
                                              }}
                                              className={cn(
                                                'group/menu-button relative flex min-h-[34px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-0 text-sm font-medium outline-none transition-colors duration-150',
                                                isCurrentActive(child.to)
                                                  ? 'bg-[#111111] text-white'
                                                  : 'text-[#a3a3a3] hover:text-white hover:bg-[#161616]'
                                              )}
                                            >
                                              <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
                                                <span className="truncate">{child.label}</span>
                                                {child.badge && (
                                                  <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-[#383838] px-1.5 py-0.5 text-[11px]/none font-medium text-[#d4d4d4] select-none">
                                                    {child.badge}
                                                  </span>
                                                )}
                                              </span>
                                            </a>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </div>
            ))}
          </ul>
        </nav>

        {/* ========================================== */}
        {/* Footer: Toggle Collapse & Edge Status      */}
        {/* ========================================== */}
        <div
          data-sidebar="footer"
          className={cn(
            'flex h-12 min-h-[48px] shrink-0 items-center border-t border-[#222222] whitespace-nowrap bg-[#000000] sticky bottom-0 z-20 transition-all',
            isCollapsed ? 'px-2 justify-center' : 'px-4'
          )}
        >
          <button
            type="button"
            data-sidebar="trigger"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapse}
            className="flex size-8.5 shrink-0 items-center justify-center rounded-lg text-[#8c8c8c] hover:bg-[#161616] hover:text-neutral-200 cursor-pointer transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="shrink-0"
            >
              <path d="M21.25 6.72v10.56a2.97 2.97 0 0 1-2.97 2.97H5.72a2.97 2.97 0 0 1-2.97-2.97V6.72a2.97 2.97 0 0 1 2.97-2.97h12.56a2.97 2.97 0 0 1 2.97 2.97" />
              <path
                d="M6.25 7.25v9.5"
                className={cn(
                  'transition-transform duration-200',
                  isCollapsed ? 'translate-x-1' : 'translate-x-px'
                )}
              />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
};
