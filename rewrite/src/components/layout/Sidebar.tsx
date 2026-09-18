import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { Role } from '../../types';
import {
  Home,
  Terminal as TerminalIcon,
  ShieldCheck,
  Shield,
  Settings as SettingsIcon,
  Search,
  X,
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
  roles?: Role[];
}

interface SubRouteGroup {
  id: string;
  label: string;
  badge?: 'Beta' | 'New';
  children: SubRouteLeaf[];
}

type SubRouteItem = SubRouteLeaf | SubRouteGroup;

interface NavGroupItem {
  id: string;
  label: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'Beta' | 'New' | '2FA';
  roles?: Role[];
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
  const { user, hasRole } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Handle Ctrl+K shortcut to focus quick search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Click outside to close account menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sections: NavSectionData[] = [
    {
      title: 'Observe',
      items: [
        {
          id: 'auditLogs',
          label: 'Audit logs',
          icon: Search,
          to: '/logs',
          roles: ['admin', 'auditor', 'operator'],
        },
      ],
    },
    {
      title: 'Build',
      items: [
        {
          id: 'terminal',
          label: 'Terminal Console',
          icon: TerminalIcon,
          to: '/terminal',
          roles: ['admin'],
        },
      ],
    },
    {
      title: 'Protect & connect',
      items: [
        {
          id: 'twoFactor',
          label: 'Two-Factor Security',
          icon: ShieldCheck,
          badge: '2FA',
          to: '/2fa',
        },
        {
          id: 'accessControl',
          label: 'Members & Roles',
          icon: Shield,
          to: '/users',
          roles: ['admin'],
        },
      ],
    },
    {
      title: 'Manage account',
      items: [
        {
          id: 'configurations',
          label: 'Configurations',
          icon: SettingsIcon,
          to: '/settings',
          roles: ['admin'],
        },
      ],
    },
  ];

  // Quick search filtering logic
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();

