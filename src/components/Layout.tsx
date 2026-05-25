import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAVY = '#0A1B3A';

type NavLinkItem = {
  path: string;
  label: string;
  requiresSuperAdmin?: boolean;
};

type NavGroupItem = {
  label: string;
  children: NavLinkItem[];
};

type NavItem = NavLinkItem | NavGroupItem;

function isNavGroup(item: NavItem): item is NavGroupItem {
  return 'children' in item;
}

const smsModuleGroup: NavGroupItem = {
  label: 'SMS Configuration',
  children: [
    { path: '/admin/sms-templates', label: 'Templates', requiresSuperAdmin: true },
    { path: '/admin/workflows', label: 'Workflows', requiresSuperAdmin: true },
    { path: '/admin/workflow-simulation', label: 'Workflow Simulation', requiresSuperAdmin: true },
  ],
};

const superAdminNav: NavItem[] = [
  { path: '/', label: 'Home' },
  { path: '/outbox', label: 'Outbox' },
  { path: '/inbox', label: 'Inbox' },
  { path: '/documents', label: 'Document Library' },
  smsModuleGroup,
  { path: '/organisations', label: 'Facilities' },
  { path: '/admin/users', label: 'Users' },
];

const nationalNav: NavItem[] = [
  { path: '/', label: 'Home' },
  { path: '/outbox', label: 'Outbox' },
  { path: '/inbox', label: 'Inbox' },
  smsModuleGroup,
  { path: '/organisations', label: 'Facilities' },
];

