import { useState, useEffect } from 'react';
import { Search, Users, Building2, MapPin, RefreshCw, Plus, X, Trash2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  facility_name: string | null;
  facility_code: string | null;
  county_name: string | null;
}

interface County {
  id: string;
  name: string;
  code: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  national: 'bg-purple-100 text-purple-700',
  county: 'bg-blue-100 text-blue-700',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  national: 'National User',
  county: 'County Manager',
};

export default function UserManagement() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [counties, setCounties] = useState<County[]>([]);
  const [formData, setFormData] = useState({ email: '', password: '', role: 'national', county_id: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const authHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  });

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users-list`, { headers: authHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setUsers(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCounties = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/counties-list`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setCounties(json.data);
    } catch (_) {}
  };

  useEffect(() => { loadUsers(); loadCounties(); }, []);

  const allRoles = Array.from(
    new Set(users.map((u) => u.role).filter(Boolean))
  ).sort();

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.facility_name?.toLowerCase().includes(q) ||
      u.county_name?.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowForm(false);
      setFormData({ email: '', password: '', role: 'national', county_id: '' });
      loadUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">All system users and their assigned roles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-navy-900 text-white rounded-lg hover:bg-navy-800"
          >
            <Plus size={14} />
            Create User
          </button>
          <button
            onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Create New User</h2>
            <button onClick={() => { setShowForm(false); setFormError(''); }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="user@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, county_id: '' })}
              >
                <option value="national">National User</option>
                <option value="county">County Manager</option>
              </select>
            </div>
            {formData.role === 'county' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  value={formData.county_id}
                  onChange={(e) => setFormData({ ...formData, county_id: e.target.value })}
                  required
                >
                  <option value="">Select a county…</option>
                  {counties.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            )}
            {formError && (
              <div className="md:col-span-2 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">{formError}</div>
            )}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setFormError(''); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-navy-900 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                <span className="flex items-center gap-1"><Building2 size={13} /> Facility</span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                <span className="flex items-center gap-1"><MapPin size={13} /> County</span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">Loading users…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  {users.length === 0
                    ? 'No users found. Click Create User to add one.'
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
                    {u.role ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No role</span>
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
                <td className="px-4 py-4 text-right">
                  {u.role !== 'super_admin' && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      className="text-gray-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50"
                      title="Delete user"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
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
