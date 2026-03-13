import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface County { id: string; name: string; code: string; is_active: boolean; }
interface Facility { id: string; name: string; code: string; facility_type: string; operational_status: string; is_active: boolean; county_id: string; county_name: string; county_code: string; patient_count: number; email?: string; }
interface Summary { total_counties: string; total_facilities: string; total_patients: string; total_users: string; }

export default function AdminDashboard() {
  const [counties, setCounties] = useState<County[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countyFilter, setCountyFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/overview`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setCounties(json.data.counties || []);
      setFacilities(json.data.facilities || []);
      setSummary(json.data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = countyFilter ? facilities.filter(f => f.county_id === countyFilter) : facilities;

  const statusColor = (s: string) => {
    const v = (s || '').toLowerCase();
    if (v === 'operational' || v === 'active') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    if (v === 'partial') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    return 'bg-gray-50 text-gray-600 ring-1 ring-gray-500/20';
  };

  const summaryCards = summary ? [
    { label: 'Counties', value: summary.total_counties, accent: 'border-violet-500' },
    { label: 'Facilities', value: summary.total_facilities, accent: 'border-blue-500' },
    { label: 'Patients', value: summary.total_patients, accent: 'border-emerald-500' },
    { label: 'Users', value: summary.total_users, accent: 'border-amber-500' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organisations / Facilities</h1>
              <p className="text-sm text-gray-500 mt-1">
                {summary ? `${summary.total_facilities} facilities across ${summary.total_counties} counties` : 'Loading...'}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 transition-all shadow-md shadow-navy-900/20"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : null}
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(card => (
              <div key={card.label} className={`bg-white rounded-xl shadow-sm border-t-4 ${card.accent} p-5 text-center`}>
                <span className="block text-3xl font-extrabold text-gray-900">{card.value}</span>
                <span className="text-xs text-gray-500 font-medium mt-1">{card.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <label className="text-sm font-medium text-gray-700" htmlFor="county-filter">County:</label>
          <select
            id="county-filter"
            value={countyFilter}
            onChange={e => setCountyFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          >
            <option value="">All Counties</option>
            {counties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-sm text-gray-500 ml-auto">{filtered.length} facilities</span>
        </div>

        {/* Facilities Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">No facilities found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(fac => (
              <div key={fac.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900 text-base group-hover:text-navy-900 transition-colors">{fac.name}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(fac.operational_status)}`}>
                    {(fac.operational_status || 'active').toLowerCase()}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-gray-500">
                  <p>Code: <span className="font-mono text-gray-700">{fac.code || '\u2014'}</span></p>
                  <p>County: <span className="text-navy-700 font-medium">{fac.county_name || '\u2014'}</span></p>
                  {fac.email && <p className="text-gray-400 text-xs truncate">{fac.email}</p>}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">{fac.patient_count || 0} patients</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
