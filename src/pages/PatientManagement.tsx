import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, AlertCircle, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface Patient {
  id: string;
  phone_number: string;
  patient_name: string | null;
  email: string | null;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  facility_id: string;
  created_at: string;
}

interface Facility {
  facility_id: string;
  facility_name: string;
  location: string | null;
  patient_count: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  last_sync_at: string | null;
}

export default function PatientManagement() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiskLevel, setFilterRiskLevel] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    byRiskLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 },
  });

  // Load facilities list on mount
  useEffect(() => {
    api.getFacilities()
      .then((res) => setFacilities(res.data || []))
      .catch(() => setFacilities([]));
  }, []);

  // Load patients + stats when filters change
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [patientsRes, statsRes] = await Promise.all([
        api.getPatients({
          facility_id: selectedFacility || undefined,
          risk_level: filterRiskLevel || undefined,
          search: searchTerm || undefined,
          page,
          limit: 25,
        }),
        api.getPatientStats(selectedFacility || undefined),
      ]);

      setPatients(patientsRes.data || []);
      setTotalPages(patientsRes.pagination?.pages || 1);
      setTotal(patientsRes.pagination?.total || 0);
      setStats(statsRes.data || { total: 0, byRiskLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 } });
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFacility, filterRiskLevel, searchTerm, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedFacility, filterRiskLevel, searchTerm]);

  const riskLevelColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col p-6 gap-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patient Management</h1>
          <p className="text-gray-600 mt-2">
            View and manage patient information and risk levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-500" />
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[200px]"
            aria-label="Select facility"
          >
            <option value="">All Facilities</option>
            {facilities.map((f) => (
              <option key={f.facility_id} value={f.facility_id}>
                {f.facility_name} ({f.patient_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Facilities summary cards (when "All Facilities" is selected) */}
      {!selectedFacility && facilities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {facilities.map((f) => (
            <button
              key={f.facility_id}
              onClick={() => setSelectedFacility(f.facility_id)}
              className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-emerald-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 text-sm">{f.facility_name}</h4>
                <span className="text-xs text-gray-400">
                  {f.patient_count} patients
                </span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  H: {f.high_risk}
                </span>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  M: {f.medium_risk}
                </span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  L: {f.low_risk}
                </span>
              </div>
              {f.last_sync_at && (
                <p className="text-[11px] text-gray-400 mt-2">
                  Last sync: {new Date(f.last_sync_at).toLocaleString()}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Patients"
          value={stats.total}
          icon={<AlertCircle className="w-5 h-5" />}
          color="bg-blue-50"
        />
        <StatCard
          title="High Risk"
          value={stats.byRiskLevel.HIGH}
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          title="Medium Risk"
          value={stats.byRiskLevel.MEDIUM}
          icon={<AlertCircle className="w-5 h-5 text-yellow-600" />}
          color="bg-yellow-50"
        />
        <StatCard
          title="Low Risk"
          value={stats.byRiskLevel.LOW}
          icon={<AlertCircle className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterRiskLevel}
              onChange={(e) => setFilterRiskLevel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              aria-label="Filter by risk level"
            >
              <option value="">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Patient Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phone Number</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Risk Level</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Facility</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    Loading patients...
                  </div>
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No patients found. Data will appear when patients are ingested from your facility system.
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {patient.patient_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{patient.phone_number}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${riskLevelColor(patient.risk_level)}`}>
                      {patient.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{patient.facility_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{patient.email || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      patient.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(patient.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing page {page} of {totalPages} ({total} patients)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How to ingest patient data</p>
          <p>
            Post patient data to the{' '}
            <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">POST /api/facilities/sync</code>{' '}
            endpoint from your facility system with{' '}
            <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">X-Facility-API-Key</code> and{' '}
            <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">X-Facility-ID</code> headers.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg border border-gray-200 p-5`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-gray-400">{icon}</div>
      </div>
    </div>
  );
}
