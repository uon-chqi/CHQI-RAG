import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { smsServices } from '../../lib/api';
import type { Workflow } from '../../types/sms';

type SimulationResult = {
  cccNumber: string;
  status: 'success' | 'failed';
  message: string;
};

function normalizeWorkflowsPayload(payload: unknown): Workflow[] {
  const source = payload as Workflow[] | { data?: Workflow[] };
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}

export default function WorkflowSimulation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [cccInput, setCccInput] = useState('');
  const [cccNumbers, setCccNumbers] = useState<string[]>([]);
  const [cccError, setCccError] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState<SimulationResult[]>([]);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) || null,
    [workflows, selectedWorkflowId]
  );

  const successCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;

  const fetchWorkflows = async () => {
    setIsLoadingWorkflows(true);
    setWorkflowError(null);
    try {
      const res = await smsServices.getWorkflows();
      setWorkflows(normalizeWorkflowsPayload(res));
    } catch {
      setWorkflows([]);
      setWorkflowError('Failed to load workflows. Please refresh and try again.');
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const addCccNumber = () => {
    const normalized = cccInput.trim();
    if (!normalized) {
      setCccError('Enter a CCC number before adding.');
      return;
    }

    const duplicate = cccNumbers.some((value) => value.toLowerCase() === normalized.toLowerCase());
    if (duplicate) {
      setCccError('That CCC number is already in the list.');
      return;
    }

    setCccNumbers((prev) => [...prev, normalized]);
    setCccInput('');
    setCccError(null);
  };

  const removeCccNumber = (cccNumber: string) => {
    setCccNumbers((prev) => prev.filter((value) => value !== cccNumber));
  };

  const clearCccNumbers = () => {
    setCccNumbers([]);
    setCccError(null);
  };

  const runSimulation = async () => {
    if (!selectedWorkflowId) {
      toast.error('Select a workflow before running simulation.');
      return;
    }
    if (cccNumbers.length === 0) {
      toast.error('Add at least one CCC number before running simulation.');
      return;
    }

    setIsRunning(true);
    setProcessedCount(0);
    setResults([]);
    toast.message('Simulation started. Triggering workflow sequentially.');

    let localSuccessCount = 0;
    let localFailedCount = 0;

    for (let i = 0; i < cccNumbers.length; i += 1) {
      const cccNumber = cccNumbers[i];
      try {
        const res = await smsServices.triggerWorkflow(selectedWorkflowId, { cccNumber });
        localSuccessCount += 1;
        setResults((prev) => [
          ...prev,
          {
            cccNumber,
            status: 'success',
            message: res?.message || 'Workflow triggered successfully.',
          },
        ]);
      } catch (error: unknown) {
        localFailedCount += 1;
        const messageRaw = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
        const message = Array.isArray(messageRaw)
          ? messageRaw.join(', ')
          : messageRaw || 'Failed to trigger workflow for this CCC number.';

        setResults((prev) => [
          ...prev,
          {
            cccNumber,
            status: 'failed',
            message,
          },
        ]);
      } finally {
        setProcessedCount(i + 1);
      }
    }

    setIsRunning(false);
    toast.success(`Simulation complete. ${localSuccessCount} succeeded, ${localFailedCount} failed.`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Simulation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Select a workflow and trigger it for multiple CCC numbers.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoadingWorkflows}>
          <RefreshCw size={15} className={isLoadingWorkflows ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Workflow</label>
          <select
            className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            disabled={isLoadingWorkflows || isRunning}
          >
            <option value="">-- Select workflow --</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name} {workflow.isActive ? '(Active)' : '(Paused)'}
              </option>
            ))}
          </select>
          {workflowError && <p className="text-xs text-red-600 mt-1">{workflowError}</p>}
          {selectedWorkflow && (
            <p className="text-xs text-gray-500 mt-1">
              Trigger: {selectedWorkflow.triggerEvent} | Steps: {selectedWorkflow.steps?.length ?? 0}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CCC Numbers</label>
          <div className="flex gap-2">
            <Input
              value={cccInput}
              onChange={(e) => {
                setCccInput(e.target.value);
                if (cccError) setCccError(null);
              }}
              placeholder="Type CCC number and click Add"
              disabled={isRunning}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCccNumber();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addCccNumber} disabled={isRunning}>
              Add
            </Button>
            <Button type="button" variant="outline" onClick={clearCccNumbers} disabled={isRunning || cccNumbers.length === 0}>
              Clear
            </Button>
          </div>
          {cccError && <p className="text-xs text-red-600 mt-1">{cccError}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {cccNumbers.length === 0 && <p className="text-xs text-gray-500">No CCC numbers added yet.</p>}
            {cccNumbers.map((cccNumber) => (
              <Badge key={cccNumber} className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 gap-1">
                <span>{cccNumber}</span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900"
                  onClick={() => removeCccNumber(cccNumber)}
                  disabled={isRunning}
                  title="Remove CCC"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-gray-500">
            {isRunning ? `Running ${processedCount}/${cccNumbers.length}` : `Ready: ${cccNumbers.length} CCC number(s)`}
          </div>
          <Button
            className="flex items-center gap-2"
            onClick={runSimulation}
            disabled={isRunning || !selectedWorkflowId || cccNumbers.length === 0}
          >
            {isRunning ? <><Loader2 size={16} className="animate-spin" /> Running...</> : <><Play size={16} /> Run Simulation</>}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Simulation Results</h2>
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-gray-100 text-gray-700 border-gray-300">Total: {results.length}</Badge>
            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">Success: {successCount}</Badge>
            <Badge className="bg-red-100 text-red-900 border-red-300">Failed: {failedCount}</Badge>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="py-14 text-center text-gray-500 text-sm">No simulation results yet.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">CCC Number</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((result) => (
                <tr key={`${result.cccNumber}-${result.status}-${result.message}`}>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{result.cccNumber}</td>
                  <td className="px-5 py-3 text-sm">
                    {result.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 size={14} /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <XCircle size={14} /> Failed
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{result.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
