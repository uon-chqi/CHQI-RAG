import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Bot, LogOut } from 'lucide-react';

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

const API_BASE = import.meta.env.VITE_API_BASE || 'https://chqi-rag.onrender.com';

export default function ClientChat() {
  const { clientid } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PatientSession | null>(null);

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

  // Scroll to bottom on new message
  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  // Load session info when clientid changes
  useEffect(() => {
    if (clientid) {
      fetch(`${API_BASE}/api/chatbot/session/${clientid}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setSession(data.data);
            loadHistory();
          } else {
            setSession(null);
          }
        })
        .catch(() => setSession(null));
    }
    // eslint-disable-next-line
  }, [clientid]);

  // ── LOGIN ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !ccc.trim()) return;
    setLoggingIn(true);
    setLoginError('');
    // Normalize CCC number to remove dashes and dots before sending
    const normalizedCCC = ccc.trim().replace(/[-.]/g, '');
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), ccc_number: normalizedCCC }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      navigate(`/client/chat/${data.data.patient_id}`);
    } catch {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setMessages([]);
    navigate('/client/chat');
  };

  // ── LOAD HISTORY ──
  const loadHistory = async () => {
    if (!session) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/history/${session.patient_id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const history: Message[] = [];
        for (const conv of data.data) {
          history.push({
            id: `u-${conv.id}`,
            text: conv.message,
            sender: 'user',
            timestamp: new Date(conv.created_at),
          });
          if (conv.response) {
            history.push({
              id: `b-${conv.id}`,
              text: conv.response,
              sender: 'bot',
              timestamp: new Date(conv.created_at),
            });
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
    if (!input.trim() || sending || !session) return;
    const text = input.trim();
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    const loadingMsg: Message = {
      id: `b-${Date.now()}`,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, patient_id: session.patient_id }),
      });
      const data = await res.json();
      const reply = data.success
        ? data.data.response
        : 'Sorry, something went wrong. Please try again.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id ? { ...m, text: reply, isLoading: false } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: 'Network error. Please try again.', isLoading: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // ── LOGIN SCREEN ──
  if (!clientid || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleLogin}
            className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Log in to chat</h2>
            <p className="text-xs text-gray-500">
              Enter the phone number and CCC number provided by your facility.
            </p>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CCC Number
              </label>
              <input
                type="text"
                value={ccc}
                onChange={(e) => setCcc(e.target.value)}
                placeholder="e.g. 2303309876"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loggingIn ? 'Verifying…' : 'Start Chatting'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── CHAT SCREEN ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Chat header */}
      <header className="sticky top-0 z-10 bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <h2 className="text-sm font-semibold">Health Assistant</h2>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="flex gap-1">
              <span className="block h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="block h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="block h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <p className="text-sm mt-3">Loading conversations…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-sm">Hello! How can I help you today?</p>
            <p className="text-xs mt-1">Ask me anything about your health.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-700 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                }`}
              >
                {msg.isLoading ? (
                  <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full w-fit">
                    <span className="text-sm font-medium">typing</span>
                    <span className="block h-2 w-2 rounded-full bg-green-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="block h-2 w-2 rounded-full bg-green-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="block h-2 w-2 rounded-full bg-green-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'
                      }`}
                    >
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
            onKeyDown={(e) =>
              e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())
            }
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