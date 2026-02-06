import { useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { api, Conversation } from '../lib/api';

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');

  useEffect(() => {
    fetchConversations();
  }, [searchPhone, filterChannel]);

  const fetchConversations = async () => {
    try {
      const response = await api.getConversations();
      let filtered = response.data || [];

      if (searchPhone) {
        filtered = filtered.filter((conv: Conversation) =>
          conv.patient_phone.toLowerCase().includes(searchPhone.toLowerCase())
        );
      }

      if (filterChannel !== 'all') {
        filtered = filtered.filter((conv: Conversation) => conv.channel === filterChannel);
      }

      setConversations(filtered.slice(0, 100));
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
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-green-900 mb-1">Conversation History</h2>
        <p className="text-green-600">Search and filter past patient interactions</p>
      </div>

      <div className="bg-white rounded-xl border border-green-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-green-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by phone number..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="relative">
            <Filter className="w-5 h-5 text-green-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="pl-10 pr-8 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 appearance-none bg-white"
            >
              <option value="all">All Channels</option>
              <option value="sms">SMS Only</option>
              <option value="whatsapp">WhatsApp Only</option>
            </select>
          </div>

          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-green-50 border-b border-green-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Channel</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Message</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Response</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">Time (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-100">
              {conversations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-green-600">
                    No conversations found
                  </td>
                </tr>
              ) : (
                conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-green-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-green-700 whitespace-nowrap">
                      {new Date(conv.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-900 font-medium">
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
                    <td className="px-4 py-3 text-sm text-green-800 max-w-xs truncate">
                      {conv.message}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 max-w-xs truncate">
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
                    <td className="px-4 py-3 text-sm text-green-700">
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
