import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { smsServices } from '../../lib/api';
import type { Workflow } from '../../types/sms';

function normalizeWorkflowsPayload(payload: unknown): Workflow[] {
  const source = payload as Workflow[] | { data?: Workflow[] };
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}

export default function WorkflowsList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS Workflows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage automation graphs for SMS journeys.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Link to="/admin/workflows/builder">
            <Button className="flex items-center gap-2">
              <Plus size={16} /> New Workflow
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16 text-gray-400">
            <Loader2 className="animate-spin w-7 h-7" />
          </div>
        ) : error ? (
          <div className="py-14 text-center text-red-500 text-sm">{error}</div>
        ) : workflows.length === 0 ? (
          <div className="py-14 text-center text-gray-500 text-sm">No workflows found. Create your first one.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Trigger</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Steps</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900 text-sm">{workflow.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{workflow.triggerEvent}</td>
                  <td className="px-5 py-3.5">
                    {workflow.facilityId === null ? (
                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold">Universal</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold">Facility</Badge>
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
    </div>
  );
}
