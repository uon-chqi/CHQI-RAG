import { useEffect, useState } from 'react';
import { Search, Filter, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, Conversation } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
const PAGE_SIZE = 10;

export default function Conversations() {
  const { token, isSuperAdmin, isNational, isCounty } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchParams] = useSearchParams();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const urlPhone = searchParams.get('phone');
    if (urlPhone) setSearchPhone(urlPhone);
    else setSearchPhone('');
  }, [searchParams.get('phone')]);

  useEffect(() => {
    setCurrentPage(1);
    fetchConversations(1);
  }, [searchPhone, filterChannel]);

  const authHeaders = () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  const fetchConversations = async (page: number) => {
    setLoading(true);
    try {
      let data: Conversation[] = [];
      if (isSuperAdmin || isNational) {
        const response = await api.getConversations();
        data = response.data || [];
      } else if (isCounty) {
        const params = new URLSearchParams();
        if (searchPhone) params.set('phone', searchPhone);
        if (filterChannel !== 'all') params.set('channel', filterChannel);
        const res = await fetch(`${API_BASE}/api/county/conversations?${params}`, { headers: authHeaders() });
        const json = await res.json();
        data = json.data || [];
      }

      if (isSuperAdmin || isNational) {
        if (searchPhone) data = data.filter((conv: Conversation) => conv.patient_phone.toLowerCase().includes(searchPhone.toLowerCase()));
        if (filterChannel !== 'all') data = data.filter((conv: Conversation) => conv.channel === filterChannel);
      }

      // Sort newest first
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setTotalCount(data.length);
      
      // Paginate
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      setConversations(data.slice(start, end));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchConversations(page);
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
    a.download = `outbox-${new Date().toISOString()}.csv`;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Outbox</h2>
          <p className="text-gray-500">
            {totalCount > 0 
              ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalCount)} of ${totalCount} conversations`
              : 'Search and filter past client interactions'}
          </p>
        </div>
        <button
          onClick={() => window.open('/client/chat', '_blank')}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors"
          title="Open Chat in new tab"
        >
          <MessageCircle size={13} />
          Chat
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search by phone number..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/30" />
          </div>
          <div className="relative">
            <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/30 appearance-none bg-white">
              <option value="all">All Channels</option>
              <option value="sms">SMS Only</option>
              <option value="whatsapp">WhatsApp Only</option>
            </select>
          </div>
          <button onClick={exportToCSV} className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium">Export CSV</button>
        </div>
      </div>

      {/* Conversations Table */}
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No conversations found</td></tr>
              ) : (
                conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{new Date(conv.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{maskPhone(conv.patient_phone)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 text-xs font-medium rounded-full ${conv.channel === 'sms' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{conv.channel.toUpperCase()}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{conv.message}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{conv.response || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 text-xs font-medium rounded-full ${conv.status === 'sent' ? 'bg-green-100 text-green-700' : conv.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{conv.status}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-700">{conv.response_time_ms || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                    page === currentPage
                      ? 'bg-navy-900 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}