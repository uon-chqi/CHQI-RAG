import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, AlertCircle, Building2, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Patient {
  id: string;
  phone_number?: string;
  phone?: string;
  patient_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: string;
  ccc_number?: string;
  gods_number?: string;
  patient_clinic_number?: string;
  facility_id?: string;
  facility_name?: string;
  next_appointment_date?: string;
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
  const { user, token, isSuperAdmin, isNational, isCounty } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterRiskLevel, setFilterRiskLevel] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, byRiskLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 } });

  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; summary?: any; errors?: any[]; error?: string } | null>(null);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await api.uploadPatientsCSV(file);
      setUploadResult(result);
      // Refresh patient list after successful upload
      if (result.success) loadData();
    } catch (err: any) {
      setUploadResult({ success: false, error: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  // Load facilities list on mount (admin/national only)
  useEffect(() => {
    if (isSuperAdmin || isNational) {
      api.getFacilities().then((res) => setFacilities(res.data || [])).catch(() => setFacilities([]));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isCounty) {
        const params = new URLSearchParams();
        if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
        if (filterRiskLevel) params.set('risk_level', filterRiskLevel);
        params.set('page', String(page));
        params.set('limit', '10');
        const res = await fetch(API_BASE + '/api/county/patients?' + params, { headers: authHeaders() });
        const json = await res.json();
        setPatients(json.data || []);
        setTotalPages(json.pagination?.pages || 1);
        setTotal(json.pagination?.total || 0);
        const list: Patient[] = json.data || [];
        const high = list.filter(p => (p.risk_level || '').toUpperCase() === 'HIGH').length;
        const med = list.filter(p => (p.risk_level || '').toUpperCase() === 'MEDIUM').length;
        const low = list.filter(p => (p.risk_level || '').toUpperCase() === 'LOW').length;
        setStats({ total: json.pagination?.total || list.length, byRiskLevel: { HIGH: high, MEDIUM: med, LOW: low } });
      } else {
        const patientsRes = await api.getPatients({ facility_id: selectedFacility || undefined, risk_level: filterRiskLevel || undefined, search: debouncedSearchTerm || undefined, page, limit: 10 });
        setPatients(patientsRes.data || []);
        setTotalPages(patientsRes.pagination?.pages || patientsRes.totalPages || 1);
        setTotal(patientsRes.pagination?.total || patientsRes.total || 0);
        api.getPatientStats(selectedFacility || undefined)
          .then((statsRes) => setStats(statsRes.data || { total: 0, byRiskLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 } }))
          .catch(() => {});
      }
    } catch { setPatients([]); } finally { setLoading(false); }
  }, [selectedFacility, filterRiskLevel, debouncedSearchTerm, page, isCounty]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [selectedFacility, filterRiskLevel, debouncedSearchTerm]);

  const riskLevelColor = (level: string) => {
    switch ((level || '').toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const displayName = (p: Patient) => {
    if (p.patient_name) return p.patient_name;
    if (p.first_name || p.middle_name || p.last_name) return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
    return 'N/A';
  };

  const displayPhone = (p: Patient) => p.phone_number || p.phone || '';
  const displayFacility = (p: Patient) => p.facility_name || p.facility_id || '\u2014';

  return (
    <div className="flex flex-col p-3 sm:p-4 md:p-6 gap-4 sm:gap-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Client Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
            {isCounty ? 'View client records across facilities in your county' : 'View and manage client information and risk levels'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {(isSuperAdmin || isNational) && (
            <>
              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full sm:min-w-[200px]" aria-label="Select facility">
                <option value="">All Facilities</option>
                {facilities.map((f) => (<option key={f.facility_id} value={f.facility_id}>{f.facility_name} ({f.patient_count})</option>))}
              </select>
            </>
          )}
          {isSuperAdmin && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" aria-label="Upload CSV file" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload result banner */}
      {uploadResult && (
        <div className={`rounded-lg border p-4 text-sm ${uploadResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex justify-between items-start">
            <div>
              {uploadResult.success ? (
                <>
                  <p className="font-semibold">Upload Successful</p>
                  <p>Total rows: {uploadResult.summary?.totalRows} | Created: {uploadResult.summary?.created} | Updated: {uploadResult.summary?.updated} | Skipped: {uploadResult.summary?.skipped}</p>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-yellow-700">View {uploadResult.errors.length} warnings</summary>
                      <ul className="mt-1 list-disc list-inside text-xs">
                        {uploadResult.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.reason}</li>)}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <p className="font-semibold">Upload Failed: {uploadResult.error}</p>
              )}
            </div>
            <button onClick={() => setUploadResult(null)} className="text-gray-500 hover:text-gray-700 ml-4">&times;</button>
          </div>
        </div>
      )}

      {/* Facilities summary cards (admin/national only, when "All Facilities" is selected) */}
      {(isSuperAdmin || isNational) && !selectedFacility && facilities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {facilities.map((f) => (
            <button key={f.facility_id} onClick={() => setSelectedFacility(f.facility_id)} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-emerald-400 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 text-sm">{f.facility_name}</h4>
                <span className="text-xs text-gray-400">{f.patient_count} clients</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">H: {f.high_risk}</span>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">M: {f.medium_risk}</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">L: {f.low_risk}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats.total} icon={<AlertCircle className="w-5 h-5" />} color="bg-blue-50" />
        <StatCard title="High Risk" value={stats.byRiskLevel.HIGH} icon={<AlertCircle className="w-5 h-5 text-red-600" />} color="bg-red-50" />
        <StatCard title="Medium Risk" value={stats.byRiskLevel.MEDIUM} icon={<AlertCircle className="w-5 h-5 text-yellow-600" />} color="bg-yellow-50" />
        <StatCard title="Low Risk" value={stats.byRiskLevel.LOW} icon={<AlertCircle className="w-5 h-5 text-green-600" />} color="bg-green-50" />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input type="text" placeholder="Search by name, phone or CCC number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select value={filterRiskLevel} onChange={(e) => setFilterRiskLevel(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full sm:w-auto" aria-label="Filter by risk level">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Client Name</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Phone</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">CCC Number</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 hidden lg:table-cell">Clinic No.</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Risk Level</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Facility</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 hidden md:table-cell">Next Appt</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 hidden sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-3 sm:px-6 py-12 text-center text-gray-500"><div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />Loading clients...</div></td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan={8} className="px-3 sm:px-6 py-12 text-center text-gray-500 text-sm">No clients found.</td></tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">{displayName(patient)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">{displayPhone(patient)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 font-mono">{patient.ccc_number || '\u2014'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 font-mono hidden lg:table-cell">{patient.patient_clinic_number || patient.gods_number || '\u2014'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + riskLevelColor(patient.risk_level)}>{(patient.risk_level || 'LOW').toUpperCase()}</span></td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">{displayFacility(patient)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden md:table-cell">{patient.next_appointment_date ? new Date(patient.next_appointment_date).toLocaleDateString() : '\u2014'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden sm:table-cell">{new Date(patient.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 gap-2">
              <p className="text-xs sm:text-sm text-gray-600">Page {page} of {totalPages} ({total} clients)</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={color + ' rounded-lg border border-gray-200 p-3 sm:p-5'}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-gray-400">{icon}</div>
      </div>
    </div>
  );
}
