import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'national' | 'county' | 'facility';
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
  registerFacility: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isSuperAdmin: boolean;
  isFacility: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  facility_name: string;
  facility_code?: string;
  county_name?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
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

  const registerFacility = async (formData: RegisterData) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Registration failed');
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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerFacility,
        logout,
        isSuperAdmin: user?.role === 'super_admin',
        isFacility: user?.role === 'facility',
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
