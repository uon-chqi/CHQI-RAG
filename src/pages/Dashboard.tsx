import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Stats {
  totalPatients: number;
  totalConversations: number;
  highRiskPatients: number;
  upcomingAppointments: number;
  messagesToday: number;
  newPatients30d: number;
  totalFacilities?: number;
  totalCounties?: number;
  totalDocuments?: number;
  totalUsers?: number;
  flaggedPatients?: number;
}

interface County { id: string; name: string; code: string; }
interface Facility { id: string; name: string; code: string; county_name: string; operational_status: string; email?: string; patient_count?: number; high_risk?: number; medium_risk?: number; low_risk?: number; }

export default function Dashboard() {
  const { user, token, isSuperAdmin, isNational, isCounty } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalPatients: 0, totalConversations: 0, highRiskPatients: 0, upcomingAppointments: 0, messagesToday: 0, newPatients30d: 0, totalFacilities: 0, totalCounties: 0, totalDocuments: 0, totalUsers: 0, flaggedPatients: 0 });
  const [counties, setCounties] = useState<County[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  const isAdmin = isSuperAdmin || isNational;

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 30000); return () => clearInterval(iv); }, []);

  const fetchAll = async () => {
    try {
      if (isSuperAdmin || isNational) {
        // Both super admin and national users see all data
        const [d, flaggedRes] = await Promise.all([
          fetch(API_BASE + '/api/admin/overview', { headers: authHeaders() }).then(r => r.json()).catch(() => null),
          fetch(API_BASE + '/api/flagged/stats', { headers: authHeaders() }).then(r => r.json()).catch(() => null),
        ]);
        const flaggedCount = flaggedRes?.success ? (flaggedRes.data?.total ?? 0) : 0;
        if (d?.success) {
          const s = d.data.summary;
          setCounties(d.data.counties || []);
          setFacilities(d.data.facilities || []);
          setStats({ totalFacilities: parseInt(s?.total_facilities ?? 0), totalPatients: parseInt(s?.total_patients ?? 0), totalCounties: parseInt(s?.total_counties ?? 0), totalUsers: parseInt(s?.total_users ?? 0), totalConversations: parseInt(s?.total_conversations ?? 0), totalDocuments: parseInt(s?.total_documents ?? 0), highRiskPatients: parseInt(s?.high_risk_patients ?? 0), upcomingAppointments: parseInt(s?.upcoming_appointments ?? 0), messagesToday: parseInt(s?.messages_today ?? 0), newPatients30d: parseInt(s?.new_patients_30d ?? 0), flaggedPatients: flaggedCount });
        }
      } else if (isCounty) {
        // County manager sees county-scoped data
        const [d, flaggedRes2] = await Promise.all([
          fetch(API_BASE + '/api/county/dashboard', { headers: authHeaders() }).then(r => r.json()).catch(() => null),
          fetch(API_BASE + '/api/flagged/stats', { headers: authHeaders() }).then(r => r.json()).catch(() => null),
        ]);
        const countyFlaggedCount = flaggedRes2?.success ? (flaggedRes2.data?.total ?? 0) : 0;
        if (d?.success) {
          const v = d.data;
          setStats({ totalFacilities: parseInt(v.total_facilities ?? 0), totalPatients: parseInt(v.total_patients ?? 0), totalConversations: parseInt(v.total_conversations ?? 0), highRiskPatients: parseInt(v.high_risk_patients ?? 0), upcomingAppointments: parseInt(v.upcoming_appointments ?? 0), messagesToday: parseInt(v.messages_today ?? 0), newPatients30d: parseInt(v.new_patients_30d ?? 0), flaggedPatients: countyFlaggedCount });
        }
        // Also fetch county's facilities
        const fac = await fetch(API_BASE + '/api/county/facilities', { headers: authHeaders() }).then(r => r.json()).catch(() => null);
        if (fac?.success) setFacilities(fac.data || []);
      }
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  };

  const adminCards = [
    { label: 'Facilities', value: stats.totalFacilities ?? 0 },
    { label: 'Clients', value: stats.totalPatients },
    { label: 'Counties', value: stats.totalCounties ?? 0 },
    { label: 'Conversations', value: stats.totalConversations },
    { label: 'Documents', value: stats.totalDocuments ?? 0 },
    { label: 'Active Users', value: stats.totalUsers ?? 0 },
    { label: 'High Risk', value: stats.highRiskPatients },
    { label: 'Upcoming Appointments', value: stats.upcomingAppointments },
    { label: 'Messages Today', value: stats.messagesToday },
    { label: 'New Clients', value: stats.newPatients30d },
    { label: 'Flagged Clients', value: stats.flaggedPatients ?? 0, },
  ];
  const countyCards = [
    { label: 'Facilities', value: stats.totalFacilities ?? 0 },
    { label: 'Clients', value: stats.totalPatients },
    { label: 'Conversations', value: stats.totalConversations },
    { label: 'High Risk', value: stats.highRiskPatients },
    { label: 'Upcoming Appointments', value: stats.upcomingAppointments },
    { label: 'Messages Today', value: stats.messagesToday },
    { label: 'New (30d)', value: stats.newPatients30d },
    { label: 'Flagged Clients', value: stats.flaggedPatients ?? 0, },
  ];
  const cards = isAdmin ? adminCards : countyCards;

  const statusBadge = (s: string) => {
    const v = (s || '').toLowerCase();
    if (v === 'operational' || v === 'active') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    if (v === 'partial') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    return 'bg-gray-50 text-gray-600 ring-1 ring-gray-500/20';
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const dashTitle = isCounty
    ? (user?.county_name ? `${user.county_name} County` : 'County Dashboard')
    : 'System Overview';

  const dashSub = isCounty
    ? 'County Manager Dashboard'
    : isNational
      ? 'National Overview'
      : 'Super Admin Dashboard';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user?.name || 'Admin'}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-6">
        <div className={'grid gap-3 ' + (isAdmin ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4')}>
          {cards.map(card => (
            <div key={card.label} className={'bg-white rounded-xl shadow-sm border border-gray-200 ' + (card.accent || '') + ' p-4 sm:p-5 flex flex-col items-center text-center transition-transform hover:scale-[1.02] hover:shadow-md'}>
              {loading ? <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mb-1" /> : <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">{(card.value ?? 0).toLocaleString()}</span>}
              <span className="text-[11px] sm:text-xs text-gray-500 font-medium mt-1 leading-tight">{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Admin / National: County Stats Table */}
      {isAdmin && (
        <section className="mt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">County Statistics</h2>
              <Link to="/organisations" className="text-xs font-semibold text-navy-900 hover:underline">View all facilities &rarr;</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">County</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">MFL Code</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Facilities</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Clients</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">High Risk</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Medium Risk</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Low Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
                  ) : counties.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">No counties</td></tr>
                  ) : counties.slice(0, 10).map(c => {
                    const countyFacilities = facilities.filter(f => f.county_name === c.name);
                    const facilityCount = countyFacilities.length;
                    const patientCount = countyFacilities.reduce((sum, f) => sum + (Number(f.patient_count) || 0), 0);
                    const highRisk = countyFacilities.reduce((sum, f) => sum + (Number(f.high_risk) || 0), 0);
                    const mediumRisk = countyFacilities.reduce((sum, f) => sum + (Number(f.medium_risk) || 0), 0);
                    const lowRisk = countyFacilities.reduce((sum, f) => sum + (Number(f.low_risk) || 0), 0);
                    return (
                      <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{c.name}</td>
                        <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{c.code}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-blue-600">{facilityCount}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{patientCount}</td>
                        <td className="px-5 py-3.5 text-right hidden md:table-cell"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{highRisk}</span></td>
                        <td className="px-5 py-3.5 text-right hidden lg:table-cell"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{mediumRisk}</span></td>
                        <td className="px-5 py-3.5 text-right hidden lg:table-cell"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{lowRisk}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* County Manager: facilities in their county + quick actions */}
      {isCounty && (
        <section className="mt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          {/* Facilities in this county */}
          {facilities.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Facilities in {user?.county_name || 'Your County'}</h2>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Facility</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Code</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Patients</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">High Risk</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {facilities.map(f => (
                      <tr key={f.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-gray-900">{f.name}</td>
                        <td className="px-5 py-2.5 text-gray-500 font-mono text-xs">{f.code || '\u2014'}</td>
                        <td className="px-5 py-2.5 text-gray-700 font-semibold">{f.patient_count ?? 0}</td>
                        <td className="px-5 py-2.5"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">{f.high_risk ?? 0}</span></td>
                        <td className="px-5 py-2.5"><span className={'inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ' + statusBadge(f.operational_status)}>{(f.operational_status || 'active').toLowerCase()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/patient-management" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-navy-900">Manage Clients</h3>
              <p className="text-sm text-gray-500 mt-1">View client records across facilities in your county</p>
            </Link>
            <Link to="/conversations" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-navy-900">Conversations</h3>
              <p className="text-sm text-gray-500 mt-1">View SMS and WhatsApp conversations in your county</p>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
