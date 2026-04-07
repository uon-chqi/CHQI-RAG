import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { smsServices } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import type { SmsTemplate, SmsTemplateVariable } from '../../../types/sms';

interface PreviewResult {
  preview: string;
  characterCount: number;
  isOverLimit: boolean;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  existingTemplate?: SmsTemplate | null;
}

const DEFAULT_TEMPLATE_VARIABLES: SmsTemplateVariable[] = [
  {
    key: 'patient_first_name',
    tag: '{{patient_first_name}}',
    description: "Patient's given name",
    example: 'Jane',
  },
  {
    key: 'patient_last_name',
    tag: '{{patient_last_name}}',
    description: "Patient's family name",
    example: 'Doe',
  },
  {
    key: 'patient_phone',
    tag: '{{patient_phone}}',
    description: "Patient's registered phone number",
    example: '+254712345678',
  },
  {
    key: 'appointment_date',
    tag: '{{appointment_date}}',
    description: 'Scheduled date of the appointment',
    example: 'Monday 25 March 2026',
  },
  {
    key: 'appointment_time',
    tag: '{{appointment_time}}',
    description: 'Scheduled time block for the appointment',
    example: '9:00 AM',
  },
  {
    key: 'appointment_location',
    tag: '{{appointment_location}}',
    description: 'Name or room of the appointment location within the facility',
    example: 'Room 3, Outpatient Wing',
  },
  {
    key: 'visit_type',
    tag: '{{visit_type}}',
    description: 'Type of clinical visit',
    example: 'Clinical Review',
  },
  {
    key: 'facility_name',
    tag: '{{facility_name}}',
    description: 'Full name of the health facility',
    example: 'Makueni County Referral Hospital',
  },
  {
    key: 'clinic_contact',
    tag: '{{clinic_contact}}',
    description: "Clinic's contact phone number for patient inquiries",
    example: '+254700000000',
  },
  {
    key: 'staff_name',
    tag: '{{staff_name}}',
    description: 'Full name of the care provider or CHV sending the message',
    example: 'Dr. Amina Wanjiku',
  },
  {
    key: 'staff_role',
    tag: '{{staff_role}}',
    description: "Provider's role title",
    example: 'Clinical Officer',
  },
  {
    key: 'reply_confirm',
    tag: '{{reply_confirm}}',
    description: 'Instruction for patient to confirm attendance by SMS reply',
    example: 'Reply YES to confirm',
  },
  {
    key: 'reply_cancel',
    tag: '{{reply_cancel}}',
    description: 'Instruction for patient to cancel attendance by SMS reply',
    example: 'Reply NO to cancel',
  },
  {
    key: 'follow_up_instructions',
    tag: '{{follow_up_instructions}}',
    description: 'Pre-visit instructions the patient should follow before attending',
    example: 'Please fast for 8 hours before your appointment.',
  },
  {
    key: 'reschedule_link',
    tag: '{{reschedule_link}}',
    description: 'Short URL for patient to request a reschedule online',
    example: 'risechq.org/reschedule/abc123',
  },
];

function normalizeVariablesPayload(payload: unknown): SmsTemplateVariable[] {
  const source = payload as
    | SmsTemplateVariable[]
    | { data?: SmsTemplateVariable[] }
    | { variables?: SmsTemplateVariable[] };

  const list = Array.isArray(source)
    ? source
    : Array.isArray(source?.data)
      ? source.data
      : Array.isArray(source?.variables)
        ? source.variables
        : [];

  return list.filter((item) => !!item?.key && !!item?.tag);
}

function normalizePreviewPayload(payload: unknown): PreviewResult | null {
  const source = payload as
    | PreviewResult
    | { data?: PreviewResult }
    | { result?: PreviewResult };

  const candidate = source?.data || source?.result || source;
  if (
    candidate &&
    typeof candidate.preview === 'string' &&
    typeof candidate.characterCount === 'number' &&
    typeof candidate.isOverLimit === 'boolean'
  ) {
    return candidate;
  }
  return null;
}

