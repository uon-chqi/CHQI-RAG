import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'national' | 'county';
  facility_id?: string;
  facility_name?: string;
  facility_code?: string;
  county_id?: string;
  county_name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => void;
  isSuperAdmin: boolean;
  isNational: boolean;
  isCounty: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    // ── DEV BYPASS ── remove VITE_DEV_BYPASS from .env.development when done
    if (import.meta.env.VITE_DEV_BYPASS === 'true') {
      const devUser: AuthUser = { id: 'super_admin', name: 'Dev Bypass', email: 'dev@localhost', role: 'super_admin' };
      setToken('dev-bypass-token');
      setUser(devUser);
      localStorage.setItem('chqi_token', 'dev-bypass-token');
      localStorage.setItem('chqi_user', JSON.stringify(devUser));
      setLoading(false);
      return;
    }
    const storedToken = localStorage.getItem('chqi_token');
    const storedUser = localStorage.getItem('chqi_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('chqi_token');
        localStorage.removeItem('chqi_user');
      }
    }
    setLoading(false);
  }, []);

  // ── Auto-logout on 401 ──────────────────────────────────
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && token) {
        console.warn('🔒 Session expired — logging out');
        logout();
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  const login = async (email: string, password: string, username?: string) => {
    const body: Record<string, string> = { password };
    if (username) body.username = username;
    else body.email = email;

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    const { token: newToken, user: newUser } = data.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('chqi_token', newToken);
    localStorage.setItem('chqi_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('chqi_token');
    localStorage.removeItem('chqi_user');
    // Redirect to login page
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isSuperAdmin: user?.role === 'super_admin',
        isNational: user?.role === 'national',
        isCounty: user?.role === 'county',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
