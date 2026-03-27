import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Globe, Building, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { smsServices } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { SmsTemplate } from '../../types/sms';
import TemplateModal from './components/TemplateModal';

export default function SmsTemplates() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);

  // ── Load templates ───────────────────────────────────────────
  const fetchTemplates = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      // super_admin sees all templates; facility users see only their own + universal
      const facilityId = isSuperAdmin ? undefined : user?.facility_id;
      const list = await smsServices.getTemplates(facilityId);
      setTemplates(Array.isArray(list) ? list : []);
    } catch {
      setTemplates([]);
      setFetchError('Failed to load templates. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async (template: SmsTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    try {
      await smsServices.deleteTemplate(template.id);
      fetchTemplates();
    } catch {
      alert('Failed to delete template. Please try again.');
    }
  };

  // ── Modal helpers ────────────────────────────────────────────
  const openNewModal = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const openEditModal = (template: SmsTemplate) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage reusable message templates for your automated workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates}
            disabled={isLoading}
            aria-label="Refresh templates"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={openNewModal} className="flex items-center gap-2">
            <Plus size={16} />
            New Template
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20 text-gray-400">
            <Loader2 className="animate-spin w-7 h-7" />
          </div>
        ) : fetchError ? (
          <div className="py-16 text-center text-red-500 text-sm">{fetchError}</div>
        ) : templates.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-gray-500 text-sm">No templates found.</p>
            <Button variant="outline" onClick={openNewModal} className="inline-flex items-center gap-2">
              <Plus size={15} /> Create your first template
            </Button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Message Preview</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900 text-sm">
                    {template.name}
                  </td>
                  <td className="px-5 py-3.5">
                    {template.facilityId === null ? (
                      <Badge className="flex items-center gap-1 w-max bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold">
                        <Globe size={12} /> Universal
                      </Badge>
                    ) : (
                      <Badge className="flex items-center gap-1 w-max bg-amber-100 text-amber-900 border-amber-300 font-semibold">
                        <Building size={12} /> Facility
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 max-w-xs">
                    <span className="line-clamp-1 block truncate">{template.body}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(template)}
                        aria-label="Edit template"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:border-red-300"
                        onClick={() => handleDelete(template)}
                        aria-label="Delete template"
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

      {/* Count footer */}
      {!isLoading && !fetchError && templates.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modal */}
      <TemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchTemplates}
        existingTemplate={editingTemplate}
      />
    </div>
  );
}