export default function TemplateModal({
  isOpen,
  onClose,
  onSave,
  existingTemplate,
}: TemplateModalProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [bodySwahili, setBodySwahili] = useState('');
  const [originalBodySwahili, setOriginalBodySwahili] = useState<string | null>(null);
  const [isUniversal, setIsUniversal] = useState(false);

  const [variables, setVariables] = useState<SmsTemplateVariable[]>([]);
  const [variablesSource, setVariablesSource] = useState<'backend' | 'fallback'>('backend');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isLoadingVars, setIsLoadingVars] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Initialise form on open ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (existingTemplate) {
      setName(existingTemplate.name);
      setBody(existingTemplate.body);
      setBodySwahili(existingTemplate.bodySwahili || '');
      setOriginalBodySwahili(existingTemplate.bodySwahili ?? null);
      setIsUniversal(existingTemplate.facilityId === null);
    } else {
      setName('');
      setBody('');
      setBodySwahili('');
      setOriginalBodySwahili(null);
      setIsUniversal(false);
      setPreview(null);
    }
    setError(null);
    loadVariables();
  }, [isOpen, existingTemplate]);

  // ── Debounced preview ────────────────────────────────────────
  useEffect(() => {
    if (!body.trim()) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await smsServices.previewTemplate(body);
        const normalized = normalizePreviewPayload(res);
        if (normalized) {
          setPreview(normalized);
          setPreviewError(null);
        } else {
          setPreview(null);
          setPreviewError('Preview response format was invalid.');
        }
      } catch {
        setPreview(null);
        setPreviewError('Live preview is temporarily unavailable.');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [body]);

  const loadVariables = async () => {
    setIsLoadingVars(true);
    try {
      const res = await smsServices.getTemplateVariables();
      const normalized = normalizeVariablesPayload(res);
      if (normalized.length > 0) {
        setVariables(normalized);
        setVariablesSource('backend');
      } else {
        setVariables(DEFAULT_TEMPLATE_VARIABLES);
        setVariablesSource('fallback');
      }
    } catch {
      setVariables(DEFAULT_TEMPLATE_VARIABLES);
      setVariablesSource('fallback');
      setError('Failed to load template variables from backend. Using default variable set.');
    } finally {
      setIsLoadingVars(false);
    }
  };

  // ── Insert tag at cursor position ────────────────────────────
  const insertVariable = (tag: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const updated = body.substring(0, start) + tag + body.substring(end);
      setBody(updated);
      // Restore focus & advance cursor past the inserted tag
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setBody((prev) => prev + tag);
    }
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      // super_admin can make a template universal (facilityId = null)
      // all other users always attach their own facility
      const facilityId = isSuperAdmin && isUniversal ? null : (user?.facility_id ?? null);

      const normalizedBodySwahili = bodySwahili.trim();
      const payload: {
        name: string;
        body: string;
        facilityId: string | null;
        bodySwahili?: string | null;
        isBilingual?: boolean;
      } = {
        name: name.trim(),
        body: body.trim(),
        facilityId,
      };

      if (!existingTemplate || normalizedBodySwahili !== (originalBodySwahili ?? '').trim()) {
        payload.bodySwahili = normalizedBodySwahili || null;
      }

      if (normalizedBodySwahili) {
        payload.isBilingual = true;
      }

      if (existingTemplate) {
        await smsServices.updateTemplate(existingTemplate.id, payload, {
          bodySwahili: originalBodySwahili,
          isBilingual: existingTemplate.isBilingual,
        });
      } else {
        await smsServices.createTemplate(payload);
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save template. Please check for invalid variable tags.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const charCount = preview?.characterCount ?? body.length;
  const overLimit = preview?.isOverLimit ?? body.length > 160;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">
            {existingTemplate ? 'Edit Template' : 'New SMS Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col md:flex-row gap-6">

          {/* LEFT: Editor form */}
          <form
            id="template-form"
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col gap-4 min-w-0"
          >
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 1-Day Appointment Reminder"
                required
              />
            </div>

            {/* Universal toggle — only for super_admin */}
            {isSuperAdmin && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUniversal}
                  onChange={(e) => setIsUniversal(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Universal — available to all facilities
                </span>
              </label>
            )}

            {/* Variable chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Insert Variable
              </label>
              <p className="text-[11px] text-gray-400 mb-1">
                Source: {variablesSource === 'backend' ? 'Backend API' : 'Fallback set'}
              </p>
              {isLoadingVars ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : variables.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {variables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.tag)}
                      title={`${v.description} — e.g. "${v.example}"`}
                      className="px-2.5 py-1 text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No variables available.</p>
              )}
            </div>

            {/* Message body */}
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message Body (English)
              </label>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message here or click a variable above to insert it..."
                required
                className="flex-1 min-h-[120px] w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400"
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message Body (Swahili, Optional)
              </label>
              <textarea
                value={bodySwahili}
                onChange={(e) => setBodySwahili(e.target.value)}
                placeholder="Optional Swahili translation. If left empty, English body is used as fallback."
                className="flex-1 min-h-[120px] w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Swahili patient + no translation = English fallback SMS.
              </p>
            </div>
          </form>

          {/* RIGHT: Live preview */}
          <div className="w-full md:w-72 shrink-0 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Live Preview</h3>
            <div className="flex-1 min-h-[180px] bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 break-words whitespace-pre-wrap">
              {preview?.preview ? (
                preview.preview
              ) : (
                <span className="text-gray-400 italic text-xs">
                  Preview appears here as you type…
                </span>
              )}
            </div>

            {previewError && (
              <p className="text-[11px] text-amber-600 px-1">{previewError}</p>
            )}

            {/* Character counter */}
            <div
              className={`text-xs font-medium flex items-center justify-between px-1 ${
                overLimit ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              <span>{charCount} / 160 chars</span>
              {overLimit && (
                <span className="text-red-500 font-semibold">Multi-part SMS</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="template-form"
            disabled={isSaving || !name.trim() || !body.trim()}
          >
            {isSaving && <Loader2 size={14} className="animate-spin mr-2" />}
            {existingTemplate ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}
