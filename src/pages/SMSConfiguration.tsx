import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

// Type definitions
interface MessageTiming {
  days_before_appointment: number;
  time: string;
  enabled: boolean;
}

interface SMSConfig {
  id?: string;
  facility_id?: string;
  risk_level: string;
  message_timing: MessageTiming[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface BudgetLimit {
  id?: string;
  facility_id?: string;
  risk_level: string;
  messages_per_month: number;
  messages_per_patient_per_month: number | null;
  budget_month_start_day?: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface MessageTemplate {
  id: string;
  facility_id: string;
  template_type: string;
  risk_level: string | null;
  subject: string;
  body: string;
  variables: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// SMS Configuration Management Page
export default function SMSConfiguration() {
  const [facilityId, setFacilityId] = useState(localStorage.getItem('facilityId') || '');
  const [configs, setConfigs] = useState<SMSConfig[]>([]);
  const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('configuration');
  const [editingConfig, setEditingConfig] = useState<SMSConfig | null>(null);

  const riskLevels: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW'];
  const defaultTimings: Record<RiskLevel, MessageTiming[]> = {
    HIGH: [
      { days_before_appointment: 30, time: '09:00', enabled: true },
      { days_before_appointment: 21, time: '09:00', enabled: true },
      { days_before_appointment: 14, time: '09:00', enabled: true },
      { days_before_appointment: 7, time: '09:00', enabled: true },
      { days_before_appointment: 3, time: '09:00', enabled: true },
      { days_before_appointment: 1, time: '09:00', enabled: true }
    ],
    MEDIUM: [
      { days_before_appointment: 14, time: '09:00', enabled: true },
      { days_before_appointment: 7, time: '09:00', enabled: true },
      { days_before_appointment: 1, time: '09:00', enabled: true }
    ],
    LOW: [
      { days_before_appointment: 14, time: '09:00', enabled: true },
      { days_before_appointment: 1, time: '09:00', enabled: true }
    ]
  };

  const defaultBudgets = {
    HIGH: { messages_per_month: 1000, messages_per_patient_per_month: 100 },
    MEDIUM: { messages_per_month: 500, messages_per_patient_per_month: 50 },
    LOW: { messages_per_month: 200, messages_per_patient_per_month: 20 }
  };

  const loadConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sms-admin/configurations?facility_id=${facilityId}`);
      const data = await response.json();
      if (data.success) {
        setConfigs(data.data);
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const loadBudgets = useCallback(async () => {
    try {
      const response = await fetch(`/api/sms-admin/budget-limits?facility_id=${facilityId}`);
      const data = await response.json();
      if (data.success) {
        setBudgets(data.data);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
    }
  }, [facilityId]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch(`/api/sms-admin/message-templates?facility_id=${facilityId}`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) {
      loadConfigurations();
      loadBudgets();
      loadTemplates();
    }
  }, [facilityId, loadConfigurations, loadBudgets, loadTemplates]);

  const saveConfiguration = async (config: SMSConfig) => {
    try {
      const payload = {
        facility_id: facilityId,
        risk_level: config.risk_level,
        message_timing: config.message_timing,
        enabled: config.enabled
      };

      const response = await fetch('/api/sms-admin/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        loadConfigurations();
        setEditingConfig(null);
        alert('Configuration saved successfully!');
      } else {
        alert('Error saving configuration: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration');
    }
  };

  const saveBudget = async (budget: BudgetLimit) => {
    try {
      const payload = {
        facility_id: facilityId,
        risk_level: budget.risk_level,
        messages_per_month: budget.messages_per_month,
        messages_per_patient_per_month: budget.messages_per_patient_per_month,
        enabled: budget.enabled
      };

      const response = await fetch('/api/sms-admin/budget-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        loadBudgets();
        alert('Budget saved successfully!');
      } else {
        alert('Error saving budget: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Error saving budget');
    }
  };

  const getConfigForRiskLevel = (riskLevel: RiskLevel): SMSConfig => {
    return configs.find(c => c.risk_level === riskLevel) || {
      risk_level: riskLevel,
      message_timing: defaultTimings[riskLevel],
      enabled: true
    };
  };

  const getBudgetForRiskLevel = (riskLevel: RiskLevel): BudgetLimit => {
    return budgets.find(b => b.risk_level === riskLevel) || {
      risk_level: riskLevel,
      ...defaultBudgets[riskLevel],
      enabled: true
    };
  };

  return (
    <div className="flex flex-col p-6 gap-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SMS Configuration</h1>
          <p className="text-gray-600 mt-2">Manage automated SMS messaging and budgets</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Facility ID:</label>
          <Input
            type="text"
            value={facilityId}
            onChange={(e) => {
              setFacilityId(e.target.value);
              localStorage.setItem('facilityId', e.target.value);
            }}
            placeholder="Enter facility ID"
            className="w-48"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('configuration')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'configuration'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600'
          }`}
        >
          Appointment Reminders
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'budgets'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600'
          }`}
        >
          SMS Budget
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'templates'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600'
          }`}
        >
          Message Templates
        </button>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="space-y-4">
          {riskLevels.map((riskLevel) => {
            const config = getConfigForRiskLevel(riskLevel);
            const isEditing = editingConfig?.risk_level === riskLevel;

            return (
              <div
                key={riskLevel}
                className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {riskLevel} Risk Patients
                  </h3>
                  <Button
                    onClick={() => setEditingConfig(isEditing ? null : config)}
                    variant={isEditing ? 'outline' : 'default'}
                  >
                    {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  </Button>
                </div>

                {isEditing ? (
                  <ConfigurationForm
                    config={config}
                    onSave={() => saveConfiguration(config)}
                    onChange={(updatedConfig: SMSConfig) => setEditingConfig(updatedConfig)}
                  />
                ) : (
                  <ConfigurationDisplay config={config} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Budgets Tab */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          {riskLevels.map((riskLevel) => {
            const budget = getBudgetForRiskLevel(riskLevel);

            return (
              <div
                key={riskLevel}
                className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {riskLevel} Risk Budget
                  </h3>
                </div>

                <BudgetForm
                  budget={budget}
                  onSave={() => saveBudget(budget)}
                  onChange={(updatedBudget: BudgetLimit) => {
                    const newBudgets = budgets.map(b =>
                      b.risk_level === riskLevel ? updatedBudget : b
                    );
                    if (!budgets.find(b => b.risk_level === riskLevel)) {
                      newBudgets.push(updatedBudget);
                    }
                    setBudgets(newBudgets);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Templates</h3>
          <MessageTemplatesList templates={templates} facilityId={facilityId} onReload={loadTemplates} />
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center p-8">
          <div className="text-gray-600">Loading...</div>
        </div>
      )}
    </div>
  );
}

// Configuration Form Component
function ConfigurationForm({ config, onSave, onChange }: {
  config: SMSConfig;
  onSave: () => void;
  onChange: (config: SMSConfig) => void;
}) {
  const [localConfig, setLocalConfig] = useState<SMSConfig>(config);

  const addTiming = () => {
    setLocalConfig({
      ...localConfig,
      message_timing: [
        ...localConfig.message_timing,
        { days_before_appointment: 0, time: '09:00', enabled: true }
      ]
    });
  };

  const removeTiming = (index: number) => {
    setLocalConfig({
      ...localConfig,
      message_timing: localConfig.message_timing.filter((_: MessageTiming, i: number) => i !== index)
    });
  };

  const updateTiming = (index: number, field: string, value: number | string | boolean) => {
    const newTiming = [...localConfig.message_timing];
    newTiming[index] = { ...newTiming[index], [field]: value };
    setLocalConfig({ ...localConfig, message_timing: newTiming });
    onChange({ ...localConfig, message_timing: newTiming });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {localConfig.message_timing.map((timing: MessageTiming, index: number) => (
          <div key={index} className="flex gap-3 items-center bg-gray-50 p-4 rounded">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Days Before Appointment
              </label>
              <Input
                type="number"
                value={timing.days_before_appointment}
                onChange={(e) =>
                  updateTiming(index, 'days_before_appointment', parseInt(e.target.value))
                }
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send Time (HH:MM)
              </label>
              <Input
                type="time"
                value={timing.time}
                onChange={(e) => updateTiming(index, 'time', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={timing.enabled}
                  onChange={(e) => updateTiming(index, 'enabled', e.target.checked)}
                  className="rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
              <Button
                onClick={() => removeTiming(index)}
                variant="outline"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={addTiming} variant="outline" className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add Message Timing
      </Button>

      <div className="flex gap-2 justify-end">
        <Button
          onClick={() => onSave()}
          className="flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

// Configuration Display Component
function ConfigurationDisplay({ config }: { config: SMSConfig }) {
  return (
    <div className="space-y-3">
      {config.message_timing.map((timing: MessageTiming, index: number) => (
        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
          <span className="text-sm text-gray-700">
            {timing.days_before_appointment} days before appointment at {timing.time}
          </span>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              timing.enabled
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {timing.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      ))}
    </div>
  );
}

// Budget Form Component
function BudgetForm({ budget, onSave, onChange }: {
  budget: BudgetLimit;
  onSave: () => void;
  onChange: (budget: BudgetLimit) => void;
}) {
  const [localBudget, setLocalBudget] = useState<BudgetLimit>(budget);

  const handleChange = (field: string, value: number | boolean | null) => {
    const updated = { ...localBudget, [field]: value };
    setLocalBudget(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Messages Per Month (Facility Total)
          </label>
          <Input
            type="number"
            value={localBudget.messages_per_month}
            onChange={(e) => handleChange('messages_per_month', parseInt(e.target.value))}
          />
          <p className="text-xs text-gray-500 mt-1">Total SMS budget for facility</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Messages Per Patient Per Month
          </label>
          <Input
            type="number"
            value={localBudget.messages_per_patient_per_month || ''}
            onChange={(e) =>
              handleChange('messages_per_patient_per_month', parseInt(e.target.value) || null)
            }
            placeholder="Optional"
          />
          <p className="text-xs text-gray-500 mt-1">Per-patient limit (optional)</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={localBudget.enabled}
          onChange={(e) => handleChange('enabled', e.target.checked)}
          className="rounded"
          id={`budget-enabled-${localBudget.risk_level}`}
        />
        <label
          htmlFor={`budget-enabled-${localBudget.risk_level}`}
          className="text-sm text-gray-700"
        >
          Enabled
        </label>
      </div>

      <Button onClick={onSave} className="w-full flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        Save Budget
      </Button>
    </div>
  );
}

// Message Templates List Component
function MessageTemplatesList({ templates, facilityId, onReload }: {
  templates: MessageTemplate[];
  facilityId: string;
  onReload: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm(!showForm)} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add New Template
      </Button>

      {showForm && (
        <MessageTemplateForm
          facilityId={facilityId}
          onSave={() => {
            setShowForm(false);
            onReload();
          }}
        />
      )}

      <div className="space-y-2">
        {templates.map((template: MessageTemplate) => (
          <div key={template.id} className="bg-gray-50 p-4 rounded border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-medium text-gray-900">{template.template_type}</h4>
                <p className="text-sm text-gray-600 mt-1">{template.body}</p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  template.enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {template.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Message Template Form Component
function MessageTemplateForm({ facilityId, onSave }: {
  facilityId: string;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    template_type: 'appointment_reminder',
    risk_level: null as string | null,
    body: '',
    subject: ''
  });

  const handleSubmit = async () => {
    if (!form.body) {
      alert('Message body is required');
      return;
    }

    try {
      const response = await fetch('/api/sms-admin/message-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          ...form
        })
      });

      const data = await response.json();
      if (data.success) {
        onSave();
        alert('Template saved successfully!');
      } else {
        alert('Error saving template: ' + data.error);
      }
    } catch {
      alert('Error saving template');
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded border border-gray-200 space-y-4">
      <select
        value={form.template_type}
        onChange={(e) => setForm({ ...form, template_type: e.target.value })}
        className="w-full border border-gray-300 rounded px-3 py-2"
        aria-label="Template type"
      >
        <option value="appointment_reminder">Appointment Reminder</option>
        <option value="missed_appointment_response">Missed Appointment Response</option>
        <option value="appointment_confirmation">Appointment Confirmation</option>
      </select>

      <textarea
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        placeholder="Message body (use {{patient_name}}, {{appointment_date}}, etc.)"
        className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
        rows={4}
      />

      <div className="flex gap-2">
        <Button onClick={handleSubmit} className="flex-1">
          Save Template
        </Button>
      </div>
    </div>
  );
}
