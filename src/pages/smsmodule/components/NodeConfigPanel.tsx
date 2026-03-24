import { useEffect, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../../../context/AuthContext';
import { smsServices } from '../../../lib/api';
import { StepActionType, type SmsTemplate } from '../../../types/sms';

type SystemModule = {
  module: string;
  actions: string[];
};

type NodeConfigPanelProps = {
  selectedNode: Node | null;
  availableNodes: Node[];
  onUpdateNodeData: (nodeId: string, newData: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
};

function normalizeArrayPayload<T>(payload: unknown): T[] {
  const source = payload as T[] | { data?: T[] };
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}

export default function NodeConfigPanel({ selectedNode, availableNodes, onUpdateNodeData, onDeleteNode }: NodeConfigPanelProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [systemModules, setSystemModules] = useState<SystemModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newBranchKey, setNewBranchKey] = useState('');
  const [showQuickTemplateForm, setShowQuickTemplateForm] = useState(false);
  const [quickTemplateName, setQuickTemplateName] = useState('');
  const [quickTemplateBody, setQuickTemplateBody] = useState('');
  const [quickTemplateUniversal, setQuickTemplateUniversal] = useState(false);
  const [quickTemplateError, setQuickTemplateError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const fetchTemplates = async (asRefresh = false) => {
    if (asRefresh) {
      setIsRefreshingTemplates(true);
    }
    try {
      const tplRes = await smsServices.getTemplates();
      setTemplates(normalizeArrayPayload<SmsTemplate>(tplRes));
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      if (asRefresh) {
        setIsRefreshingTemplates(false);
      }
    }
  };

  useEffect(() => {
    const fetchReferences = async () => {
      setIsLoading(true);
      try {
        const [tplRes, sysRes] = await Promise.all([
          smsServices.getTemplates(),
          smsServices.getSystemModules(),
        ]);
        setTemplates(normalizeArrayPayload<SmsTemplate>(tplRes));
        setSystemModules(normalizeArrayPayload<SystemModule>(sysRes));
      } catch (err) {
        console.error('Failed to load reference data', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferences();
  }, []);

  useEffect(() => {
    if (selectedNode) {
      setFormData((selectedNode.data as Record<string, unknown>) || {});
      setNewBranchKey('');
    } else {
      setFormData({});
      setNewBranchKey('');
    }
  }, [selectedNode]);

  const actionType = useMemo(() => {
    if (!selectedNode) return null;
    const fromData = (selectedNode.data as { actionType?: StepActionType })?.actionType;
    return fromData || (selectedNode.type as StepActionType);
  }, [selectedNode]);

  const handleChange = (field: string, value: unknown) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    if (selectedNode) {
      onUpdateNodeData(selectedNode.id, updated);
    }
  };

  const currentModule = systemModules.find((m) => m.module === formData.module);
  const branches = (formData.branches as Record<string, string | null>) || {};
  const targetableNodes = availableNodes.filter((node) => node.id !== selectedNode?.id);
  const selectedTemplate = templates.find((template) => template.id === (formData.templateId as string));

  const addBranch = () => {
    const key = newBranchKey.trim().toUpperCase();
    if (!key) return;
    handleChange('branches', { ...branches, [key]: null });
    setNewBranchKey('');
  };

  const removeBranch = (key: string) => {
    const updated = { ...branches };
    delete updated[key];
    handleChange('branches', updated);
  };

  const clearAllBranches = () => {
    handleChange('branches', {});
  };

  const resetQuickTemplateForm = () => {
    setQuickTemplateName('');
    setQuickTemplateBody('');
    setQuickTemplateUniversal(false);
    setQuickTemplateError(null);
  };

  const handleCreateTemplate = async () => {
    const name = quickTemplateName.trim();
    const body = quickTemplateBody.trim();

    if (!name || !body) {
      setQuickTemplateError('Template name and body are required.');
      return;
    }

    setIsCreatingTemplate(true);
    setQuickTemplateError(null);

    try {
      const facilityId = isSuperAdmin && quickTemplateUniversal ? null : (user?.facility_id ?? null);
      const created = await smsServices.createTemplate({ name, body, facilityId });

      setTemplates((prev) => {
        if (prev.some((template) => template.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });

      handleChange('templateId', created.id);
      handleChange('templateName', created.name);

      resetQuickTemplateForm();
      setShowQuickTemplateForm(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        'Failed to create template.';
      setQuickTemplateError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  if (!selectedNode) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center border-2 border-dashed border-gray-200 rounded-lg m-4">
        Select a node on the canvas to configure its settings.
      </div>
    );
  }

  const compactNodeId =
    selectedNode.id.length > 16
      ? `${selectedNode.id.slice(0, 8)}...${selectedNode.id.slice(-4)}`
      : selectedNode.id;

  return (
    <div className="flex flex-col h-full p-5 overflow-y-auto bg-gradient-to-b from-white to-gray-50/60">
      <div className="mb-5 pb-4 border-b border-gray-200 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Node Configuration</h3>
          <p
            className="mt-1 inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-600"
            title={selectedNode.id}
          >
            ID: {compactNodeId}
          </p>
        </div>
        <button
          type="button"
          title="Delete this node"
          onClick={() => onDeleteNode(selectedNode.id)}
          className="shrink-0 p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Node Name</label>
            <Input
              value={(formData.nodeLabel as string) || ''}
              onChange={(e) => handleChange('nodeLabel', e.target.value)}
              placeholder="E.g., Day 1 Reminder"
              className="h-9"
            />
            <p className="text-xs text-gray-500 mt-2">This label is shown on the canvas card.</p>
          </div>

          {actionType === StepActionType.SEND_SMS && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3 shadow-sm">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-blue-700">SMS Template</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => fetchTemplates(true)}
                      disabled={isRefreshingTemplates}
                      title="Refresh templates"
                    >
                      <RefreshCw size={14} className={isRefreshingTemplates ? 'animate-spin' : ''} />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs whitespace-nowrap"
                      onClick={() => {
                        setShowQuickTemplateForm((prev) => !prev);
                        setQuickTemplateError(null);
                      }}
                    >
                      {showQuickTemplateForm ? 'Hide Form' : 'Create Template'}
                    </Button>
                  </div>
                </div>

                <select
                  className="w-full h-10 px-2 border border-gray-300 rounded-md text-sm bg-white"
                  value={(formData.templateId as string) || ''}
                  onChange={(e) => {
                    const template = templates.find((t) => t.id === e.target.value);
                    handleChange('templateId', e.target.value);
                    handleChange('templateName', template?.name || '');
                  }}
                >
                  <option value="">-- Select a template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                {selectedTemplate?.body && (
                  <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/40 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1">Message Preview</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedTemplate.body}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{selectedTemplate.body.length} characters</p>
                  </div>
                )}
              </div>

              {showQuickTemplateForm && (
                <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                  <p className="text-xs font-medium text-blue-800">Create template inline</p>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700">Template Name</label>
                    <Input
                      value={quickTemplateName}
                      onChange={(e) => setQuickTemplateName(e.target.value)}
                      placeholder="E.g., Day 1 Reminder"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700">Message Body</label>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-gray-300 bg-white p-2 text-sm"
                      value={quickTemplateBody}
                      onChange={(e) => setQuickTemplateBody(e.target.value)}
                      placeholder="Type your SMS message here..."
                    />
                  </div>

                  {isSuperAdmin && (
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quickTemplateUniversal}
                        onChange={(e) => setQuickTemplateUniversal(e.target.checked)}
                      />
                      Make universal template
                    </label>
                  )}

                  {quickTemplateError && <p className="text-xs text-red-600">{quickTemplateError}</p>}

                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={handleCreateTemplate} disabled={isCreatingTemplate}>
                      {isCreatingTemplate ? 'Creating...' : 'Create & Use'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetQuickTemplateForm();
                        setShowQuickTemplateForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {actionType === StepActionType.WAIT_FOR_REPLY && (
            <div className="space-y-4 rounded-lg border border-orange-200 bg-white p-3 shadow-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1.5">Timeout (Hours)</label>
                <Input
                  type="number"
                  min="1"
                  value={(formData.timeoutHours as number) || 24}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    handleChange('timeoutHours', Number.isNaN(parsed) ? 24 : parsed);
                  }}
                  placeholder="24"
                  className="h-9"
                />
                <p className="text-xs text-gray-500 mt-1">Wait duration before fallback or timeout path.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1.5">Retry Limit</label>
                <Input
                  type="number"
                  min="1"
                  value={typeof formData.retryLimit === 'number' ? (formData.retryLimit as number) : 3}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    handleChange('retryLimit', Number.isNaN(parsed) ? 3 : Math.max(1, parsed));
                  }}
                  placeholder="3"
                  className="h-9"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max wrong-input loop attempts for this wait step before runtime should follow timeout/fallback handling.
                </p>
              </div>

              <div className="pt-4 border-t border-orange-100">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium">Expected Replies (Branches)</label>
                  {Object.keys(branches).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      className="h-8 px-2 text-xs leading-none whitespace-nowrap"
                      onClick={clearAllBranches}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Define keys like YES, NO, 1, or ANY, then route each key to a target node.
                </p>

                <div className="space-y-2">
                  {Object.keys(branches).map((key) => (
                    <div key={key} className="grid grid-cols-[auto,1fr,auto] items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                      <span className="inline-flex min-w-[44px] justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-700">
                        {key}
                      </span>
                      <select
                        className="h-9 w-full border border-gray-300 rounded-md text-xs bg-white px-2"
                        value={branches[key] || ''}
                        onChange={(e) =>
                          handleChange('branches', {
                            ...branches,
                            [key]: e.target.value || null,
                          })
                        }
                      >
                        <option value="">-- Select target node --</option>
                        {targetableNodes.map((node) => {
                          const nodeData = (node.data || {}) as Record<string, unknown>;
                          const label = String(nodeData.nodeLabel || nodeData.actionType || node.type || 'Node');
                          return (
                            <option key={node.id} value={node.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        onClick={() => removeBranch(key)}
                        className="h-8 w-8 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
                        type="button"
                        title="Delete expected reply"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="E.g., YES or ANY"
                      value={newBranchKey}
                      onChange={(e) => setNewBranchKey(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button size="sm" variant="outline" className="h-9 px-3" onClick={addBranch} type="button">
                      <Plus size={16} /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {actionType === StepActionType.SYSTEM_ACTION && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Module</label>
                <select
                  className="w-full p-2 border rounded-md text-sm bg-white"
                  value={(formData.module as string) || ''}
                  onChange={(e) => {
                    handleChange('module', e.target.value);
                    handleChange('action', '');
                  }}
                >
                  <option value="">-- Select Module --</option>
                  {systemModules.map((m) => (
                    <option key={m.module} value={m.module}>
                      {m.module}
                    </option>
                  ))}
                </select>
              </div>

              {typeof formData.module === 'string' && formData.module.trim().length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Action</label>
                  <select
                    className="w-full p-2 border rounded-md text-sm bg-white"
                    value={(formData.action as string) || ''}
                    onChange={(e) => handleChange('action', e.target.value)}
                  >
                    <option value="">-- Select Action --</option>
                    {(currentModule?.actions || []).map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {typeof formData.action === 'string' && formData.action.trim().length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Target Value / Status</label>
                  <Input
                    value={(formData.value as string) || ''}
                    onChange={(e) => handleChange('value', e.target.value)}
                    placeholder="E.g., CONFIRMED or RESCHEDULE_REQUESTED"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
