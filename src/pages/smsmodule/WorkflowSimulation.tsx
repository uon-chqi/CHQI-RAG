import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Play, RefreshCw, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { smsServices } from '../../lib/api';
import { StepActionType, type SmsTemplate, type Workflow, type WorkflowStep } from '../../types/sms';

type SimulationResult = {
  cccNumber: string;
  status: 'success' | 'failed';
  message: string;
};

type SimulationMode = 'ONE_WAY' | 'TWO_WAY';

type TranscriptEntry = {
  id: string;
  speaker: 'system' | 'patient' | 'meta';
  text: string;
  timestamp: string;
};

type TimelineEntry = {
  id: string;
  stepId: string;
  label: string;
  actionType: StepActionType;
  event: 'entered' | 'branch';
  detail?: string;
  timestamp: string;
};

type ResolvedWorkflowStep = WorkflowStep & {
  id: string;
};

function normalizeWorkflowsPayload(payload: unknown): Workflow[] {
  const source = payload as Workflow[] | { data?: Workflow[] };
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}

export default function WorkflowSimulation() {
  const [mode, setMode] = useState<SimulationMode>('ONE_WAY');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [cccInput, setCccInput] = useState('');
  const [cccNumbers, setCccNumbers] = useState<string[]>([]);
  const [cccError, setCccError] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState<SimulationResult[]>([]);

  const [twoWayCccNumber, setTwoWayCccNumber] = useState('');
  const [twoWayReplyInput, setTwoWayReplyInput] = useState('');
  const [isTwoWayStarted, setIsTwoWayStarted] = useState(false);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [currentWaitStepId, setCurrentWaitStepId] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) || null,
    [workflows, selectedWorkflowId]
  );

  const templateBodyByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const template of templates) {
      const name = typeof template.name === 'string' ? template.name.trim() : '';
      const body = typeof template.body === 'string' ? template.body.trim() : '';
      if (!name || !body) continue;
      map.set(name.toLowerCase(), body);
    }
    return map;
  }, [templates]);

  const resolvedSteps = useMemo<ResolvedWorkflowStep[]>(() => {
    if (!selectedWorkflow?.steps) return [];
    return selectedWorkflow.steps.map((step, index) => ({
      ...step,
      id: step.id || `step-${index + 1}`,
    }));
  }, [selectedWorkflow]);

  const stepById = useMemo(() => {
    const map = new Map<string, ResolvedWorkflowStep>();
    for (const step of resolvedSteps) {
      map.set(step.id, step);
    }
    return map;
  }, [resolvedSteps]);

  const firstStepId = useMemo(() => {
    const first = resolvedSteps.find((step) => Boolean(step.isFirstStep));
    return first?.id || null;
  }, [resolvedSteps]);

  const successCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;

  const appendTranscript = (entry: Omit<TranscriptEntry, 'id' | 'timestamp'>) => {
    setTranscript((prev) => [
      ...prev,
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const appendTimeline = (entry: Omit<TimelineEntry, 'id' | 'timestamp'>) => {
    setTimeline((prev) => [
      ...prev,
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const getStepLabel = (step: WorkflowStep): string => {
    const config = (step.config || {}) as Record<string, unknown>;
    const nodeLabel = config.nodeLabel;
    if (typeof nodeLabel === 'string' && nodeLabel.trim()) return nodeLabel.trim();

    const templateName = config.templateName;
    if (typeof templateName === 'string' && templateName.trim()) return templateName.trim();

    if (step.actionType === StepActionType.SEND_SMS) return 'Send SMS';
    if (step.actionType === StepActionType.WAIT_FOR_REPLY) return 'Wait for Reply';
    return 'System Action';
  };

  const getWaitBranches = (step: WorkflowStep): Record<string, string | null> => {
    const config = (step.config || {}) as Record<string, unknown>;
    const branches = config.branches;
    if (!branches || typeof branches !== 'object' || Array.isArray(branches)) {
      return {};
    }
    return branches as Record<string, string | null>;
  };

  const readNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  };

  const resolveSmsText = (step: WorkflowStep): string => {
    const config = (step.config || {}) as Record<string, unknown>;

    const directText =
      readNonEmptyString(config.templateBody) ||
      readNonEmptyString(config.body) ||
      readNonEmptyString(config.message) ||
      readNonEmptyString(config.text);
    if (directText) return directText;

    const templateName = readNonEmptyString(config.templateName);
    if (templateName) {
      const templateBody = templateBodyByName.get(templateName.toLowerCase());
      if (templateBody) return templateBody;
    }

    return getStepLabel(step);
  };

  const normalizeReply = (value: string): string => value.trim().toUpperCase();

  const resolveBranchTarget = (
    branches: Record<string, string | null>,
    reply: string
  ): { matchedKey: string; targetId: string } | null => {
    const normalizedReply = normalizeReply(reply);

    for (const [branchKey, targetId] of Object.entries(branches)) {
      if (!targetId) continue;
      const normalizedKey = normalizeReply(branchKey);
      if (normalizedKey === normalizedReply) {
        return { matchedKey: branchKey, targetId };
      }

      const parts = normalizedKey.split(':');
      if (parts.length > 1) {
        const lastPart = normalizeReply(parts.slice(1).join(':'));
        if (lastPart === normalizedReply) {
          return { matchedKey: branchKey, targetId };
        }
      }
    }

    const anyKey = Object.keys(branches).find((key) => normalizeReply(key) === 'ANY');
    if (anyKey && branches[anyKey]) {
      return { matchedKey: anyKey, targetId: branches[anyKey] as string };
    }

    return null;
  };

  const resetTwoWay = () => {
    setIsTwoWayStarted(false);
    setIsProcessingTurn(false);
    setTranscript([]);
    setTimeline([]);
    setCurrentWaitStepId(null);
    setQuickReplies([]);
    setTwoWayReplyInput('');
  };

  const advanceFromStep = (startStepId: string) => {
    let nextId: string | null = startStepId;
    let guard = 0;

    while (nextId && guard < 200) {
      guard += 1;
      const step = stepById.get(nextId);
      if (!step) {
        appendTranscript({ speaker: 'meta', text: `Simulation stopped. Step ${nextId} is missing.` });
        setCurrentWaitStepId(null);
        setQuickReplies([]);
        return;
      }

      appendTimeline({
        stepId: step.id,
        label: getStepLabel(step),
        actionType: step.actionType,
        event: 'entered',
      });

      if (step.actionType === StepActionType.SEND_SMS) {
        appendTranscript({ speaker: 'system', text: resolveSmsText(step) });
        nextId = step.nextStepId || null;
        continue;
      }

      if (step.actionType === StepActionType.SYSTEM_ACTION) {
        nextId = step.nextStepId || null;
        continue;
      }

      if (step.actionType === StepActionType.WAIT_FOR_REPLY) {
        const branches = getWaitBranches(step);
        const options = Object.keys(branches);
        setCurrentWaitStepId(step.id);
        setQuickReplies(options);
        return;
      }

      nextId = null;
    }

    if (guard >= 200) {
      appendTranscript({ speaker: 'meta', text: 'Simulation paused due to long loop path (safety guard reached).' });
    } else {
      appendTranscript({ speaker: 'meta', text: 'Simulation reached an end step.' });
    }
    setCurrentWaitStepId(null);
    setQuickReplies([]);
  };

  const startTwoWaySimulation = () => {
    if (!selectedWorkflowId) {
      toast.error('Select a workflow before starting two-way simulation.');
      return;
    }
    const ccc = twoWayCccNumber.trim();
    if (!ccc) {
      toast.error('Enter patient CCC number for two-way simulation.');
      return;
    }
    if (!firstStepId) {
      toast.error('This workflow has no valid first step to simulate.');
      return;
    }

    resetTwoWay();
    setIsTwoWayStarted(true);
    appendTranscript({ speaker: 'meta', text: `Two-way simulation started for CCC ${ccc}.` });
    advanceFromStep(firstStepId);
  };

  const sendTwoWayReply = (replyText?: string) => {
    const reply = (replyText ?? twoWayReplyInput).trim();
    if (!reply) return;
    if (!currentWaitStepId) {
      toast.error('No wait step is currently expecting a reply.');
      return;
    }

    const step = stepById.get(currentWaitStepId);
    if (!step) {
      toast.error('Current wait step was not found.');
      return;
    }

    const branches = getWaitBranches(step);
    const match = resolveBranchTarget(branches, reply);

    appendTranscript({ speaker: 'patient', text: reply });
    setTwoWayReplyInput('');

    if (!match) {
      return;
    }

    appendTimeline({
      stepId: step.id,
      label: getStepLabel(step),
      actionType: StepActionType.WAIT_FOR_REPLY,
      event: 'branch',
      detail: `Matched: ${match.matchedKey}`,
    });

    setCurrentWaitStepId(null);
    setQuickReplies([]);
    setIsProcessingTurn(true);
    advanceFromStep(match.targetId);
    setIsProcessingTurn(false);
  };

  const fetchWorkflows = async () => {
    setIsLoadingWorkflows(true);
    setWorkflowError(null);
    try {
      const [workflowRes, templateRes] = await Promise.all([
        smsServices.getWorkflows(),
        smsServices.getTemplates().catch(() => [] as SmsTemplate[]),
      ]);
      setWorkflows(normalizeWorkflowsPayload(workflowRes));
      setTemplates(Array.isArray(templateRes) ? templateRes : []);
    } catch {
      setWorkflows([]);
      setTemplates([]);
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
          <p className="text-sm text-gray-500 mt-0.5">Run one-way trigger tests or interactive two-way conversation simulations.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as SimulationMode)}
            disabled={isRunning || isProcessingTurn}
          >
            <option value="ONE_WAY">One-way Simulation</option>
            <option value="TWO_WAY">Two-way Simulation</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoadingWorkflows}>
            <RefreshCw size={15} className={isLoadingWorkflows ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {mode === 'ONE_WAY' ? (
        <>
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
        </>
      ) : (
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow</label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={selectedWorkflowId}
                  onChange={(e) => {
                    setSelectedWorkflowId(e.target.value);
                    resetTwoWay();
                  }}
                  disabled={isLoadingWorkflows || isProcessingTurn}
                >
                  <option value="">-- Select workflow --</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name} {workflow.isActive ? '(Active)' : '(Paused)'}
                    </option>
                  ))}
                </select>
                {workflowError && <p className="text-xs text-red-600 mt-1">{workflowError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient CCC Number</label>
                <Input
                  value={twoWayCccNumber}
                  onChange={(e) => setTwoWayCccNumber(e.target.value)}
                  placeholder="E.g. 35891885"
                  disabled={isTwoWayStarted || isProcessingTurn}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 border-t pt-4">
              <Button
                className="flex items-center gap-2"
                onClick={startTwoWaySimulation}
                disabled={isProcessingTurn || !selectedWorkflowId || !twoWayCccNumber.trim()}
              >
                <Play size={16} /> Start Two-way Simulation
              </Button>
              <Button
                variant="outline"
                onClick={resetTwoWay}
                disabled={isProcessingTurn || (!isTwoWayStarted && transcript.length === 0)}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
                  <MessageCircle size={15} /> Conversation Transcript
                </h2>
              </div>

              <div className="p-4 h-[380px] overflow-y-auto space-y-3 bg-gray-50/40">
                {transcript.length === 0 ? (
                  <p className="text-sm text-gray-500">Start a two-way simulation to see conversation flow.</p>
                ) : (
                  transcript.map((entry) => (
                    <div
                      key={entry.id}
                      className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
                        entry.speaker === 'patient'
                          ? 'ml-auto bg-blue-600 text-white'
                          : entry.speaker === 'system'
                            ? 'bg-white border border-gray-200 text-gray-800'
                            : 'bg-amber-50 border border-amber-200 text-amber-800'
                      }`}
                    >
                      <p>{entry.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t bg-white space-y-3">
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((replyKey) => (
                    <Button
                      key={replyKey}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => sendTwoWayReply(replyKey)}
                      disabled={!isTwoWayStarted || isProcessingTurn || !currentWaitStepId}
                    >
                      {replyKey}
                    </Button>
                  ))}
                  {quickReplies.length === 0 && (
                    <span className="text-xs text-gray-500">Quick replies appear when a wait step is active.</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={twoWayReplyInput}
                    onChange={(e) => setTwoWayReplyInput(e.target.value)}
                    placeholder="Type simulated patient reply"
                    disabled={!isTwoWayStarted || isProcessingTurn || !currentWaitStepId}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        sendTwoWayReply();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => sendTwoWayReply()}
                    disabled={!isTwoWayStarted || isProcessingTurn || !currentWaitStepId || !twoWayReplyInput.trim()}
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Step Timeline</h2>
              </div>

              <div className="p-4 h-[480px] overflow-y-auto space-y-2">
                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-500">Timeline events will appear as the simulation progresses.</p>
                ) : (
                  timeline.map((event) => (
                    <div key={event.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{event.label}</p>
                        <Badge className="bg-slate-100 text-slate-700 border-slate-300">{event.actionType}</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {event.event === 'entered' ? 'Entered step' : event.detail || 'Branch selected'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
