import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30 focus:border-navy-900 transition-all';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      {/* Brand + Partner Logos */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">SMS-PORTAL</h1>
        <div className="flex items-center justify-center gap-8">
          <img
            src="https://i.postimg.cc/ZqBXLY7F/Ministy-of-Health-logo.png"
            alt="Ministry of Health Kenya"
            className="h-14 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
          />
          <div className="w-px h-10 bg-gray-300" />
          <img
            src="https://i.postimg.cc/sD3dRrxK/NASCOP-logo.png"
            alt="NASCOP"
            className="h-14 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Sign In</h2>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email / Username</label>
            <input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Enter your email or username" required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Enter your password" required className={inputClass} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 disabled:opacity-50 transition-all shadow-lg shadow-navy-900/20 mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-8">
          Contact your administrator for account access.
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-gray-400 text-xs mt-6">
        &copy; {new Date().getFullYear()} CHQI — Ministry of Health & NASCOP. All rights reserved.
      </p>
    </div>
  );
}