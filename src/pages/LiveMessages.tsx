import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, Conversation } from '../lib/api';
import { MessageCard } from '../components/MessageCard';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function LiveMessages() {
  const { token, isSuperAdmin } = useAuth();
  const [messages, setMessages] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sms' | 'whatsapp'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'error' | 'pending'>('all');

  const authHeaders = () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      if (isSuperAdmin) {
        const response = await api.getConversations();
        setMessages(response.data?.slice(0, 50) || []);
      } else {
        const res = await fetch(`${API_BASE}/api/facility/messages`, { headers: authHeaders() });
        const json = await res.json();
        setMessages(json.data?.slice(0, 50) || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = messages.filter((m) => {
    if (filter !== 'all' && m.channel !== filter) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3">
        <span className="text-sm font-medium text-gray-600 mr-2">Channel:</span>
        {(['all', 'sms', 'whatsapp'] as const).map((ch) => (
          <Badge
            key={ch}
            variant={filter === ch ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter(ch)}
          >
            {ch === 'all' ? 'All' : ch === 'sms' ? 'SMS' : 'WhatsApp'}
          </Badge>
        ))}

        <span className="text-sm font-medium text-gray-600 ml-4 mr-2">Status:</span>
        {(['all', 'sent', 'error', 'pending'] as const).map((st) => (
          <Badge
            key={st}
            variant={statusFilter === st ? 'default' : 'outline'}
            className="cursor-pointer capitalize"
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </Badge>
        ))}
      </div>

      {/* Live Indicator */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-soft"></span>
        <span className="text-sm text-gray-600">
          {filtered.length} messages • Auto-refreshing
        </span>
      </div>

      {/* Messages */}
      <motion.div layout className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {messages.length === 0
                ? 'No messages yet. Waiting for patient interactions...'
                : 'No messages match the current filters.'}
            </p>
          </div>
        ) : (
          filtered.map((msg, i) => <MessageCard key={msg.id} message={msg} index={i} />)
        )}
      </motion.div>
    </div>
  );
}
