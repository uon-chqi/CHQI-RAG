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
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const canAccess = (item: NavLinkItem) => !item.requiresSuperAdmin || isSuperAdmin;
  const isGroupActive = (group: NavGroupItem) => group.children.some((child) => isActive(child.path));

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
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      {/* ── Top Navigation Bar ─────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-white/10 shadow-lg" style={{ backgroundColor: 'rgba(10,27,58,0.97)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand + Partner Logos */}
            <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
              <span className="text-white font-bold text-lg tracking-tight group-hover:text-blue-200 transition-colors">
                SMS-PORTAL
              </span>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-px h-5 bg-white/20" />
                <img
                  src="https://i.postimg.cc/ZqBXLY7F/Ministy-of-Health-logo.png"
                  alt="Ministry of Health Kenya"
                  className="h-7 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                />
                <img
                  src="https://i.postimg.cc/sD3dRrxK/NASCOP-logo.png"
                  alt="NASCOP"
                  className="h-7 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                />
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {navItems.map((item) => {
                if (isNavGroup(item)) {
                  const active = isGroupActive(item);
                  return (
                    <div key={item.label} className="relative" ref={desktopSmsRef}>
                      <button
                        onClick={() => setDesktopSmsOpen((v) => !v)}
                        className={`relative px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap inline-flex items-center gap-1 ${
                          active || desktopSmsOpen
                            ? 'bg-white/15 text-white shadow-sm'
                            : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'
                        }`}
                        aria-expanded={desktopSmsOpen}
                        aria-label="Toggle SMS Configuration menu"
                      >
                        {item.label}
                        <ChevronDown size={14} className={`transition-transform ${desktopSmsOpen ? 'rotate-180' : ''}`} />
                        {active && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-blue-400 rounded-full" />
                        )}
                      </button>

                      {desktopSmsOpen && (
                        <div className="absolute top-full mt-2 left-0 min-w-52 rounded-xl border border-white/10 bg-[#0E2246] shadow-xl p-1.5 z-50">
                          {item.children.map((child) => {
                            const childActive = isActive(child.path);
                            if (!canAccess(child)) {
                              return (
                                <div key={child.path} className="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-200/40 text-[13px]" title="Super Admin access required">
                                  <Lock size={12} /><span>{child.label}</span>
                                </div>
                              );
                            }
                            return (
                              <Link key={child.path} to={child.path} className={`block px-3 py-2 rounded-lg text-[13px] transition-all ${childActive ? 'bg-white/15 text-white' : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'}`}>
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
                  <Link key={item.path} to={item.path} className={`relative px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${isActive(item.path) ? 'bg-white/15 text-white shadow-sm' : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'}`}>
                    {item.label}
                    {isActive(item.path) && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-blue-400 rounded-full" />}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 border border-white/20 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{(user?.name || user?.email || 'U')[0].toUpperCase()}</span>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-semibold leading-tight">{user?.role === 'super_admin' ? 'Super Admin' : (user?.name || user?.email || 'User')}</p>
                  <p className="text-blue-300/60 text-[10px] capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="w-px h-6 bg-white/15" />
              <button onClick={logout} className="px-3 py-1.5 text-xs font-medium text-blue-200/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Logout</button>
            </div>

            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-blue-200 hover:bg-white/10 transition-colors" aria-label="Open menu">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ─────────────────────────────────── */}
      <div className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileOpen(false)} />
      <aside className={`fixed top-0 left-0 z-[70] h-full w-72 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: NAVY }}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg tracking-tight">SMS-PORTAL</span>
            <div className="flex items-center gap-1.5 ml-2">
              <img src="https://i.postimg.cc/ZqBXLY7F/Ministy-of-Health-logo.png" alt="MOH" className="h-6 w-auto object-contain opacity-80" />
              <img src="https://i.postimg.cc/sD3dRrxK/NASCOP-logo.png" alt="NASCOP" className="h-6 w-auto object-contain opacity-80" />
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-blue-200/70 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            if (isNavGroup(item)) {
              const active = isGroupActive(item);
              return (
                <div key={item.label} className="rounded-xl bg-white/[0.03] border border-white/5">
                  <button onClick={() => setMobileSmsOpen((v) => !v)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'text-white' : 'text-blue-200/80 hover:text-white'}`}>
                    <span>{item.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${mobileSmsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileSmsOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {item.children.map((child) => {
                        const childActive = isActive(child.path);
                        if (!canAccess(child)) {
                          return <div key={child.path} className="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-200/40 text-sm"><Lock size={12} /><span>{child.label}</span></div>;
                        }
                        return <Link key={child.path} to={child.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${childActive ? 'bg-white/15 text-white' : 'text-blue-200/80 hover:bg-white/[0.07] hover:text-white'}`}>{child.label}{childActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}</Link>;
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive(item.path) ? 'bg-white/15 text-white shadow-sm' : 'text-blue-200/80 hover:bg-white/[0.07] hover:text-white'}`}>{item.label}{isActive(item.path) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}</Link>;
          })}
        </nav>
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">{(user?.name || user?.email || 'U')[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.role === 'super_admin' ? 'Super Admin' : (user?.name || user?.email)}</p>
              <p className="text-blue-300/50 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={() => { logout(); setMobileOpen(false); }} className="w-full px-4 py-2.5 text-sm font-medium text-blue-200/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all text-center">Logout</button>
        </div>
      </aside>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
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