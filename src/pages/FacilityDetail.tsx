import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  ccc_number: string;
  risk_level: 'high' | 'medium' | 'low';
  next_appointment_date: string | null;
  created_at: string;
  facility_name: string;
}

interface Facility {
  id: string;
  name: string;
  code: string;
  county_name: string;
  email: string;
  operational_status: string;
}

export default function FacilityDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch facility info
      const facilityRes = await fetch(`${API_BASE}/api/admin/overview`, { headers: authHeaders() });
      const facilityData = await facilityRes.json();
      if (facilityData.success) {
        const fac = facilityData.data.facilities.find((f: any) => f.id === id);
        if (fac) setFacility(fac);
      }

      // Fetch clients for this facility
      const clientsRes = await fetch(`${API_BASE}/api/patients?facility_id=${id}`, { headers: authHeaders() });
      const clientsData = await clientsRes.json();
      if (clientsData.success) {
        setClients(clientsData.data || []);
      }
    } catch (err) {
      console.error('Error loading facility data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.ccc_number?.toLowerCase().includes(q);
    const matchRisk = !riskFilter || c.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  const riskColor = (level: string) => {
    if (level === 'high') return 'bg-red-100 text-red-700 ring-1 ring-red-600/20';
    if (level === 'medium') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20';
    return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20';
  };

  const highRisk = clients.filter((c) => c.risk_level === 'high').length;
  const mediumRisk = clients.filter((c) => c.risk_level === 'medium').length;
  const lowRisk = clients.filter((c) => c.risk_level === 'low').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/organisations" className="text-sm text-navy-900 hover:underline mb-2 inline-block">
            ← Back to Facilities
          </Link>
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-gray-900">{facility?.name || 'Facility'}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              {facility?.code && <span>Code: <span className="font-mono text-gray-900">{facility.code}</span></span>}
              {facility?.county_name && <span>County: <span className="font-semibold text-navy-700">{facility.county_name}</span></span>}
              {facility?.email && <span className="text-gray-400">{facility.email}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-gray-900">{clients.length}</span>
            <p className="text-xs text-gray-500 mt-1">Total Clients</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-red-600">{highRisk}</span>
            <p className="text-xs text-gray-500 mt-1">High Risk</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-amber-600">{mediumRisk}</span>
            <p className="text-xs text-gray-500 mt-1">Medium Risk</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-emerald-600">{lowRisk}</span>
            <p className="text-xs text-gray-500 mt-1">Low Risk</p>
          </div>
        </div>

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

        {/* Clients Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Client Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">CCC Number</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Risk Level</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Next Appt</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading clients…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No clients found</td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{c.first_name} {c.last_name}</td>
                      <td className="px-5 py-3.5 text-gray-700 font-mono text-xs">{c.phone}</td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{c.ccc_number}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${riskColor(c.risk_level)}`}>
                          {c.risk_level}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {c.next_appointment_date ? new Date(c.next_appointment_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {new Date(c.created_at).toLocaleDateString()}
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
