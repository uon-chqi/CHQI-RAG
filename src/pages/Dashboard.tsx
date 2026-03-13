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
}

interface County { id: string; name: string; code: string; }
interface Facility { id: string; name: string; code: string; county_name: string; operational_status: string; email?: string; }

export default function Dashboard() {
  const { user, token, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalPatients: 0, totalConversations: 0, highRiskPatients: 0, upcomingAppointments: 0, messagesToday: 0, newPatients30d: 0, totalFacilities: 0, totalCounties: 0, totalDocuments: 0, totalUsers: 0 });
  const [counties, setCounties] = useState<County[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 30000); return () => clearInterval(iv); }, []);

  const fetchAll = async () => {
    try {
      if (isSuperAdmin) {
        const d = await fetch(API_BASE + '/api/admin/overview', { headers: authHeaders() }).then(r => r.json()).catch(() => null);
        if (d?.success) {
          const s = d.data.summary;
          setCounties(d.data.counties || []);
          setFacilities(d.data.facilities || []);
          setStats({ totalFacilities: parseInt(s?.total_facilities ?? 0), totalPatients: parseInt(s?.total_patients ?? 0), totalCounties: parseInt(s?.total_counties ?? 0), totalUsers: parseInt(s?.total_users ?? 0), totalConversations: parseInt(s?.total_conversations ?? 0), totalDocuments: parseInt(s?.total_documents ?? 0), highRiskPatients: parseInt(s?.high_risk_patients ?? 0), upcomingAppointments: parseInt(s?.upcoming_appointments ?? 0), messagesToday: parseInt(s?.messages_today ?? 0), newPatients30d: parseInt(s?.new_patients_30d ?? 0) });
        }
      } else {
        const d = await fetch(API_BASE + '/api/facility/dashboard', { headers: authHeaders() }).then(r => r.json()).catch(() => null);
        if (d?.success) {
          const v = d.data;
          setStats({ totalPatients: parseInt(v.total_patients ?? 0), totalConversations: parseInt(v.total_conversations ?? 0), highRiskPatients: parseInt(v.high_risk_patients ?? 0), upcomingAppointments: parseInt(v.upcoming_appointments ?? 0), messagesToday: parseInt(v.messages_today ?? 0), newPatients30d: parseInt(v.new_patients_30d ?? 0) });
        }
      }
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  };

  const adminCards = [
    { label: 'Facilities', value: stats.totalFacilities ?? 0, accent: 'border-blue-500' },
    { label: 'Patients', value: stats.totalPatients, accent: 'border-emerald-500' },
    { label: 'Counties', value: stats.totalCounties ?? 0, accent: 'border-violet-500' },
    { label: 'Conversations', value: stats.totalConversations, accent: 'border-amber-500' },
    { label: 'Documents', value: stats.totalDocuments ?? 0, accent: 'border-cyan-500' },
    { label: 'Active Users', value: stats.totalUsers ?? 0, accent: 'border-indigo-500' },
    { label: 'High Risk', value: stats.highRiskPatients, accent: 'border-red-500' },
    { label: 'Upcoming Appts', value: stats.upcomingAppointments, accent: 'border-teal-500' },
    { label: 'Messages Today', value: stats.messagesToday, accent: 'border-orange-500' },
    { label: 'New (30d)', value: stats.newPatients30d, accent: 'border-pink-500' },
  ];
  const facilityCards = [
    { label: 'My Patients', value: stats.totalPatients, accent: 'border-emerald-500' },
    { label: 'Conversations', value: stats.totalConversations, accent: 'border-amber-500' },
    { label: 'High Risk', value: stats.highRiskPatients, accent: 'border-red-500' },
    { label: 'Upcoming Appts', value: stats.upcomingAppointments, accent: 'border-teal-500' },
    { label: 'Messages Today', value: stats.messagesToday, accent: 'border-orange-500' },
    { label: 'New (30d)', value: stats.newPatients30d, accent: 'border-pink-500' },
  ];
  const cards = isSuperAdmin ? adminCards : facilityCards;

  const statusBadge = (s: string) => {
    const v = (s || '').toLowerCase();
    if (v === 'operational' || v === 'active') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    if (v === 'partial') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    return 'bg-gray-50 text-gray-600 ring-1 ring-gray-500/20';
  };

  const heroTitle = isSuperAdmin ? 'Centre for Healthcare Quality and Innovation' : (user?.facility_name || 'My Facility');
  const heroSub = isSuperAdmin ? '' : ((user?.county_name || '') + ' County \u2014 Facility Dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative overflow-hidden" style={{ minHeight: isSuperAdmin ? '380px' : '260px' }}>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://images.pexels.com/photos/7722868/pexels-photo-7722868.jpeg')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(10,27,58,0.25) 0%, rgba(10,27,58,0.65) 100%)' }} />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-20 sm:py-28">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight max-w-4xl" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{heroTitle}</h1>
          {heroSub && <p className="mt-3 text-blue-100/90 text-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{heroSub}</p>}
        </div>
      </section>

      <section className="relative z-20 -mt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className={'grid gap-3 ' + (isSuperAdmin ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3')}>
          {cards.map(card => (
            <div key={card.label} className={'bg-white rounded-xl shadow-lg border-t-4 ' + card.accent + ' p-4 sm:p-5 flex flex-col items-center text-center transition-transform hover:scale-[1.02] hover:shadow-xl'}>
              {loading ? <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mb-1" /> : <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">{(card.value ?? 0).toLocaleString()}</span>}
              <span className="text-[11px] sm:text-xs text-gray-500 font-medium mt-1 leading-tight">{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      {isSuperAdmin && (
        <section className="mt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">County Overview</h2>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">County</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Code</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? <tr><td colSpan={2} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr> : counties.length === 0 ? <tr><td colSpan={2} className="px-5 py-8 text-center text-gray-400 text-sm">No counties</td></tr> : counties.map(c => (
                      <tr key={c.id} className="hover:bg-blue-50/40 transition-colors"><td className="px-5 py-2.5 font-medium text-gray-900">{c.name}</td><td className="px-5 py-2.5 text-gray-500 font-mono text-xs">{c.code}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Registered Facilities</h2>
                <Link to="/organisations" className="text-xs font-semibold text-navy-900 hover:underline">View all &rarr;</Link>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Facility</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Code</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">County</th><th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr> : facilities.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No facilities</td></tr> : facilities.slice(0, 12).map(f => (
                      <tr key={f.id} className="hover:bg-blue-50/40 transition-colors"><td className="px-5 py-2.5 font-medium text-gray-900">{f.name}</td><td className="px-5 py-2.5 text-gray-500 font-mono text-xs hidden sm:table-cell">{f.code || '\u2014'}</td><td className="px-5 py-2.5 text-navy-700 font-medium">{f.county_name || '\u2014'}</td><td className="px-5 py-2.5"><span className={'inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ' + statusBadge(f.operational_status)}>{(f.operational_status || 'active').toLowerCase()}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {!isSuperAdmin && (
        <section className="mt-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/patient-management" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-navy-900">Manage Patients</h3>
              <p className="text-sm text-gray-500 mt-1">View, add and update patient records for your facility</p>
            </Link>
            <Link to="/conversations" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-navy-900">Conversations</h3>
              <p className="text-sm text-gray-500 mt-1">View SMS and WhatsApp conversations with your patients</p>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
