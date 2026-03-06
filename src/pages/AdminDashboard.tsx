import { useState, useEffect } from 'react';
import { Building2, MapPin, Users, Activity, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

interface County {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

interface Facility {
  id: string;
  name: string;
  code: string;
  facility_type: string;
  operational_status: string;
  is_active: boolean;
  county_id: string;
  county_name: string;
  county_code: string;
  patient_count: number;
  staff_count: number;
}

interface Summary {
  total_counties: string;
  total_facilities: string;
  total_patients: string;
  total_users: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminDashboard() {
  const [counties, setCounties] = useState<County[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCounties, setExpandedCounties] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/overview`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setCounties(json.data.counties);
      setFacilities(json.data.facilities);
      setSummary(json.data.summary);
      // Expand all counties by default
      const expanded: Record<string, boolean> = {};
      json.data.counties.forEach((c: County) => { expanded[c.id] = true; });
      setExpandedCounties(expanded);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const facilitiesForCounty = (countyId: string) =>
    facilities.filter((f) => f.county_id === countyId);

  const toggleCounty = (id: string) =>
    setExpandedCounties((prev) => ({ ...prev, [id]: !prev[id] }));

  const statusColor = (status: string) => {
    if (status === 'operational' || status === 'active') return 'text-green-600 bg-green-50';
    if (status === 'partial') return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Hierarchy</h1>
          <p className="text-sm text-gray-500 mt-1">National → County → Facility overview</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard icon={<MapPin size={20} className="text-blue-600" />} label="Counties" value={summary.total_counties} bg="bg-blue-50" />
          <SummaryCard icon={<Building2 size={20} className="text-green-600" />} label="Facilities" value={summary.total_facilities} bg="bg-green-50" />
          <SummaryCard icon={<Users size={20} className="text-purple-600" />} label="Patients" value={summary.total_patients} bg="bg-purple-50" />
          <SummaryCard icon={<Activity size={20} className="text-orange-600" />} label="Active Users" value={summary.total_users} bg="bg-orange-50" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && !summary && (
        <div className="text-center text-gray-400 py-20">Loading hierarchy…</div>
      )}

      {/* Hierarchy Tree */}
      {!loading && counties.length === 0 && (
        <div className="text-center text-gray-400 py-20">
          No counties found. Run the seed script to add initial data.
        </div>
      )}

      <div className="space-y-4">
        {/* National Level Banner */}
        {counties.length > 0 && (
          <div className="bg-gradient-to-r from-green-700 to-green-800 text-white rounded-xl px-6 py-4 flex items-center gap-3 shadow">
            <div className="bg-white/20 rounded-lg p-2">
              <Activity size={20} />
            </div>
            <div>
              <div className="font-bold text-lg">National Level — CHQI</div>
              <div className="text-green-200 text-sm">
                {summary?.total_counties} counties · {summary?.total_facilities} facilities
              </div>
            </div>
          </div>
        )}

        {/* Counties */}
        {counties.map((county) => {
          const countyFacilities = facilitiesForCounty(county.id);
          const expanded = expandedCounties[county.id];
          return (
            <div key={county.id} className="ml-6 border-l-2 border-green-200 pl-4">
              {/* County Row */}
              <button
                onClick={() => toggleCounty(county.id)}
                className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3 hover:bg-gray-50 transition text-left"
              >
                <span className="text-gray-400">
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <div className="bg-blue-100 rounded-lg p-2">
                  <MapPin size={16} className="text-blue-700" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{county.name} County</div>
                  <div className="text-xs text-gray-400">Code: {county.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700">{countyFacilities.length} facilities</div>
                  <div className="text-xs text-gray-400">
                    {countyFacilities.reduce((s, f) => s + Number(f.patient_count), 0)} patients
                  </div>
                </div>
                <span className={`ml-3 text-xs font-medium px-2 py-0.5 rounded-full ${county.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {county.is_active ? 'Active' : 'Inactive'}
                </span>
              </button>

              {/* Facilities under county */}
              {expanded && (
                <div className="ml-6 border-l-2 border-blue-100 pl-4 mt-2 space-y-2 mb-3">
                  {countyFacilities.length === 0 && (
                    <div className="text-sm text-gray-400 py-2 pl-2">No facilities in this county.</div>
                  )}
                  {countyFacilities.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-4 py-3 hover:shadow-sm transition"
                    >
                      <div className="bg-green-100 rounded-lg p-2">
                        <Building2 size={14} className="text-green-700" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 text-sm">{f.name}</div>
                        <div className="text-xs text-gray-400">Code: {f.code} · {f.facility_type || 'hospital'}</div>
                      </div>
                      <div className="text-right text-xs text-gray-500 mr-4">
                        <div>{f.patient_count} patients</div>
                        <div>{f.staff_count} staff</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor(f.operational_status || 'operational')}`}>
                        {f.operational_status || 'operational'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`${bg} rounded-lg p-2`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
