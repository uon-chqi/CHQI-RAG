import { useEffect, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
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
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [systemModules, setSystemModules] = useState<SystemModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newBranchKey, setNewBranchKey] = useState('');

  const [formData, setFormData] = useState<Record<string, unknown>>({});

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

  if (!selectedNode) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center border-2 border-dashed border-gray-200 rounded-lg m-4">
        Select a node on the canvas to configure its settings.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <div className="mb-6 border-b pb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Node Configuration</h3>
          <p className="text-xs text-gray-500 mt-1">ID: {selectedNode.id}</p>
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
        <div className="space-y-6">
          {actionType === StepActionType.SEND_SMS && (
            <div>
              <label className="block text-sm font-medium mb-2">SMS Template</label>
              <select
                className="w-full p-2 border rounded-md text-sm bg-white"
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
            </div>
          )}

          {actionType === StepActionType.WAIT_FOR_REPLY && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Timeout (Hours)</label>
                <Input
                  type="number"
                  min="1"
                  value={(formData.timeoutHours as number) || 24}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    handleChange('timeoutHours', Number.isNaN(parsed) ? 24 : parsed);
                  }}
                  placeholder="24"
                />
                <p className="text-xs text-gray-500 mt-1">Wait duration before fallback or timeout path.</p>
              </div>

              <div className="pt-4 border-t">
                <label className="block text-sm font-medium mb-2">Expected Replies (Branches)</label>
                <p className="text-xs text-gray-500 mb-2">
                  Define keys like YES, NO, 1, or ANY, then route each key to a target node.
                </p>

                <div className="space-y-2">
                  {Object.keys(branches).map((key) => (
                    <div key={key} className="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                      <span className="font-bold text-sm min-w-[40px]">{key}</span>
                      <select
                        className="flex-1 p-1.5 border rounded-md text-xs bg-white"
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
                          const label = String(nodeData.actionType || node.type || 'Node');
                          return (
                            <option key={node.id} value={node.id}>
                              {label} ({node.id})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        onClick={() => removeBranch(key)}
                        className="text-red-500 hover:text-red-700"
                        type="button"
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
                      className="text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={addBranch} type="button">
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

              {formData.module && (
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

              {formData.action && (
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
