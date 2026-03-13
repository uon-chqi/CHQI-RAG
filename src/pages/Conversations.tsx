import { useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, Conversation } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function Conversations() {
  const { token, isSuperAdmin } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchParams] = useSearchParams();

  // Get phone from URL on component mount
  useEffect(() => {
    const urlPhone = searchParams.get('phone');
    if (urlPhone) {
      setSearchPhone(urlPhone);
    } else {
      setSearchPhone('');
    }
  }, [searchParams.get('phone')]);

  // Fetch conversations when searchPhone or filterChannel changes
  useEffect(() => {
    fetchConversations();
  }, [searchPhone, filterChannel]);

  const authHeaders = () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  const fetchConversations = async () => {
    try {
      let data: Conversation[];
      if (isSuperAdmin) {
        const response = await api.getConversations();
        data = response.data || [];
      } else {
        const params = new URLSearchParams();
        if (searchPhone) params.set('phone', searchPhone);
        if (filterChannel !== 'all') params.set('channel', filterChannel);
        const res = await fetch(`${API_BASE}/api/facility/conversations?${params}`, { headers: authHeaders() });
        const json = await res.json();
        data = json.data || [];
      }

      if (isSuperAdmin) {
        if (searchPhone) {
          data = data.filter((conv: Conversation) =>
            conv.patient_phone.toLowerCase().includes(searchPhone.toLowerCase())
          );
        }
        if (filterChannel !== 'all') {
          data = data.filter((conv: Conversation) => conv.channel === filterChannel);
        }
      }

      setConversations(data.slice(0, 100));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 8) return phone;
    return phone.slice(0, 4) + '*'.repeat(phone.length - 8) + phone.slice(-4);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Phone', 'Channel', 'Message', 'Response', 'Status', 'Response Time'];
    const rows = conversations.map((conv) => [
      new Date(conv.created_at).toISOString(),
      conv.patient_phone,
      conv.channel,
      `"${conv.message.replace(/"/g, '""')}"`,
      `"${(conv.response || '').replace(/"/g, '""')}"`,
      conv.status,
      conv.response_time_ms || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversations-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-navy-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Conversation History</h2>
        <p className="text-gray-500">Search and filter past patient interactions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by phone number..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
          </div>

          <div className="relative">
            <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/30 appearance-none bg-white"
            >
              <option value="all">All Channels</option>
              <option value="sms">SMS Only</option>
              <option value="whatsapp">WhatsApp Only</option>
            </select>
          </div>

          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Channel</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Message</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Response</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Time (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No conversations found
                  </td>
                </tr>
              ) : (
                conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {new Date(conv.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {maskPhone(conv.patient_phone)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          conv.channel === 'sms'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {conv.channel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
                      {conv.message}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {conv.response || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          conv.status === 'sent'
                            ? 'bg-green-100 text-green-700'
                            : conv.status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {conv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {conv.response_time_ms || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
