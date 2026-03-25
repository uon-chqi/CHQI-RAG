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
  risk_level: 'high' | 'medium' | 'low';
  next_appointment_date: string | null;
  patient_created_at: string;
  facility_name: string;
  flagged_words: string[];
}

export default function FlaggedPatients() {
  const { facilityId } = useParams<{ facilityId?: string }>();
  const { token } = useAuth();
  const [records, setRecords] = useState<FlaggedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

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
      console.error('Error loading flagged clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.first_name?.toLowerCase().includes(q) ||
      r.last_name?.toLowerCase().includes(q) ||
      r.phone?.includes(q) ||
      r.ccc_number?.toLowerCase().includes(q);
    const matchRisk = !riskFilter || r.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  const riskColor = (level: string) => {
    if (level === 'high') return 'bg-red-100 text-red-700 ring-1 ring-red-600/20';
    if (level === 'medium') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20';
    return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to={facilityId ? `/organisations/${facilityId}` : '/'} className="text-sm text-navy-900 hover:underline mb-2 inline-block">
            &#8592; Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Flagged Clients</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <div className="flex gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <input
            type="text"
            placeholder="Search by name, phone, or CCC number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
          >
            <option value="">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          <span className="text-sm text-gray-500 flex items-center">{filtered.length} clients</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Client Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">CCC Number</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Risk Level</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Flagged Words</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Next Appt</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading clients…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No flagged clients found</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{r.first_name} {r.last_name}</td>
                      <td className="px-5 py-3.5 text-gray-700 font-mono text-xs">{r.phone}</td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{r.ccc_number}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${riskColor(r.risk_level)}`}>
                          {r.risk_level}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(r.flagged_words || []).map((w, i) => (
                            <span key={i} className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-medium">{w}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {r.next_appointment_date ? new Date(r.next_appointment_date).toLocaleDateString() : '\u2014'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {r.patient_created_at ? new Date(r.patient_created_at).toLocaleDateString() : '\u2014'}
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
