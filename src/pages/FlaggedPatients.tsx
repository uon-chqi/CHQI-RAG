import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface FlaggedRecord {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  ccc_number: string;
  risk_level: string;
  facility_name: string;
  facility_code: string;
  county_name: string;
  flagged_message: string;
  flagged_words: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'reviewed' | 'resolved';
  notes: string | null;
  created_at: string;
}

export default function FlaggedPatients() {
  const { facilityId } = useParams<{ facilityId?: string }>();
  const { token } = useAuth();
  const [records, setRecords] = useState<FlaggedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  });

  useEffect(() => { loadData(); }, [facilityId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (facilityId) params.set('facility_id', facilityId);
      const res = await fetch(`${API_BASE}/api/flagged?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setRecords(data.data || []);
    } catch (err) {
      console.error('Error loading flagged patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API_BASE}/api/flagged/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  const filtered = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (severityFilter && r.severity !== severityFilter) return false;
    return true;
  });

  const severityBadge = (s: string) => {
    if (s === 'critical') return 'bg-red-600 text-white';
    if (s === 'high') return 'bg-red-100 text-red-700';
    if (s === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  const statusBadge = (s: string) => {
    if (s === 'pending') return 'bg-yellow-100 text-yellow-700';
    if (s === 'reviewed') return 'bg-blue-100 text-blue-700';
    return 'bg-green-100 text-green-700';
  };

  const pending = records.filter((r) => r.status === 'pending').length;
  const critical = records.filter((r) => r.severity === 'critical').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to={facilityId ? `/organisations/${facilityId}` : '/'} className="text-sm text-navy-900 hover:underline mb-2 inline-block">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Flagged Patients</h1>
          <p className="text-sm text-gray-500 mt-0.5">Patients whose messages contain concerning mental health indicators</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-gray-900">{records.length}</span>
            <p className="text-xs text-gray-500 mt-1">Total Flagged</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-yellow-600">{pending}</span>
            <p className="text-xs text-gray-500 mt-1">Pending Review</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-red-600">{critical}</span>
            <p className="text-xs text-gray-500 mt-1">Critical Severity</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-green-600">{records.filter((r) => r.status === 'resolved').length}</span>
            <p className="text-xs text-gray-500 mt-1">Resolved</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50">
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
          <span className="text-sm text-gray-500 flex items-center ml-auto">{filtered.length} records</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Patient</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Facility</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Flagged Message</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Keywords</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Severity</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">No flagged patients found</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900">{r.first_name} {r.last_name}</span>
                        <span className="block text-[11px] text-gray-400">{r.ccc_number}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 font-mono text-xs">{r.phone}</td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">{r.facility_name}</td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[200px] truncate" title={r.flagged_message}>
                        {r.flagged_message}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {r.flagged_words.map((w, i) => (
                            <span key={i} className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-medium">{w}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${severityBadge(r.severity)}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5">
                        {r.status === 'pending' && (
                          <button onClick={() => updateStatus(r.id, 'reviewed')} className="text-xs text-blue-600 hover:underline mr-2">Mark Reviewed</button>
                        )}
                        {r.status !== 'resolved' && (
                          <button onClick={() => updateStatus(r.id, 'resolved')} className="text-xs text-green-600 hover:underline">Resolve</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
