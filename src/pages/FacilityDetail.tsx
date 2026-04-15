import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  patient_name?: string;
  phone: string;
  gender: string | null;
  date_of_birth: string | null;
  ccc_number: string;
  risk_level: string;
  next_appointment_date: string | null;
  appointment_status: string | null;
  last_visit_date: string | null;
  last_viral_load: string | null;
  county: string | null;
  sub_county: string | null;
  ward: string | null;
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

const PAGE_SIZE = 20;

export default function FacilityDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, isSuperAdmin } = useAuth();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [flaggedCount, setFlaggedCount] = useState(0);

  // Pagination state (server-side)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);

  // CSV upload state
  const uploadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; summary?: any; errors?: any[]; error?: string } | null>(null);

  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Stats
  const [highRisk, setHighRisk] = useState(0);
  const [mediumRisk, setMediumRisk] = useState(0);
  const [lowRisk, setLowRisk] = useState(0);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  });

  const loadClients = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (id) params.set('facility_id', id);
      if (search) params.set('search', search);
      if (riskFilter) params.set('risk_level', riskFilter);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`${API_BASE}/api/patients?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setClients(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotalClients(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }, [id, search, riskFilter, page]);

  const loadFacility = async () => {
    try {
      const facilityRes = await fetch(`${API_BASE}/api/admin/overview`, { headers: authHeaders() });
      const facilityData = await facilityRes.json();
      if (facilityData.success) {
        const fac = facilityData.data.facilities.find((f: any) => f.id === id);
        if (fac) setFacility(fac);
      }
    } catch (err) {
      console.error('Error loading facility:', err);
    }
  };

  const loadStats = async () => {
    try {
      const statsRes = await fetch(`${API_BASE}/api/patients/stats?facility_id=${id}`, { headers: authHeaders() });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setHighRisk(statsData.data?.byRiskLevel?.HIGH || 0);
        setMediumRisk(statsData.data?.byRiskLevel?.MEDIUM || 0);
        setLowRisk(statsData.data?.byRiskLevel?.LOW || 0);
      }

      const flaggedRes = await fetch(`${API_BASE}/api/flagged/stats?facility_id=${id}`, { headers: authHeaders() }).then(r => r.json()).catch(() => null);
      if (flaggedRes?.success) setFlaggedCount(flaggedRes.data?.total ?? 0);
    } catch {}
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFacility(), loadStats()]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { setPage(1); }, [search, riskFilter]);

  // Scroll to upload area when toggled
  const handleAddClients = () => {
    setShowUpload(true);
    setUploadResult(null);
    setSelectedFile(null);
    setTimeout(() => uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await api.uploadPatientsCSV(selectedFile);
      setUploadResult(result);
      if (result.success) {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Reload data
        loadClients();
        loadStats();
      }
    } catch (err: any) {
      setUploadResult({ success: false, error: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const riskColor = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l === 'high') return 'bg-red-100 text-red-700 ring-1 ring-red-600/20';
    if (l === 'medium') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20';
    if (l === 'low') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20';
    return 'bg-gray-100 text-gray-600 ring-1 ring-gray-300';
  };

  const displayName = (c: Client) => {
    if (c.patient_name && c.patient_name.trim()) return c.patient_name;
    return ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || '—';
  };

  // Clear selection when page / filters change
  useEffect(() => { setSelectedIds(new Set()); }, [page, search, riskFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.size} client(s)? This action cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.deletePatients(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadClients();
      loadStats();
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Link to="/organisations" className="text-sm text-navy-900 hover:underline mb-2 inline-block">
            ← Back to Facilities
          </Link>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{facility?.name || 'Facility'}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                {facility?.code && <span>Code: <span className="font-mono text-gray-900">{facility.code}</span></span>}
                {facility?.county_name && <span>County: <span className="font-semibold text-navy-700">{facility.county_name}</span></span>}
                {facility?.email && <span className="text-gray-400">{facility.email}</span>}
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={handleAddClients}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Clients
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <span className="text-3xl font-extrabold text-gray-900">{totalClients}</span>
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
          <Link to={`/flagged-patients/${id}`} className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-md transition-all">
            <span className="text-3xl font-extrabold text-red-600">{flaggedCount}</span>
            <p className="text-xs text-gray-500 mt-1">Flagged Clients</p>
          </Link>
        </div>

        {/* CSV Upload Area */}
        {showUpload && isSuperAdmin && (
          <div ref={uploadRef} className="bg-white rounded-xl border-2 border-dashed border-emerald-300 p-3 sm:p-6 space-y-4 transition-all">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upload Client Data (CSV)</h3>
              <button onClick={() => { setShowUpload(false); setUploadResult(null); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <p className="text-sm text-gray-500">
              Upload a CSV file with client data. Columns should include: patient_id, patient_name, gender, dob, ccc_number, phone_number, risk_classification, appointment_date, facility_mfl, etc.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Select CSV file"
              />
              <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {selectedFile ? (
                <p className="text-sm font-medium text-emerald-700">{selectedFile.name} <span className="text-gray-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span></p>
              ) : (
                <p className="text-sm text-gray-500">Click to select a CSV file, or drag and drop</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!selectedFile || uploading}
                className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Uploading...' : 'Save'}
              </button>
              {selectedFile && !uploading && (
                <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-sm text-gray-500 hover:text-gray-700">
                  Clear
                </button>
              )}
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`rounded-lg border p-4 text-sm ${uploadResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {uploadResult.success ? (
                  <>
                    <p className="font-semibold">Upload Successful!</p>
                    <p className="mt-1">Total rows: {uploadResult.summary?.totalRows} · Created: {uploadResult.summary?.created} · Updated: {uploadResult.summary?.updated} · Skipped: {uploadResult.summary?.skipped}</p>
                    {(uploadResult.summary?.updated ?? 0) > 0 && (
                      <p className="mt-1 text-green-700 text-xs">
                        ℹ️ {uploadResult.summary.updated} existing client(s) were matched by CCC number and updated with the latest data — no duplicates were created.
                      </p>
                    )}
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-yellow-700 font-medium">{uploadResult.errors.length} warnings</summary>
                        <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
                          {uploadResult.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.reason}</li>)}
                        </ul>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="font-semibold">Upload Failed: {uploadResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-xl border border-gray-200 px-3 sm:px-4 py-3">
          <input
            type="text"
            placeholder="Search by name, phone, or CCC number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
          <div className="flex gap-2 items-center">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
              aria-label="Filter by risk level"
            >
              <option value="">All Risk Levels</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
            <span className="text-sm text-gray-500 whitespace-nowrap">{totalClients} clients</span>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Bulk-delete bar */}
          {isSuperAdmin && selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 border-b border-red-200">
              <span className="text-sm font-medium text-red-700">
                {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {deleting ? 'Deleting…' : 'Delete Selected'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {isSuperAdmin && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={clients.length > 0 && selectedIds.size === clients.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900/20 cursor-pointer"
                        aria-label="Select all clients on this page"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Client Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Gender</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">DOB</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">CCC Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Risk Level</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Viral Load</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Appt Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Next Appt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Last Visit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Sub County</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Ward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 13 : 12} className="px-5 py-8 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Loading clients…
                      </div>
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 13 : 12} className="px-5 py-8 text-center text-gray-400">No clients found</td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(c.id) ? 'bg-blue-50/60' : ''}`}>
                      {isSuperAdmin && (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            className="w-4 h-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900/20 cursor-pointer"
                            aria-label={`Select ${displayName(c)}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{displayName(c)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.gender || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{c.date_of_birth ? new Date(c.date_of_birth).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">{c.ccc_number || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${riskColor(c.risk_level)}`}>
                          {c.risk_level || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.last_viral_load || '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.appointment_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {c.appointment_status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {c.next_appointment_date ? new Date(c.next_appointment_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {c.last_visit_date ? new Date(c.last_visit_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{c.sub_county || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{c.ward || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-5 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs sm:text-sm text-gray-600">
                Page {page} of {totalPages} ({totalClients} clients)
              </p>
              <div className="flex items-center gap-1 flex-wrap justify-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${p === page ? 'bg-gray-900 text-white' : 'border border-gray-300 hover:bg-gray-100'}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
