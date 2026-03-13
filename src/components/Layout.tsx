import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAVY = '#0A1B3A';

const superAdminNav = [
  { path: '/', label: 'Home' },
  { path: '/conversations', label: 'Conversations' },
  { path: '/live', label: 'Live Messages' },
  { path: '/documents', label: 'Document Library' },
  { path: '/sms-configuration', label: 'SMS Config' },
  { path: '/patient-management', label: 'Patients' },
  { path: '/organisations', label: 'Organisations' },
];

const facilityNav = [
  { path: '/', label: 'Dashboard' },
  { path: '/conversations', label: 'Conversations' },
  { path: '/patient-management', label: 'Patients' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout, isSuperAdmin } = useAuth();

  const navItems = isSuperAdmin ? superAdminNav : facilityNav;
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top Navigation Bar ─────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-white/10 shadow-lg" style={{ backgroundColor: 'rgba(10,27,58,0.97)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <span className="text-white font-bold text-lg tracking-tight group-hover:text-blue-200 transition-colors">
                CHQI
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {navItems.map(item => (
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
              ))}
            </nav>

            {/* User Section */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 border border-white/20 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {(user?.name || user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-semibold leading-tight">
                    {user?.role === 'super_admin' ? 'Super Admin' : (user?.name || user?.email || 'User')}
                  </p>
                  <p className="text-blue-300/60 text-[10px] capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="w-px h-6 bg-white/15" />
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs font-medium text-blue-200/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                Logout
              </button>
            </div>

            {/* Mobile Toggle */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-blue-200 hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Left Drawer ─────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />
      {/* Drawer panel */}
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-72 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: NAVY }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 flex-shrink-0">
          <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-300 flex items-center justify-center text-navy-900 font-black text-sm shadow-md">
              C
            </div>
            <span className="text-white font-bold text-lg tracking-tight">CHQI Health</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-blue-200/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive(item.path)
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-blue-200/80 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              {item.label}
              {isActive(item.path) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </Link>
          ))}
        </nav>

        {/* Drawer footer — user info */}
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {user?.role === 'super_admin' ? 'Super Admin' : (user?.name || user?.email)}
              </p>
              <p className="text-blue-300/50 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); setMobileOpen(false); }}
            className="w-full px-4 py-2.5 text-sm font-medium text-blue-200/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all text-center"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
