import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, MessageSquare, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Type definitions
interface ReminderConfig {
  id?: string;
  facility_id: string;
  risk_level: string;
  days_before_appointment: number;
  is_two_way: boolean;
  message_text: string;
  enabled: boolean;
}

interface FollowupTemplate {
  id?: string;
  template_type: string;
  message_text: string;
  enabled: boolean;
}

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// SMS Configuration Management Page
export default function SMSConfiguration() {
  const [facilityId, setFacilityId] = useState(localStorage.getItem('facilityId') || '');
  const [configs, setConfigs] = useState<Record<RiskLevel, ReminderConfig[]>>({
    HIGH: [],
    MEDIUM: [],
    LOW: []
  });
  const [followupTemplates, setFollowupTemplates] = useState<FollowupTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'reminders' | 'followups' | 'budget'>('reminders');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel>('HIGH');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newConfig, setNewConfig] = useState<Partial<ReminderConfig> | null>(null);

  const riskLevels: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW'];

  const followupTypes = [
    { value: 'followup_out_of_town', label: 'Out of Town Response' },
    { value: 'followup_too_busy', label: 'Too Busy Response' },
    { value: 'followup_have_meds', label: 'Still Have Medication Response' },
    { value: 'followup_clinic_issue', label: 'Clinic Not Friendly Response' },
    { value: 'followup_other', label: 'Other Reason Response' },
    { value: 'thank_you', label: 'Thank You Message' },
    { value: 'missed_appointment', label: 'Missed Appointment Message' },
    { value: 'visit_clinic', label: 'Visit Clinic Reminder' }
  ];

  const loadAllConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load reminder configs for all risk levels
      const response = await fetch(`${API_BASE}/api/sms-admin/reminder-configs?facility_id=${facilityId}`);
      const data = await response.json();
      
      if (data.success) {
        // Group by risk level
        const grouped: Record<RiskLevel, ReminderConfig[]> = {
          HIGH: [],
          MEDIUM: [],
          LOW: []
        };

        data.data.forEach((config: any) => {
          const templates = config.templates || [];
          const mainTemplate = templates.find((t: any) => 
            t.template_type === 'initial_reminder' || t.template_type === 'two_way_question'
          );

          grouped[config.risk_level as RiskLevel].push({
            id: config.id,
            facility_id: config.facility_id,
            risk_level: config.risk_level,
            days_before_appointment: config.days_before_appointment,
            is_two_way: config.is_two_way,
            message_text: mainTemplate?.message_text || '',
            enabled: config.enabled
          });
        });

        // Sort by days descending
        Object.keys(grouped).forEach(risk => {
          grouped[risk as RiskLevel].sort((a, b) => b.days_before_appointment - a.days_before_appointment);
        });

        setConfigs(grouped);
      }

      // Load followup templates
      const followupResp = await fetch(`${API_BASE}/api/sms-admin/followup-templates?facility_id=${facilityId}`);
      const followupData = await followupResp.json();
      
      if (followupData.success) {
        setFollowupTemplates(followupData.data);
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) {
      loadAllConfigurations();
    }
  }, [facilityId, loadAllConfigurations]);

  const saveReminderConfig = async (config: Partial<ReminderConfig>) => {
    try {
      const response = await fetch(`${API_BASE}/api/sms-admin/reminder-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          risk_level: selectedRiskLevel,
          days_before_appointment: config.days_before_appointment,
          is_two_way: config.is_two_way || false,
          message_text: config.message_text,
          enabled: config.enabled !== false
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await loadAllConfigurations();
        setNewConfig(null);
        setEditingIndex(null);
        alert('Configuration saved successfully!');
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration');
    }
  };

  const deleteReminderConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this reminder configuration?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/sms-admin/reminder-configs/${configId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        await loadAllConfigurations();
        alert('Configuration deleted successfully!');
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Error deleting configuration');
    }
  };

  const saveFollowupTemplate = async (template: FollowupTemplate) => {
    try {
      const response = await fetch(`${API_BASE}/api/sms-admin/followup-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });

      const data = await response.json();
      
      if (data.success) {
        await loadAllConfigurations();
        alert('Followup template saved successfully!');
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving followup template:', error);
      alert('Error saving followup template');
    }
  };

  return (
    <div className="flex flex-col p-4 md:p-6 gap-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">SMS Configuration</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage automated appointment reminders and patient journey messaging</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Facility ID:</label>
          <Input
            type="text"
            value={facilityId}
            onChange={(e) => {
              setFacilityId(e.target.value);
              localStorage.setItem('facilityId', e.target.value);
            }}
            placeholder="Enter facility ID"
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('reminders')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'reminders'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1" />
          Appointment Reminders
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'followups'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-1" />
          Follow-up Messages
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center p-8">
          <div className="text-gray-600">Loading...</div>
        </div>
      )}

      {/* Appointment Reminders Tab */}
      {activeTab === 'reminders' && !loading && (
        <div className="space-y-6">
          {/* Risk Level Selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Risk Level</label>
            <div className="flex gap-2">
              {riskLevels.map(level => (
                <button
                  key={level}
                  onClick={() => setSelectedRiskLevel(level)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedRiskLevel === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level} Risk ({configs[level].length} reminders)
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Configurations List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedRiskLevel} Risk Patients - Appointment Reminders
              </h3>
              <Button
                onClick={() => setNewConfig({
                  facility_id: facilityId,
                  risk_level: selectedRiskLevel,
                  days_before_appointment: 0,
                  is_two_way: false,
                  message_text: '',
                  enabled: true
                })}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Reminder
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {configs[selectedRiskLevel].length === 0 && !newConfig && (
                <div className="text-center py-8 text-gray-500">
                  No reminders configured for {selectedRiskLevel} risk patients.
                  <br />
                  Click "Add Reminder" to create your first reminder.
                </div>
              )}

              {/* Existing Configs */}
              {configs[selectedRiskLevel].map((config,idx) => (
                <ConfigCard
                  key={config.id || idx}
                  config={config}
                  isEditing={editingIndex === idx}
                  onEdit={() => setEditingIndex(idx)}
                  onCancel={() => setEditingIndex(null)}
                  onSave={(updated) => {
                    saveReminderConfig(updated);
                  }}
                  onDelete={() => config.id && deleteReminderConfig(config.id)}
                />
              ))}

              {/* New Config Form */}
              {newConfig && (
                <ConfigCard
                  config={newConfig as ReminderConfig}
                  isEditing={true}
                  isNew={true}
                  onCancel={() => setNewConfig(null)}
                  onSave={(updated) => {
                    saveReminderConfig(updated);
                  }}
                />
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 How it works:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>One-way SMS</strong>: Sent at 14, 7, 3 days before appointment (automated reminders)</li>
              <li>• <strong>Two-way SMS</strong>: Sent 1 day before asking "Will you be able to attend?" (interactive)</li>
              <li>• <strong>Patient responses</strong> are processed and appropriate follow-up messages are sent</li>
              <li>• <strong>Send time</strong>: Uses each patient's preferred SMS time from their profile</li>
            </ul>
          </div>
        </div>
      )}

      {/* Follow-up Messages Tab */}
      {activeTab === 'followups' && !loading && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Two-Way SMS Follow-up Messages
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              These messages are automatically sent based on patient responses to the 1-day reminder.
            </p>

            <div className="space-y-6">
              {followupTypes.map(type => {
                const existing = followupTemplates.find(t => t.template_type === type.value);
                return (
                  <FollowupTemplateCard
                    key={type.value}
                    label={type.label}
                    templateType={type.value}
                    existingTemplate={existing}
                    onSave={(message) => saveFollowupTemplate({
                      template_type: type.value,
                      message_text: message,
                      enabled: true
                    })}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Config Card Component
function ConfigCard({ 
  config, 
  isEditing,
  isNew = false,
  onEdit,
  onCancel, 
  onSave, 
  onDelete 
}: {
  config: ReminderConfig;
  isEditing: boolean;
  isNew?: boolean;
  onEdit?: () => void;
  onCancel: () => void;
  onSave: (config: Partial<ReminderConfig>) => void;
  onDelete?: () => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  if (!isEditing) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-gray-900">
                {config.days_before_appointment} days before
              </span>
              {config.is_two_way && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                  TWO-WAY
                </span>
              )}
              {config.enabled ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">
                  Enabled
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{config.message_text}</p>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button onClick={onEdit} size="sm" variant="outline">
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button onClick={onDelete} size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Days Before Appointment <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="0"
              max="90"
              value={localConfig.days_before_appointment}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                days_before_appointment: parseInt(e.target.value) || 0
              })}
              placeholder="e.g., 14"
            />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localConfig.is_two_way}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  is_two_way: e.target.checked
                })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Two-way SMS (interactive)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localConfig.enabled}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  enabled: e.target.checked
                })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Enabled</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message Template <span className="text-red-500">*</span>
          </label>
          <textarea
            value={localConfig.message_text}
            onChange={(e) => setLocalConfig({
              ...localConfig,
              message_text: e.target.value
            })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type your message here... Use {{patient_name}}, {{appointment_date}}, {{facility_name}} as variables"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available variables: {'{{'} patient_name{'}}'}, {'{{'}appointment_date{'}}'}, {'{{'}facility_name{'}}'}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} variant="outline" size="sm">
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button 
            onClick={() => onSave(localConfig)} 
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!localConfig.message_text || localConfig.days_before_appointment < 0}
          >
            <Save className="w-4 h-4 mr-1" />
            {isNew ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Followup Template Card
function FollowupTemplateCard({
  label,
  templateType,
  existingTemplate,
  onSave
}: {
  label: string;
  templateType: string;
  existingTemplate?: FollowupTemplate;
  onSave: (message: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState(existingTemplate?.message_text || '');

  const handleSave = () => {
    if (message.trim()) {
      onSave(message);
      setIsEditing(false);
    }
  };

  if (!isEditing && !existingTemplate) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">{label}</span>
          <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" />
            Configure
          </Button>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900 mb-1">{label}</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{existingTemplate?.message_text}</p>
          </div>
          <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">{label}</h4>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
        placeholder="Type your follow-up message here..."
      />
      <div className="flex justify-end gap-2">
        <Button onClick={() => {
          setMessage(existingTemplate?.message_text || '');
          setIsEditing(false);
        }} variant="outline" size="sm">
          Cancel
        </Button>
        <Button onClick={handleSave} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>
      </div>
    </div>
  );
}
