import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Clock,
  FileText,
  BarChart3,
  Activity,
  Bell,
  Search,
  User,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MessageCircle,
  Settings,
  Users,
} from 'lucide-react';
import { Input } from './ui/input';
import { api } from '../lib/api';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chat', icon: MessageCircle, label: 'Live Chat' },
  { path: '/live', icon: MessageSquare, label: 'Live Messages' },
  { path: '/conversations', icon: Clock, label: 'Conversations' },
  { path: '/documents', icon: FileText, label: 'Document Library' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/system', icon: Activity, label: 'System Health' },
  { path: '/sms-configuration', icon: Settings, label: 'SMS Configuration' },
  { path: '/patient-management', icon: Users, label: 'Patient Management' },
];

export default function Layout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = navItems.find((item) => item.path === location.pathname);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await api.getConversations();
      const conversations = response.data || [];
      
      // Search in conversations by phone number and message content
      const filtered = conversations.filter((conv: any) =>
        conv.patient_phone.toLowerCase().includes(query.toLowerCase()) ||
        conv.message.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5); // Limit to 5 results
      
      setSearchResults(filtered);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const handleLinkClick = () => {
    setSidebarExpanded(false);
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside
        className={`${
          sidebarExpanded ? 'w-64' : 'w-20'
        } bg-green-600 fixed left-0 top-0 bottom-0 transition-all duration-300 ease-in-out z-20 flex-col hidden lg:flex`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-emerald-700/30">
          <img
            src="https://i.pinimg.com/1200x/a3/0b/38/a30b38605e0054b19fdbd9332eadad08.jpg"
            alt="Healthcare logo"
            className="w-6 h-6 rounded object-cover"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleLinkClick}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-100 hover:bg-emerald-700/30'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Expand/Collapse Button */}
        <div className="p-3 border-t border-emerald-700/30">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-full flex items-center justify-center py-2 rounded-lg text-emerald-100 hover:bg-emerald-700/30 transition-colors"
          >
            {sidebarExpanded ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-green-600 fixed left-0 top-0 bottom-0 w-64 transition-transform duration-300 ease-in-out z-30 flex flex-col lg:hidden`}
      >
        {/* Mobile Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-700/30">
          <img
            src="https://i.pinimg.com/1200x/a3/0b/38/a30b38605e0054b19fdbd9332eadad08.jpg"
            alt="Healthcare logo"
            className="w-6 h-6 rounded object-cover"
          />
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg text-emerald-100 hover:bg-emerald-700/30 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleLinkClick}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-100 hover:bg-emerald-700/30'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300 ease-in-out`}>
        {/* Top Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-shrink">
              {/* Mobile Hamburger Menu */}
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                  {currentPage?.label || 'Dashboard'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">
                  Healthcare RAG Medical Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              {/* Search - Hidden on small screens */}
              <div className="relative hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 w-48 xl:w-64 bg-gray-50/50 border-gray-200 text-sm"
                />
                
                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {searchResults.map((result) => (
                      <Link
                        key={result.id}
                        to={`/conversations?phone=${encodeURIComponent(result.patient_phone)}`}
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                          setShowSearchResults(false);
                        }}
                        className="block px-4 py-3 hover:bg-green-50 border-b last:border-b-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{result.patient_phone}</div>
                        <div className="text-xs text-gray-500 truncate">{result.message}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity duration-300 ease-in-out"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
