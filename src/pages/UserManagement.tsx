import { useState, useEffect } from 'react';
import { Search, Users, ShieldCheck, Building2, MapPin, RefreshCw } from 'lucide-react';
import { Input } from '../components/ui/input';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  facility_name: string | null;
  facility_code: string | null;
  county_name: string | null;
  roles: string[];
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  national_admin: 'bg-purple-100 text-purple-700',
  county_admin: 'bg-blue-100 text-blue-700',
  facility_admin: 'bg-green-100 text-green-700',
  clinician: 'bg-teal-100 text-teal-700',
  data_entry: 'bg-gray-100 text-gray-700',
  viewer: 'bg-yellow-100 text-yellow-700',
  api_service: 'bg-orange-100 text-orange-700',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  national_admin: 'National Admin',
  county_admin: 'County Admin',
  facility_admin: 'Facility Admin',
  clinician: 'Clinician',
  data_entry: 'Data Entry',
  viewer: 'Viewer',
  api_service: 'API Service',
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users-list`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setUsers(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const allRoles = Array.from(
    new Set(users.flatMap((u) => u.roles))
  ).sort();

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.facility_name?.toLowerCase().includes(q) ||
      u.county_name?.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.roles.includes(roleFilter);
    return matchSearch && matchRole;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">All system users and their assigned roles</p>
        </div>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={users.length} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Active" value={users.filter((u) => u.is_active).length} color="text-green-600" bg="bg-green-50" />
        <StatCard label="Inactive" value={users.filter((u) => !u.is_active).length} color="text-red-600" bg="bg-red-50" />
        <StatCard label="Roles in Use" value={allRoles.length} color="text-purple-600" bg="bg-purple-50" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, facility…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          {allRoles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Roles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                <span className="flex items-center gap-1"><Building2 size={13} /> Facility</span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                <span className="flex items-center gap-1"><MapPin size={13} /> County</span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">Loading users…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">
                  {users.length === 0
                    ? 'No users found. Run the seed script to add initial accounts.'
                    : 'No users match your search.'}
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-sm">
                      {(u.name || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{u.name || '—'}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 ? (
                      <span className="text-gray-400 text-xs">No role</span>
                    ) : (
                      u.roles.map((r) => (
                        <span
                          key={r}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {ROLE_LABELS[r] || r}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-700">
                  {u.facility_name ? (
                    <span>
                      {u.facility_name}
                      {u.facility_code && <span className="text-gray-400 ml-1">({u.facility_code})</span>}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-4 text-gray-700">
                  {u.county_name || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-4 text-xs text-gray-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-400">
        Showing {filtered.length} of {users.length} users
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`${bg} rounded-lg p-2`}>
        <Users size={18} className={color} />
      </div>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
