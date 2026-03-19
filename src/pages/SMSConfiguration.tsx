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
                    Risk Clients
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
                              ? 'e.g. Hi John, your appointment at Kisumu Hospital is tomorrow. Will you attend? Reply: 1=Yes, 2=No'
                              : 'e.g. Hello John, reminder: your appointment at Kisumu Hospital is on 4th April 2026 (7 days away).'}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-none"
                          />
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

      {/* ── TWO-WAY SMS FLOW TAB — Visual Flowcharts ── */}
      {activeTab === 'followup' && (
        <div className="space-y-6">
          {/* ── FLOW 1: Pre-Appointment (1 day before) ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-blue-50">
              <h3 className="text-sm font-bold text-blue-900">Flow 1 — Pre-Appointment Confirmation</h3>
              <p className="text-[11px] text-blue-700 mt-0.5">Sent 1 day before appointment &middot; two-way enabled</p>
            </div>
            <div className="p-6 overflow-x-auto">
              <div className="flex flex-col items-center min-w-[700px]">
                <StartNode label="1 Day Before Appointment" />
                <Arrow />
                <FNode color="blue">&ldquo;Your appointment is on [date]. Will you attend?  1: Yes  2: No&rdquo;</FNode>
                <Arrow />
                <Diamond>Reply?</Diamond>
                <div className="flex w-full justify-center gap-16 mt-1">
                  <div className="flex flex-col items-center">
                    <BranchLabel>1 — Yes</BranchLabel>
                    <Arrow short />
                    <FNode color="green">&ldquo;Great! See you then.&rdquo;</FNode>
                    <Arrow short />
                    <EndNode />
                  </div>
                  <div className="flex flex-col items-center">
                    <BranchLabel>2 — No</BranchLabel>
                    <Arrow short />
                    <FNode color="amber">&ldquo;Kindly let us know why:&rdquo;<br/>1: Out of town &middot; 2: Too Busy &middot; 3: Still have meds<br/>4: Clinic not friendly &middot; 5: Other</FNode>
                    <Arrow short />
                    <Diamond>Reason?</Diamond>
                    <div className="flex gap-4 mt-1 flex-wrap justify-center">
                      <ReasonBranch label="1 — Out of town" response="Pick medication from any clinic near you." />
                      <div className="flex flex-col items-center">
                        <BranchLabel small>2 — Too Busy</BranchLabel>
                        <Arrow short />
                        <FNode color="amber" small>&ldquo;Can you send someone?  1: Yes  2: No&rdquo;</FNode>
                        <Arrow short />
                        <Diamond small>Reply?</Diamond>
                        <div className="flex gap-4 mt-1">
                          <div className="flex flex-col items-center">
                            <BranchLabel small>Yes</BranchLabel><Arrow short />
                            <FNode color="green" small>&ldquo;Thank you.&rdquo;</FNode><Arrow short /><EndNode />
                          </div>
                          <div className="flex flex-col items-center">
                            <BranchLabel small>No</BranchLabel><Arrow short />
                            <FNode color="rose" small>&ldquo;Please visit clinic ASAP.&rdquo;</FNode><Arrow short /><EndNode />
                          </div>
                        </div>
                      </div>
                      <ReasonBranch label="3 — Still have meds" response="Return before meds run out." />
                      <ReasonBranch label="4 — Clinic not friendly" response="Clinic is improving, please return." />
                      <ReasonBranch label="5 — Other" response="Please visit clinic ASAP." />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── FLOW 2: Missed Appointment (24 hours after) ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
              <h3 className="text-sm font-bold text-amber-900">Flow 2 — Missed Appointment Follow-up</h3>
              <p className="text-[11px] text-amber-700 mt-0.5">Sent 24 hours after a missed appointment &middot; includes reschedule option</p>
            </div>
            <div className="p-6 overflow-x-auto">
              <div className="flex flex-col items-center min-w-[750px]">
                <StartNode label="24 Hours After Missed Appointment" />
                <Arrow />
                <FNode color="amber">&ldquo;You missed your appointment yesterday, kindly let us know why:&rdquo;<br/>1: Out of town &middot; 2: Too Busy &middot; 3: Still have medication<br/>4: Clinic not friendly &middot; 5: Other</FNode>
                <Arrow />
                <Diamond>Response</Diamond>

                <div className="flex gap-4 mt-1 flex-wrap justify-center">
                  {/* 1 — Out of town */}
                  <MissedReasonBranch label="1 — Out of town" response="Pick medication from any clinic near you." />
                  {/* 2 — Too Busy */}
                  <div className="flex flex-col items-center">
                    <BranchLabel small>2 — Too Busy</BranchLabel>
                    <Arrow short />
                    <FNode color="amber" small>&ldquo;Can you send someone?  1: Yes  2: No&rdquo;</FNode>
                    <Arrow short />
                    <Diamond small>Reply?</Diamond>
                    <div className="flex gap-4 mt-1">
                      <div className="flex flex-col items-center">
                        <BranchLabel small>Yes</BranchLabel><Arrow short />
                        <FNode color="green" small>&ldquo;Thank you.&rdquo;</FNode><Arrow short />
                        <RescheduleBlock />
                      </div>
                      <div className="flex flex-col items-center">
                        <BranchLabel small>No</BranchLabel><Arrow short />
                        <FNode color="rose" small>&ldquo;Please visit clinic ASAP.&rdquo;</FNode><Arrow short />
                        <RescheduleBlock />
                      </div>
                    </div>
                  </div>
                  {/* 3 — Still have meds */}
                  <MissedReasonBranch label="3 — Still have meds" response="Return before meds run out." />
                  {/* 4 — Clinic not friendly */}
                  <MissedReasonBranch label="4 — Clinic not friendly" response="Clinic is improving, please return." />
                  {/* 5 — Other */}
                  <MissedReasonBranch label="5 — Other" response="Please visit clinic ASAP." />
                </div>

                {/* Reschedule sub-flow explained */}
                <div className="mt-6 w-full max-w-lg">
                  <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/50">
                    <p className="text-xs font-bold text-indigo-800 mb-2">Reschedule Sub-flow</p>
                    <div className="flex flex-col items-center">
                      <FNode color="blue">&ldquo;Would you like to reschedule? Reply YES or NO&rdquo;</FNode>
                      <Arrow short />
                      <Diamond small>Reply?</Diamond>
                      <div className="flex gap-8 mt-1">
                        <div className="flex flex-col items-center">
                          <BranchLabel small>YES</BranchLabel><Arrow short />
                          <FNode color="blue" small>&ldquo;Reply with your preferred date&rdquo;</FNode><Arrow short />
                          <FNode color="slate" small>Client sends date<br/>(e.g. &ldquo;12 April 2026&rdquo;)</FNode><Arrow short />
                          <FNode color="green" small>&ldquo;Request submitted for [date]. You will receive an SMS once approved.&rdquo;</FNode><Arrow short />
                          <FNode color="slate" small>Request sent to<br/>Provider Dashboard</FNode><Arrow short />
                          <Diamond small>Doctor?</Diamond>
                          <div className="flex gap-6 mt-1">
                            <div className="flex flex-col items-center">
                              <BranchLabel small>Approved</BranchLabel><Arrow short />
                              <FNode color="green" small>&ldquo;Your reschedule for [date] was approved. See you then!&rdquo;</FNode><Arrow short />
                              <EndNode />
                            </div>
                            <div className="flex flex-col items-center">
                              <BranchLabel small>Rejected</BranchLabel><Arrow short />
                              <FNode color="rose" small>&ldquo;Reschedule not approved. Contact clinic for help.&rdquo;</FNode><Arrow short />
                              <EndNode />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <BranchLabel small>NO</BranchLabel><Arrow short />
                          <FNode color="slate" small>&ldquo;Please visit clinic ASAP.&rdquo;</FNode><Arrow short />
                          <EndNode />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Flowchart building-block components ─────────────────────────────── */

const nodeColors: Record<string, string> = {
  blue:  'bg-blue-50 border-blue-300 text-blue-900',
  green: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  amber: 'bg-amber-50 border-amber-300 text-amber-900',
  rose:  'bg-rose-50 border-rose-300 text-rose-900',
  slate: 'bg-gray-50 border-gray-300 text-gray-800',
};

function FNode({ color, small, children }: { color: string; small?: boolean; children: React.ReactNode }) {
  return (
    <div className={`border rounded-lg px-4 py-2 text-center shadow-sm max-w-xs ${small ? 'text-[11px] px-3 py-1.5 max-w-[180px]' : 'text-xs'} ${nodeColors[color] || nodeColors.slate}`}>
      {children}
    </div>
  );
}

function Diamond({ small, children }: { small?: boolean; children: React.ReactNode }) {
  return (
    <div className={`relative flex items-center justify-center ${small ? 'w-20 h-20 my-1' : 'w-28 h-28 my-2'}`}>
      <div className="absolute inset-0 bg-indigo-50 border-2 border-indigo-300 rotate-45 rounded-md shadow-sm" />
      <span className={`relative z-10 font-semibold text-indigo-800 ${small ? 'text-[10px]' : 'text-xs'}`}>{children}</span>
    </div>
  );
}

function Arrow({ short }: { short?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${short ? 'my-1' : 'my-2'}`}>
      <div className={`w-px bg-gray-400 ${short ? 'h-4' : 'h-6'}`} />
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-400" />
    </div>
  );
}

function BranchLabel({ small, children }: { small?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-block bg-gray-100 text-gray-600 font-medium rounded-full mt-2 ${small ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'}`}>
      {children}
    </span>
  );
}

function StartNode({ label }: { label: string }) {
  return (
    <div className="px-6 py-2 rounded-full border-2 border-teal-400 bg-teal-50 text-teal-800 text-xs font-semibold shadow-sm">
      Start &middot; {label}
    </div>
  );
}

function EndNode() {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-gray-400 flex items-center justify-center">
      <div className="w-3 h-3 rounded-full bg-gray-500" />
    </div>
  );
}

function ReasonBranch({ label, response }: { label: string; response: string }) {
  return (
    <div className="flex flex-col items-center">
      <BranchLabel small>{label}</BranchLabel>
      <Arrow short />
      <FNode color="green" small>&ldquo;{response}&rdquo;</FNode>
      <Arrow short />
      <EndNode />
    </div>
  );
}

function MissedReasonBranch({ label, response }: { label: string; response: string }) {
  return (
    <div className="flex flex-col items-center">
      <BranchLabel small>{label}</BranchLabel>
      <Arrow short />
      <FNode color="green" small>&ldquo;{response}&rdquo;</FNode>
      <Arrow short />
      <RescheduleBlock />
    </div>
  );
}

function RescheduleBlock() {
  return (
    <div className="flex flex-col items-center">
      <div className="px-3 py-1 rounded border border-dashed border-indigo-300 bg-indigo-50 text-[10px] text-indigo-700 font-medium">
        &darr; Reschedule sub-flow
      </div>
    </div>
  );
}
