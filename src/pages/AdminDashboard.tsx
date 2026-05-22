import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const PAGE_SIZE = 10;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
  useEffect(() => { setCurrentPage(1); }, [countyFilter, searchQuery]);

  const filtered = useMemo(() => {
    let result = facilities;
    if (countyFilter) result = result.filter(f => f.county_id === countyFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.code?.toLowerCase().includes(q) ||
        f.county_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [facilities, countyFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(start, start + PAGE_SIZE);

  const summaryCards = summary ? [
    { label: 'Counties', value: summary.total_counties },
    { label: 'Facilities', value: summary.total_facilities },
    { label: 'Clients', value: summary.total_patients },
    { label: 'Users', value: summary.total_users },
  ] : [];

  const statusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'operational' || s === 'active') return 'bg-emerald-50 text-emerald-700';
    if (s === 'partial') return 'bg-amber-50 text-amber-700';
    return 'bg-gray-50 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Facilities</h1>
              <p className="text-sm text-gray-500 mt-1">
                {summary ? `${summary.total_facilities} facilities across ${summary.total_counties} counties` : 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCards.map(card => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
                <span className="block text-2xl font-extrabold text-gray-900">{card.value}</span>
                <span className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex-1 relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, MFL code, or county..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">County:</label>
            <select
              value={countyFilter}
              onChange={e => setCountyFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            >
              <option value="">All</option>
              {counties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filtered.length} facility{filtered.length !== 1 ? 'ies' : ''}
          </span>
        </div>

        {/* Facilities Data Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-8 h-8 border-4 border-navy-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400 mt-3">Loading facilities...</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            {searchQuery || countyFilter ? 'No facilities match your search' : 'No facilities found'}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Facility Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">MFL Code</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">County</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Clients</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map(fac => (
                      <tr key={fac.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{fac.name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{fac.code || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{fac.county_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(fac.operational_status)}`}>
                            {fac.operational_status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fac.patient_count || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            to={`/organisations/${fac.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-navy-900 hover:text-navy-700 transition-colors"
                          >
                            View <ExternalLink size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Simple Previous/Next Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <span className="text-sm text-gray-500 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}