const countyNav: NavItem[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/outbox', label: 'Outbox' },
  smsModuleGroup,
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSmsOpen, setDesktopSmsOpen] = useState(false);
  const [mobileSmsOpen, setMobileSmsOpen] = useState(false);
  const location = useLocation();
  const { user, logout, isSuperAdmin, isNational, isCounty } = useAuth();
  const desktopSmsRef = useRef<HTMLDivElement | null>(null);

  const navItems = isSuperAdmin ? superAdminNav : isNational ? nationalNav : countyNav;
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const canAccess = (item: NavLinkItem) => !item.requiresSuperAdmin || isSuperAdmin;
  const isGroupActive = (group: NavGroupItem) =>
    group.children.some((child) => isActive(child.path));

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!desktopSmsRef.current) return;
      if (!desktopSmsRef.current.contains(event.target as Node)) {
        setDesktopSmsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    setDesktopSmsOpen(false);
    setMobileSmsOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════
          TOP NAVIGATION BAR
      ══════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b border-white/10 shadow-lg"
        style={{ backgroundColor: 'rgba(10,27,58,0.97)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">

            {/* ── Brand: name + logos stacked below ── */}
            <Link
              to="/"
              className="flex flex-col items-start flex-shrink-0 group select-none"
              aria-label="SMS-PORTAL home"
            >
              {/* Brand name */}
              <span className="text-white font-extrabold text-xl tracking-widest uppercase leading-none group-hover:text-blue-200 transition-colors duration-200">
                SMS-PORTAL
              </span>

              {/* Partner logos row — sits below the brand name */}
              <div className="flex items-center gap-2.5 mt-1.5">
                <img
                  src="https://i.postimg.cc/ZqBXLY7F/Ministy-of-Health-logo.png"
                  alt="Ministry of Health Kenya"
                  className="h-6 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity duration-200"
                />
                <div className="w-px h-4 bg-white/20 rounded-full" />
                <img
                  src="https://i.postimg.cc/sD3dRrxK/NASCOP-logo.png"
                  alt="NASCOP"
                  className="h-6 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity duration-200"
                />
              </div>
            </Link>

            {/* ── Desktop Nav ── */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {navItems.map((item) => {
                if (isNavGroup(item)) {
                  const active = isGroupActive(item);
                  return (
                    <div key={item.label} className="relative" ref={desktopSmsRef}>
                      <button
                        onClick={() => setDesktopSmsOpen((v) => !v)}
                        className={`relative px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                          active || desktopSmsOpen
                            ? 'bg-white/15 text-white shadow-sm'
                            : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'
                        }`}
                        aria-expanded={desktopSmsOpen}
                        aria-haspopup="true"
                        aria-label="Toggle SMS Configuration menu"
                      >
                        {item.label}
                        <ChevronDown
                          size={13}
                          className={`transition-transform duration-200 ${desktopSmsOpen ? 'rotate-180' : ''}`}
                        />
                        {active && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-blue-400 rounded-full" />
                        )}
                      </button>

                      {desktopSmsOpen && (
                        <div className="absolute top-full mt-2 left-0 min-w-56 rounded-xl border border-white/10 bg-[#0E2246] shadow-2xl p-1.5 z-50">
                          {item.children.map((child) => {
                            const childActive = isActive(child.path);
                            if (!canAccess(child)) {
                              return (
                                <div
                                  key={child.path}
                                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-blue-200/35 text-[13px] cursor-not-allowed"
                                  title="Super Admin access required"
                                >
                                  <Lock size={11} />
                                  <span>{child.label}</span>
                                </div>
                              );
                            }
                            return (
                              <Link
                                key={child.path}
                                to={child.path}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                                  childActive
                                    ? 'bg-white/15 text-white font-medium'
                                    : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'
                                }`}
                              >
                                {childActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                )}
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                      isActive(item.path)
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    {item.label}
                    {isActive(item.path) && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-blue-400 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ── Desktop User / Logout ── */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {(user?.name || user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-semibold leading-tight">
                    {user?.role === 'super_admin' ? 'Super Admin' : (user?.name || user?.email || 'User')}
                  </p>
                  <p className="text-blue-300/55 text-[10px] capitalize leading-tight mt-0.5">
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="w-px h-6 bg-white/15" />
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs font-medium text-blue-200/75 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                Logout
              </button>
            </div>

            {/* ── Mobile Hamburger ── */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-blue-200 hover:bg-white/10 active:bg-white/15 transition-colors"
              aria-label="Open navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MOBILE DRAWER — backdrop
      ══════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ══════════════════════════════════════════════════════
          MOBILE DRAWER — panel
      ══════════════════════════════════════════════════════ */}
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-72 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: NAVY }}
        aria-label="Mobile navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-20 border-b border-white/10 flex-shrink-0">
          {/* Brand + stacked logos — mirrors desktop */}
          <Link
            to="/"
            className="flex flex-col items-start group"
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-white font-extrabold text-base tracking-widest uppercase leading-none">
              SMS-PORTAL
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <img
                src="https://i.postimg.cc/ZqBXLY7F/Ministy-of-Health-logo.png"
                alt="Ministry of Health Kenya"
                className="h-5 w-auto object-contain opacity-80"
              />
              <div className="w-px h-3.5 bg-white/20 rounded-full" />
              <img
                src="https://i.postimg.cc/sD3dRrxK/NASCOP-logo.png"
                alt="NASCOP"
                className="h-5 w-auto object-contain opacity-80"
              />
            </div>
          </Link>

          {/* Close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg text-blue-200/70 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors flex-shrink-0"
            aria-label="Close navigation menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            if (isNavGroup(item)) {
              const active = isGroupActive(item);
              return (
                <div key={item.label} className="rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.03]">
                  <button
                    onClick={() => setMobileSmsOpen((v) => !v)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium transition-all ${
                      active ? 'text-white' : 'text-blue-200/80 hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 flex-shrink-0 ${mobileSmsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {mobileSmsOpen && (
                    <div className="px-2 pb-2 pt-0.5 space-y-0.5 border-t border-white/[0.06]">
                      {item.children.map((child) => {
                        const childActive = isActive(child.path);
                        if (!canAccess(child)) {
                          return (
                            <div
                              key={child.path}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-blue-200/35 text-sm cursor-not-allowed"
                              title="Super Admin access required"
                            >
                              <Lock size={11} className="flex-shrink-0" />
                              <span>{child.label}</span>
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                              childActive
                                ? 'bg-white/15 text-white font-medium'
                                : 'text-blue-200/80 hover:bg-white/[0.07] hover:text-white'
                            }`}
                          >
                            <span>{child.label}</span>
                            {childActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-blue-200/80 hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {isActive(item.path) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer — user info + logout */}
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {user?.role === 'super_admin' ? 'Super Admin' : (user?.name || user?.email)}
              </p>
              <p className="text-blue-300/50 text-xs capitalize leading-tight mt-0.5">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => { logout(); setMobileOpen(false); }}
            className="w-full px-4 py-2.5 text-sm font-medium text-blue-200/80 hover:text-white bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-xl transition-all text-center"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          PAGE CONTENT
      ══════════════════════════════════════════════════════ */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="bg-gray-100 border-t border-gray-200 py-5">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-gray-700">SMS-PORTAL</p>
            <p className="text-xs text-gray-500 mt-0.5">
              &copy; {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <img
              src="https://i.postimg.cc/ZqBXLY7F/Ministy-of-Health-logo.png"
              alt="Ministry of Health Kenya"
              className="h-10 w-auto object-contain"
            />
            <img
              src="https://i.postimg.cc/sD3dRrxK/NASCOP-logo.png"
              alt="NASCOP"
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}