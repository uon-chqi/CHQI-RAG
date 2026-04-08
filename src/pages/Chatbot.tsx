import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper to create a session for admin
const getAdminSession = (user: any) => user ? {
  patient_id: `admin-${user.id}`,
  first_name: user.first_name || user.name || 'Admin',
  last_name: user.last_name || '',
  phone: 'N/A',
  ccc_number: 'ADMIN-PORTAL',
  facility_name: 'Admin Console',
} : null;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isLoading?: boolean;
}

interface PatientSession {
  patient_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  ccc_number: string;
  facility_name: string;
}

export default function Chatbot() {
  // ── ADMIN CHECK using AuthContext ──

  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  // Always set a session for admin
  const [session, setSession] = useState<PatientSession | null>(
    isAdmin && user ? getAdminSession(user) : null
  );

  useEffect(() => {
    if (isAdmin && user) {
      setSession(getAdminSession(user));
    }
  }, [isAdmin, user]);

  // ── LOGIN STATE ──
  const [phone, setPhone] = useState('');
  const [ccc, setCcc] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // ── CHAT STATE ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  // ── ACTIVE SESSION (for both admin and regular users) ──
  const activeSession = session || (isAdmin && user ? getAdminSession(user) : null);

  // Load conversation history when session exists (only for non-admin)
  useEffect(() => {
    if (session && !isAdmin) loadHistory();
  }, [session?.patient_id, isAdmin]);

  // ── LOGIN ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !ccc.trim()) return;
    setLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(`${API_BASE}/api/chatbot/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), ccc_number: ccc.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      const sess: PatientSession = data.data;
      setSession(sess);
      localStorage.setItem('chatbot_session', JSON.stringify(sess));
    } catch {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setSession(isAdmin && user ? getAdminSession(user) : null);
    setMessages([]);
    // For admins, logout is handled by AuthContext/Auth system
    // For regular users, clear localStorage
    if (!isAdmin) {
      localStorage.removeItem('chatbot_session');
    }
  };

  // ── LOAD HISTORY ──
  const loadHistory = async () => {
    if (!session || isAdmin) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/history/${session.patient_id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const history: Message[] = [];
        for (const conv of data.data) {
          history.push({ id: `u-${conv.id}`, text: conv.message, sender: 'user', timestamp: new Date(conv.created_at) });
          if (conv.response) {
            history.push({ id: `b-${conv.id}`, text: conv.response, sender: 'bot', timestamp: new Date(conv.created_at) });
          }
        }
        setMessages(history);
      }
    } catch {
      /* start fresh */
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── SEND MESSAGE ──
  const handleSend = async () => {
    if (!input.trim() || sending || !activeSession) return;
    const text = input.trim();
    const userMsg: Message = { id: `u-${Date.now()}`, text, sender: 'user', timestamp: new Date() };
    const loadingMsg: Message = { id: `b-${Date.now()}`, text: '', sender: 'bot', timestamp: new Date(), isLoading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, patient_id: activeSession.patient_id }),
      });
      const data = await res.json();
      const reply = data.success ? data.data.response : 'Sorry, something went wrong. Please try again.';
      setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? { ...m, text: reply, isLoading: false } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? { ...m, text: 'Network error. Please try again.', isLoading: false } : m)));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // ── LOGIN SCREEN (for non-admin users only) ──
  if (!session && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Health Assistant</h1>
              <p className="text-gray-600 text-sm">Login to access your health records</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0700000000"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={loggingIn}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CCC Number</label>
                <input
                  type="text"
                  value={ccc}
                  onChange={(e) => setCcc(e.target.value)}
                  placeholder="00000000000"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={loggingIn}
                />
              </div>

              {loginError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{loginError}</div>}

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {loggingIn ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── CHAT SCREEN ──
  if (!activeSession) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Chat header */}
      <header className="sticky top-0 z-10 bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Health Assistant</h2>
            <p className="text-[11px] text-blue-200">
              {activeSession.first_name} {activeSession.last_name} {!isAdmin && `• ${activeSession.facility_name}`}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" /> Loading conversations…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <Bot className="w-10 h-10 mx-auto mb-3 text-blue-400" />
            <p className="text-sm">Hello {activeSession.first_name}! How can I help you today?</p>
            <p className="text-xs mt-1">Ask me anything about your health.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-700 text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                }`}
              >
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Type a message…"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-full bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}