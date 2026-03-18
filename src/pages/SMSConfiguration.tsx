import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Pencil, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface TimingEntry {
  days_before_appointment: number;
  message_text: string;
  is_two_way: boolean;
  enabled: boolean;
}

const riskLevels: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW'];

export default function SMSConfiguration() {
  const { token } = useAuth();
  const [facilityId, setFacilityId] = useState('');
  const [configs, setConfigs] = useState<Record<RiskLevel, TimingEntry[]>>({ HIGH: [], MEDIUM: [], LOW: [] });
  const [loading, setLoading] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskLevel | null>(null);
  const [localEdits, setLocalEdits] = useState<TimingEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'reminders' | 'followup'>('reminders');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const authHeaders = useCallback(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );

  // Load facilities and auto-select first
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/overview`, { headers: authHeaders() })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          const facs = json.data.facilities || [];
          if (facs.length > 0) setFacilityId(facs[0].id);
        }
      })
  }, [authHeaders]);

  const loadConfigs = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const cfgRes = await fetch(`${API_BASE}/api/sms-admin/configurations?facility_id=${facilityId}`, { headers: authHeaders() }).then(r => r.json());
      const grouped: Record<RiskLevel, TimingEntry[]> = { HIGH: [], MEDIUM: [], LOW: [] };
      if (cfgRes.success) {
        for (const row of cfgRes.data) {
          const rl = row.risk_level as RiskLevel;
          if (grouped[rl] && Array.isArray(row.message_timing)) {
            grouped[rl] = row.message_timing
              .map((t: TimingEntry) => ({ ...t, message_text: t.message_text || '', enabled: t.enabled !== false }))
              .sort((a: TimingEntry, b: TimingEntry) => b.days_before_appointment - a.days_before_appointment);
          }
        }
      }
      setConfigs(grouped);
    } finally { setLoading(false); }
  }, [facilityId, authHeaders]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const startEditing = (risk: RiskLevel) => {
    setEditingRisk(risk);
    const existing = configs[risk];
    const defaults: Record<RiskLevel, TimingEntry[]> = {
      HIGH: [
        { days_before_appointment: 14, message_text: '', is_two_way: false, enabled: true },
        { days_before_appointment: 7,  message_text: '', is_two_way: false, enabled: true },
        { days_before_appointment: 3,  message_text: '', is_two_way: false, enabled: true },
        { days_before_appointment: 1,  message_text: '', is_two_way: true,  enabled: true },
      ],
      MEDIUM: [
        { days_before_appointment: 7,  message_text: '', is_two_way: false, enabled: true },
        { days_before_appointment: 3,  message_text: '', is_two_way: false, enabled: true },
        { days_before_appointment: 1,  message_text: '', is_two_way: true,  enabled: true },
      ],
      LOW: [
        { days_before_appointment: 3,  message_text: '', is_two_way: false, enabled: true },
        { days_before_appointment: 1,  message_text: '', is_two_way: true,  enabled: true },
      ],
    };
    setLocalEdits(existing.length > 0 ? existing.map(c => ({ ...c })) : defaults[risk]);
  };

  const cancelEditing = () => { setEditingRisk(null); setLocalEdits([]); };

  const updateRow = (i: number, field: keyof TimingEntry, val: number | string | boolean) => {
    const updated = [...localEdits];
    updated[i] = { ...updated[i], [field]: val };
    setLocalEdits(updated);
  };

  const saveConfig = async () => {
    if (!editingRisk || !facilityId) return;
    setSaving(true);
    const res = await fetch(`${API_BASE}/api/sms-admin/configurations`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ facility_id: facilityId, risk_level: editingRisk, message_timing: localEdits, enabled: true }),
    }).then(r => r.json()).catch(() => null);
    setSaving(false);
    if (res?.success) {
      setSaved(true);
      await loadConfigs();
      setEditingRisk(null);
      setLocalEdits([]);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading && configs.HIGH.length === 0 && configs.MEDIUM.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage automated SMS messaging and budgets</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'reminders', label: 'Appointment Reminders' },
          { key: 'followup',  label: 'Message Templates' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'reminders' | 'followup')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg">
          Configuration saved successfully!
        </div>
      )}

      {/* ── APPOINTMENT REMINDERS TAB ── */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          {riskLevels.map(risk => {
            const rows = configs[risk];
            const isEditing = editingRisk === risk;
            const riskBadge = risk === 'HIGH' ? 'bg-red-100 text-red-700' : risk === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

            return (
              <div key={risk} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <h3 className="text-base font-semibold text-gray-900">
                    <span className={`inline-block mr-2 px-2 py-0.5 rounded text-xs font-bold ${riskBadge}`}>{risk}</span>
                    Risk Patients
                  </h3>
                  {!isEditing ? (
                    <button onClick={() => startEditing(risk)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : (
                    <button onClick={cancelEditing} title="Cancel editing" className="text-gray-400 hover:text-gray-600 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* View mode */}
                {!isEditing && (
                  <div className="px-5 pb-4 space-y-2">
                    {rows.length === 0 ? (
                      <p className="text-sm text-gray-400">No reminders configured. Click Edit to add.</p>
                    ) : rows.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-700">
                          {r.days_before_appointment} days before appointment
                          {r.is_two_way && <span className="ml-2 text-xs text-blue-600 font-medium">(two-way)</span>}
                          {r.message_text && <span className="block text-xs text-gray-400 mt-0.5 truncate max-w-xs">{r.message_text}</span>}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit mode */}
                {isEditing && (
                  <div className="px-5 pb-5 space-y-3">
                    {localEdits.map((row, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                        {/* Row top: days + enabled + delete */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-600 mb-1 font-medium">Days Before Appointment</label>
                            <input
                              type="number" min={0} max={90} title="Days before appointment"
                              value={row.days_before_appointment}
                              onChange={e => updateRow(i, 'days_before_appointment', parseInt(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-5">
                            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={row.enabled} onChange={e => updateRow(i, 'enabled', e.target.checked)} className="rounded" />
                              Enabled
                            </label>
                            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={row.is_two_way} onChange={e => updateRow(i, 'is_two_way', e.target.checked)} className="rounded" />
                              Two-way
                            </label>
                            <button onClick={() => setLocalEdits(localEdits.filter((_, idx) => idx !== i))}
                              className="text-red-400 hover:text-red-600 p-1" title="Remove">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Message text */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 font-medium">
                            SMS Message
                            {row.is_two_way && <span className="ml-1 text-blue-600">(client can reply)</span>}
                          </label>
                          <textarea
                            value={row.message_text}
                            onChange={e => updateRow(i, 'message_text', e.target.value)}
                            rows={2}
                            placeholder={row.is_two_way
                              ? 'Hi {{patient_name}}, your appointment at {{facility_name}} is tomorrow. Will you attend? Reply: 1=Yes, 2=No'
                              : 'Hello {{patient_name}}, reminder: appointment at {{facility_name}} on {{appointment_date}} ({{days_until}} days away).'}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-none"
                          />
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Use: {'{{patient_name}}'} {'{{appointment_date}}'} {'{{facility_name}}'} {'{{days_until}}'}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Add timing */}
                    <button onClick={() => setLocalEdits([...localEdits, { days_before_appointment: 0, message_text: '', is_two_way: false, enabled: true }])}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600">
                      <Plus className="w-4 h-4" /> Add Message Timing
                    </button>

                    <div className="flex justify-end">
                      <button onClick={saveConfig} disabled={saving}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Configuration'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TWO-WAY SMS FLOW TAB (read-only, hardcoded) ── */}
      {activeTab === 'followup' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-800">
            <strong>Hardcoded flow</strong> — these messages are sent automatically based on client replies to the 1-day appointment reminder. No configuration needed.
          </div>

          {/* Step 1: Initial two-way question */}
          <FlowCard
            icon="💬" label="STEP 1 — System sends (1 day before, two-way enabled)"
            message={'Your appointment is on [date]. Will you be able to attend?\n1: Yes\n2: No'}
          />

          {/* Branch: Yes */}
          <FlowBranch reply="Client replies 1 (Yes)">
            <FlowCard icon="✅" label="System responds" message="Great! See you then." terminal />
          </FlowBranch>

          {/* Branch: No */}
          <FlowBranch reply="Client replies 2 (No)">
            <FlowCard
              icon="❓" label="System asks reason"
              message={'Kindly let us know why:\n1: Out of town\n2: Too Busy\n3: Still have medication\n4: Clinic not friendly\n5: Other'}
            />
            <div className="ml-6 space-y-2 mt-2">
              <FlowBranch reply="1 — Out of town">
                <FlowCard icon="🏥" label="System responds" message="Pick medication from any clinic near you." terminal />
              </FlowBranch>
              <FlowBranch reply="2 — Too Busy">
                <FlowCard icon="🤝" label="System asks" message={'Can you send someone to pick the medication?\n1: Yes\n2: No'} />
                <div className="ml-6 space-y-2 mt-2">
                  <FlowBranch reply="1 — Yes">
                    <FlowCard icon="✅" label="System responds" message="Thank you." terminal />
                  </FlowBranch>
                  <FlowBranch reply="2 — No">
                    <FlowCard icon="ℹ️" label="System responds" message="Please visit the clinic as soon as you can." terminal />
                  </FlowBranch>
                </div>
              </FlowBranch>
              <FlowBranch reply="3 — Still have medication">
                <FlowCard icon="💊" label="System responds" message="Ensure you return to clinic before you run out of medication." terminal />
              </FlowBranch>
              <FlowBranch reply="4 — Clinic not friendly">
                <FlowCard icon="🏥" label="System responds" message="Clinic is improving, please return." terminal />
              </FlowBranch>
              <FlowBranch reply="5 — Other">
                <FlowCard icon="ℹ️" label="System responds" message="Please visit the clinic as soon as you can." terminal />
              </FlowBranch>
            </div>
          </FlowBranch>
        </div>
      )}
    </div>
  );
}

// ── Supporting components for the read-only flow diagram ────────────────────
function FlowCard({ icon, label, message, terminal }: { icon: string; label: string; message: string; terminal?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 bg-white shadow-sm ${terminal ? 'border-gray-200' : 'border-blue-200'}`}>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{icon} {label}</p>
      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
        {message}
      </pre>
      {terminal && <p className="text-[11px] text-gray-400 mt-1.5 italic">↳ End of conversation</p>}
    </div>
  );
}

function FlowBranch({ reply, children }: { reply: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-dashed border-gray-300 pl-4 space-y-2">
      <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full">
        {reply}
      </span>
      {children}
    </div>
  );
}
