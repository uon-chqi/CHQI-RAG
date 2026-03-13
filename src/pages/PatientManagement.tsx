import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, AlertCircle, Building2, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
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
  last_name?: string;
  email?: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: string;
  ccc_number?: string;
  facility_id?: string;
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

const emptyForm = { first_name: '', last_name: '', phone: '', email: '', ccc_number: '', date_of_birth: '', gender: 'Male', risk_level: 'LOW', next_appointment_date: '', physical_address: '' };

export default function PatientManagement() {
  const { user, token, isSuperAdmin, isFacility } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiskLevel, setFilterRiskLevel] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, byRiskLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 } });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  // Load facilities list on mount (admin only)
  useEffect(() => {
    if (isSuperAdmin) {
      api.getFacilities().then((res) => setFacilities(res.data || [])).catch(() => setFacilities([]));
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isFacility) {
        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (filterRiskLevel) params.set('risk_level', filterRiskLevel);
        params.set('page', String(page));
        params.set('limit', '25');
        const res = await fetch(API_BASE + '/api/facility/patients?' + params, { headers: authHeaders() });
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
        const [patientsRes, statsRes] = await Promise.all([
          api.getPatients({ facility_id: selectedFacility || undefined, risk_level: filterRiskLevel || undefined, search: searchTerm || undefined, page, limit: 25 }),
          api.getPatientStats(selectedFacility || undefined),
        ]);
        setPatients(patientsRes.data || []);
        setTotalPages(patientsRes.pagination?.pages || 1);
        setTotal(patientsRes.pagination?.total || 0);
        setStats(statsRes.data || { total: 0, byRiskLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 } });
      }
    } catch { setPatients([]); } finally { setLoading(false); }
  }, [selectedFacility, filterRiskLevel, searchTerm, page, isFacility]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [selectedFacility, filterRiskLevel, searchTerm]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      setFormError('First name, last name and phone are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(API_BASE + '/api/facility/patients', { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add patient');
      setForm(emptyForm);
      setShowForm(false);
      loadData();
    } catch (err: any) { setFormError(err.message); } finally { setSaving(false); }
  };

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
    if (p.first_name || p.last_name) return ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
    return 'N/A';
  };

  const displayPhone = (p: Patient) => p.phone_number || p.phone || '';

  return (
    <div className="flex flex-col p-3 sm:p-4 md:p-6 gap-4 sm:gap-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Patient Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
            {isFacility ? 'Manage your facility\u2019s patient records' : 'View and manage patient information and risk levels'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isFacility && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium text-sm">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Add Patient'}
            </button>
          )}
          {isSuperAdmin && (
            <>
              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full sm:min-w-[200px]" aria-label="Select facility">
                <option value="">All Facilities</option>
                {facilities.map((f) => (<option key={f.facility_id} value={f.facility_id}>{f.facility_name} ({f.patient_count})</option>))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Add Patient Form (facility only) */}
      {showForm && isFacility && (
        <form onSubmit={handleAddPatient} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Add New Patient</h3>
          {formError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label><input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label><input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+254..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">CCC Number</label><input value={form.ccc_number} onChange={e => setForm({...form, ccc_number: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Gender</label><select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/30"><option>Male</option><option>Female</option><option>Other</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label><select value={form.risk_level} onChange={e => setForm({...form, risk_level: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/30"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Next Appointment</label><input type="date" value={form.next_appointment_date} onChange={e => setForm({...form, next_appointment_date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="block text-sm font-medium text-gray-700 mb-1">Physical Address</label><input value={form.physical_address} onChange={e => setForm({...form, physical_address: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/30" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(''); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save Patient'}</button>
          </div>
        </form>
      )}

      {/* Facilities summary cards (admin only, when "All Facilities" is selected) */}
      {isSuperAdmin && !selectedFacility && facilities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {facilities.map((f) => (
            <button key={f.facility_id} onClick={() => setSelectedFacility(f.facility_id)} className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-emerald-400 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 text-sm">{f.facility_name}</h4>
                <span className="text-xs text-gray-400">{f.patient_count} patients</span>
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
        <StatCard title="Total Patients" value={stats.total} icon={<AlertCircle className="w-5 h-5" />} color="bg-blue-50" />
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
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Patient Name</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Phone</th>
                {isFacility && <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">CCC Number</th>}
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Risk Level</th>
                {isSuperAdmin && <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Facility</th>}
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 hidden md:table-cell">Next Appt</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 hidden sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-3 sm:px-6 py-12 text-center text-gray-500"><div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />Loading patients...</div></td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan={7} className="px-3 sm:px-6 py-12 text-center text-gray-500 text-sm">{isFacility ? 'No patients yet. Click "Add Patient" to add your first patient.' : 'No patients found.'}</td></tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">{displayName(patient)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">{displayPhone(patient)}</td>
                    {isFacility && <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 font-mono">{patient.ccc_number || '\u2014'}</td>}
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + riskLevelColor(patient.risk_level)}>{(patient.risk_level || 'LOW').toUpperCase()}</span></td>
                    {isSuperAdmin && <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">{patient.facility_id}</td>}
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden md:table-cell">{patient.next_appointment_date ? new Date(patient.next_appointment_date).toLocaleDateString() : '\u2014'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden sm:table-cell">{new Date(patient.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 gap-2">
              <p className="text-xs sm:text-sm text-gray-600">Page {page} of {totalPages} ({total} patients)</p>
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
