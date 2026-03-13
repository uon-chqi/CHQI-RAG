import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Tab = 'login' | 'register';

export default function Login() {
  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, registerFacility } = useAuth();
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFacilityName, setRegFacilityName] = useState('');
  const [regFacilityCode, setRegFacilityCode] = useState('');
  const [regCounty, setRegCounty] = useState('');

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerFacility({
        name: regName, email: regEmail, password: regPassword,
        facility_name: regFacilityName, facility_code: regFacilityCode, county_name: regCounty,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30 focus:border-navy-900 transition-all';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      {/* Brand */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">CHQI Health</h1>
        <p className="text-gray-500 text-sm mt-1">Centre for Healthcare Quality and Innovation</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === 'login' ? 'bg-navy-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === 'register' ? 'bg-navy-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Register Facility
          </button>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@facility.go.ke" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Enter your password" required className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 disabled:opacity-50 transition-all shadow-lg shadow-navy-900/20 mt-2">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Full name" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="admin@facility.go.ke" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Minimum 8 characters" required minLength={8} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Facility Name</label>
              <input type="text" value={regFacilityName} onChange={e => setRegFacilityName(e.target.value)} placeholder="e.g. Kenyatta National Hospital" required className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Facility Code</label>
                <input type="text" value={regFacilityCode} onChange={e => setRegFacilityCode(e.target.value)} placeholder="e.g. KNH" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">County</label>
                <input type="text" value={regCounty} onChange={e => setRegCounty(e.target.value)} placeholder="e.g. Nairobi" className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 disabled:opacity-50 transition-all shadow-lg shadow-navy-900/20 mt-2">
              {loading ? 'Creating Account...' : 'Create Facility Account'}
            </button>
          </form>
        )}

        <p className="text-center text-gray-400 text-xs mt-8">
          Super Admin? Login with your assigned credentials.
        </p>
      </div>
    </div>
  );
}