    return sections
      .map((sec) => {
        const filteredItems = sec.items
          .map((item) => {
            if (item.roles && !hasRole(item.roles)) return null;
            const matchesItem = item.label.toLowerCase().includes(q);

            if (item.subRoutes) {
              const matchingSubRoutes = item.subRoutes.filter((sub) => {
                if ('roles' in sub && sub.roles && !hasRole(sub.roles)) return false;
                if (sub.label.toLowerCase().includes(q)) return true;
                if ('children' in sub && sub.children) {
                  return sub.children.some((c) => c.label.toLowerCase().includes(q));
                }
                return false;
              });

              if (matchesItem || matchingSubRoutes.length > 0) {
                return {
                  ...item,
                  subRoutes: matchesItem ? item.subRoutes : matchingSubRoutes,
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
  }, [searchQuery, sections, hasRole]);

  const displayAccountName = user?.username
    ? `${user.username}@gmail.com's Account`
    : "Mrtx18427@gmail.com's Account";

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
        {/* Top Header (Height: 58px matching Cloudflare) */}
        {/* ========================================== */}
        <div
          data-sidebar="header"
          className={cn(
            'flex h-[58px] shrink-0 items-center gap-1 border-b border-[#222222] overflow-hidden transition-[padding] duration-200',
            isCollapsed ? 'px-2 justify-center' : 'px-3'
          )}
        >
          <div className="flex items-center gap-1 w-full min-w-0">
            {/* Cloudflare Two-Tone Cloud Logo SVG */}
            <button
              onClick={() => handleNavigate('/dashboard')}
              aria-label="Cloudflare home"
              className={cn(
                'translate-y-0.5 cursor-pointer origin-left shrink-0 transition-transform duration-200 bg-transparent border-0 p-0',
                isCollapsed ? 'scale-[0.8] mx-auto' : 'scale-100'
              )}
            >
              <div data-sentry-component="CloudflareLogo">
                <svg
                  viewBox="0 0 460 271.2"
                  width="44"
                  height="44"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path
                    fill="#FF9911"
                    d="M328.6,125.6c-0.8,0-1.5,0.6-1.8,1.4l-4.8,16.7c-2.1,7.2-1.3,13.8,2.2,18.7 c3.2,4.5,8.6,7.1,15.1,7.4l26.2,1.6c0.8,0,1.5,0.4,1.9,1c0.4,0.6,0.5,1.5,0.3,2.2c-0.4,1.2-1.6,2.1-2.9,2.2l-27.3,1.6 c-14.8,0.7-30.7,12.6-36.3,27.2l-2,5.1c-0.4,1,0.3,2,1.4,2h93.8c1.1,0,2.1-0.7,2.4-1.8c1.6-5.8,2.5-11.9,2.5-18.2 c0-37-30.2-67.2-67.3-67.2C330.9,125.5,329.7,125.5,328.6,125.6z"
                  />
                  <path
                    fill="#FF5E1F"
                    d="M292.8,204.4c2.1-7.2,1.3-13.8-2.2-18.7c-3.2-4.5-8.6-7.1-15.1-7.4l-123.1-1.6 c-0.8,0-1.5-0.4-1.9-1s-0.5-1.4-0.3-2.2c0.4-1.2,1.6-2.1,2.9-2.2l124.2-1.6c14.7-0.7,30.7-12.6,36.3-27.2l7.1-18.5 c0.3-0.8,0.4-1.6,0.2-2.4c-8-36.2-40.3-63.2-78.9-63.2c-35.6,0-65.8,23-76.6,54.9c-7-5.2-15.9-8-25.5-7.1 c-17.1,1.7-30.8,15.4-32.5,32.5c-0.4,4.4-0.1,8.7,0.9,12.7c-27.9,0.8-50.2,23.6-50.2,51.7c0,2.5,0.2,5,0.5,7.5 c0.2,1.2,1.2,2.1,2.4,2.1h227.2c1.3,0,2.5-0.9,2.9-2.2L292.8,204.4z"
                  />
                </svg>
              </div>
            </button>

            {/* Account Switcher Trigger (Only in expanded mode) */}
            {!isCollapsed && (
              <div className="min-w-0 grow relative" ref={accountMenuRef}>
                <div className="flex items-center pr-0.5 min-w-0">
                  <button
                    onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                    className="flex items-center justify-between gap-2 w-full min-w-0 px-2.5 py-1.5 rounded-lg text-left bg-transparent border-0 font-sans hover:bg-[#161616] cursor-pointer transition-colors"
                    aria-label="Switch Account"
                    type="button"
                  >
                    <span className="flex flex-col min-w-0 overflow-hidden">
                      <span
                        className="block text-sm font-medium text-[#f3f4f6] truncate leading-snug"
                        title={displayAccountName}
                      >
                        {displayAccountName}
                      </span>
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                      className="shrink-0 text-[#8c8c8c]"
                    >
                      <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
                    </svg>
                  </button>
                </div>

                {/* Account Popover Menu */}
                {isAccountMenuOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-60 bg-[#121212] border border-[#262626] rounded-lg shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-2.5 py-2 border-b border-[#222222]">
                      <div className="text-xs font-medium text-white truncate">
                        {displayAccountName}
                      </div>
                      <div className="text-[11px] text-[#8c8c8c] capitalize">
                        Role: {user?.role || 'admin'}
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          handleNavigate('/users');
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors"
                      >
                        Manage Members
                      </button>
                      <button
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          handleNavigate('/settings');
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors"
                      >
                        Configurations
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="p-1 text-[#8c8c8c] hover:text-white md:hidden ml-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                <div className="group items-center select-none border-0 rounded-lg bg-[#0c0c0c] text-[#d4d4d4] ring-1 ring-[#262626] focus-within:ring-1 focus-within:ring-[#f6821f] flex h-8 text-sm font-normal shrink-0 w-full overflow-hidden px-3 gap-2.5 transition-all">
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
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Quick search..."
                    className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-[#8c8c8c] font-normal"
                  />
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-[#8c8c8c] hover:text-white text-xs p-0.5"
                    >
                      ✕
                    </button>
                  ) : (
                    <kbd className="ml-auto font-sans text-xs font-semibold text-[#d4d4d4] whitespace-nowrap select-none pointer-events-none shrink-0">
                      <span className="text-[#8c8c8c] font-medium">Ctrl</span>&nbsp;K
                    </kbd>
                  )}
                </div>
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
                    'group/menu-button relative flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg outline-none min-h-[34px] px-3 py-0 text-sm font-medium transition-colors duration-150',
                    isCurrentActive('/dashboard') && !searchQuery
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#d4d4d4] hover:bg-[#161616] hover:text-white'
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
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
                          'group/menu-button relative flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg outline-none min-h-[34px] px-3 py-0 text-sm font-medium transition-colors duration-150',
                          active
                            ? 'bg-[#1a1a1a] text-white'
                            : 'text-[#d4d4d4] hover:bg-[#161616] hover:text-white'
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
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
                                          ? 'bg-[#1a1a1a] text-white'
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
                                                  ? 'bg-[#1a1a1a] text-white'
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
            'flex h-12 min-h-[48px] shrink-0 items-center justify-between border-t border-[#222222] whitespace-nowrap bg-[#000000] sticky bottom-0 z-20 transition-all',
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

          {!isCollapsed && (
            <div className="flex items-center gap-2 text-[11px] text-[#8c8c8c]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-[#a3a3a3]">Cloudflare Edge</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
