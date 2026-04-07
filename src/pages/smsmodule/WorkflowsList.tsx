import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Pause, Play, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { smsServices } from '../../lib/api';
import { WorkflowTriggerEvent, type Workflow } from '../../types/sms';

function normalizeWorkflowsPayload(payload: unknown): Workflow[] {
  const source = payload as Workflow[] | { data?: Workflow[] };
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}

function humanizeTrigger(event: string): string {
  return event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

const SCOPE_OPTIONS = [
  { value: 'ALL', label: 'All scopes' },
  { value: 'UNIVERSAL', label: 'Universal' },
  { value: 'FACILITY', label: 'Facility' },
] as const;

type ScopeFilter = (typeof SCOPE_OPTIONS)[number]['value'];

const RISK_OPTIONS = [
  { value: 'ALL', label: 'All risk levels' },
  { value: 'HIGH', label: 'High risk', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'MEDIUM', label: 'Medium risk', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'LOW', label: 'Low risk', badge: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'NONE', label: 'No targeting', badge: 'bg-gray-100 text-gray-600 border-gray-200' },
] as const;

type RiskFilter = (typeof RISK_OPTIONS)[number]['value'];

function riskBadgeClass(level: string | null | undefined): string {
  switch ((level ?? '').toUpperCase()) {
    case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export default function WorkflowsList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');

  const activeFilterCount = [
    search.trim() !== '',
    statusFilter !== 'ALL',
    triggerFilter !== '',
    scopeFilter !== 'ALL',
    riskFilter !== 'ALL',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTriggerFilter('');
    setScopeFilter('ALL');
    setRiskFilter('ALL');
  };

  const filteredWorkflows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows.filter((wf) => {
      if (q && !wf.name.toLowerCase().includes(q)) return false;
      if (statusFilter === 'ACTIVE' && !wf.isActive) return false;
      if (statusFilter === 'PAUSED' && wf.isActive) return false;
      if (triggerFilter && wf.triggerEvent !== triggerFilter) return false;
      if (scopeFilter === 'UNIVERSAL' && wf.facilityId !== null) return false;
      if (scopeFilter === 'FACILITY' && wf.facilityId === null) return false;
      if (riskFilter === 'HIGH' && (wf.riskLevel ?? '').toUpperCase() !== 'HIGH') return false;
      if (riskFilter === 'MEDIUM' && (wf.riskLevel ?? '').toUpperCase() !== 'MEDIUM') return false;
      if (riskFilter === 'LOW' && (wf.riskLevel ?? '').toUpperCase() !== 'LOW') return false;
      if (riskFilter === 'NONE' && wf.riskLevel != null && wf.riskLevel !== '') return false;
      return true;
    });
  }, [workflows, search, statusFilter, triggerFilter, scopeFilter, riskFilter]);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await smsServices.getWorkflows();
      setWorkflows(normalizeWorkflowsPayload(res));
    } catch {
      setWorkflows([]);
      setError('Failed to load workflows. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await smsServices.deleteWorkflow(id);
      await fetchWorkflows();
    } catch {
      toast.error('Failed to delete workflow. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    setTogglingId(workflow.id);
    try {
      await smsServices.updateWorkflow(workflow.id, { isActive: !workflow.isActive });
      setWorkflows((prev) =>
        prev.map((item) =>
          item.id === workflow.id ? { ...item, isActive: !workflow.isActive } : item
        )
      );
      toast.success(`Workflow ${workflow.isActive ? 'paused' : 'activated'}.`);
    } catch {
      toast.error('Failed to update workflow status.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS Workflows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage automation graphs for SMS journeys.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoading} aria-label="Refresh">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Link to="/admin/workflows/builder">
            <Button className="flex items-center gap-2">
              <Plus size={16} /> New Workflow
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows…"
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-gray-200 hidden sm:block" />

        {/* Status pill toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden h-8">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 h-full text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200 hidden sm:block" />

        {/* Trigger event dropdown */}
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value)}
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All triggers</option>
          {Object.values(WorkflowTriggerEvent).map((ev) => (
            <option key={ev} value={ev}>{humanizeTrigger(ev)}</option>
          ))}
        </select>

        {/* Scope dropdown */}
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SCOPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Risk level dropdown */}
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {RISK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            <X size={13} />
            Clear filters
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16 text-gray-400">
            <Loader2 className="animate-spin w-7 h-7" />
          </div>
        ) : error ? (
          <div className="py-14 text-center text-red-500 text-sm">{error}</div>
        ) : workflows.length === 0 ? (
          <div className="py-14 text-center text-gray-500 text-sm">No workflows found. Create your first one.</div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <p className="text-gray-500 text-sm">No workflows match your filters.</p>
            <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Trigger</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Risk Level</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Steps</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredWorkflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900 text-sm">{workflow.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{humanizeTrigger(workflow.triggerEvent)}</td>
                  <td className="px-5 py-3.5">
                    {workflow.facilityId === null ? (
                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold">Universal</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold">Facility</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {workflow.riskLevel ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${riskBadgeClass(workflow.riskLevel)}`}>
                        {workflow.riskLevel.charAt(0) + workflow.riskLevel.slice(1).toLowerCase()} Risk
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(workflow)}
                      disabled={togglingId === workflow.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        workflow.isActive
                          ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {workflow.isActive ? <Play size={12} /> : <Pause size={12} />}
                      {workflow.isActive ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{workflow.steps?.length ?? 0}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <Link to={`/admin/workflows/builder/${workflow.id}`}>
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          Open <ArrowRight size={13} />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:border-red-300"
                        disabled={deletingId === workflow.id}
                        onClick={() => handleDelete(workflow.id, workflow.name)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Result count */}
      {!isLoading && !error && workflows.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          Showing {filteredWorkflows.length} of {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
