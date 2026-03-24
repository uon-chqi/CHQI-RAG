import axios from 'axios';
import type {
  SmsTemplate,
  SmsTemplateApi,
  Workflow,
  WorkflowTriggerRequest,
  WorkflowTriggerResponse,
} from '../types/sms';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper to get auth token and build headers
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('chqi_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export interface Conversation {
  id: string;
  patient_phone: string;
  channel: 'sms' | 'whatsapp';
  message: string;
  response: string | null;
  citations: any[];
  response_time_ms: number | null;
  status: 'pending' | 'sent' | 'error';
  error_message: string | null;
  session_id: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  total_chunks: number;
  query_count?: number;
  status: 'processing' | 'completed' | 'error';
  metadata: any;
  uploaded_at: string;
  processed_at: string | null;
}

export interface SystemHealth {
  id: string;
  service_name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  last_check: string;
  error_message: string | null;
  response_time_ms: number | null;
}

export interface ChatMessage {
  id: string;
  message: string;
  response?: string;
  timestamp: Date;
  isLoading?: boolean;
  error?: string;
}

export interface DashboardStats {
  todayMessages: number;
  weekMessages: number;
  accuracyRate: number;
  avgResponseTime: number;
  activePatients: number;
  docsIndexed: number;
  totalChunks: number;
  todayChange: number;
  weekChange: number;
  accuracyChange: number;
  responseChange: number;
  totalFacilities: number;
  totalPatients: number;
  riskBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

// Get or create a persistent user ID
function getUserPhone(): string {
  if (typeof window === 'undefined') return 'default-user';
  
  let phone = localStorage.getItem('user_phone');
  if (!phone) {
    // Generate a default phone-like identifier if not set
    phone = `user-${Date.now()}`;
    localStorage.setItem('user_phone', phone);
  }
  return phone;
}

export const api = {
  async getConversations() {
    const res = await fetch(`${API_BASE_URL}/api/conversations`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async getDocuments() {
    const res = await fetch(`${API_BASE_URL}/api/documents`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/analytics/dashboard-stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    const data = await res.json();
    const d = data.data || {};
    return {
      todayMessages: d.todayMessages ?? 0,
      weekMessages: d.weekMessages ?? 0,
      accuracyRate: d.accuracyRate ?? 0,
      avgResponseTime: d.avgResponseTime ?? 0,
      activePatients: d.activePatients ?? 0,
      docsIndexed: d.docsIndexed ?? 0,
      totalChunks: d.totalChunks ?? 0,
      todayChange: d.todayChange ?? 0,
      weekChange: d.weekChange ?? 0,
      accuracyChange: d.accuracyChange ?? 0,
      responseChange: d.responseChange ?? 0,
      totalFacilities: d.totalFacilities ?? 0,
      totalPatients: d.totalPatients ?? 0,
      riskBreakdown: d.riskBreakdown ?? { high: 0, medium: 0, low: 0 },
    };
  },

  async getSystemHealth() {
    // Fixed: Added /api prefix
    const res = await fetch(`${API_BASE_URL}/api/system/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  async sendChatMessage(message: string) {
    const phone = getUserPhone();
    
    if (!message || !message.trim()) {
      throw new Error('Message cannot be empty');
    }

    try {
      // Fixed: Added /api prefix
      const res = await fetch(`${API_BASE_URL}/api/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          phone,
          channel: 'sms'
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        const errorMsg = errorData.message || errorData.error || 'Failed to send message';
        throw new Error(`API Error (${res.status}): ${errorMsg}`);
      }

      return res.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }
      throw new Error('Failed to send message: Unknown error');
    }
  },

  async getChatHistory() {
    const phone = getUserPhone();
    
    try {
      // Fixed: Added /api prefix
      const res = await fetch(
        `${API_BASE_URL}/api/conversations?phone=${encodeURIComponent(phone)}&limit=100`
      );
      
      if (!res.ok) {
        throw new Error('Failed to fetch chat history');
      }
      
      return res.json();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      // Return empty conversations on error instead of crashing
      return { data: [] };
    }
  },

  // Helper function to set custom phone if needed
  setUserPhone(phone: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_phone', phone);
    }
  },

  // ── Patient & Facility APIs ──────────────────────────────

  async getPatients(params: {
    facility_id?: string;
    risk_level?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const searchParams = new URLSearchParams();
    if (params.facility_id) searchParams.set('facility_id', params.facility_id);
    if (params.risk_level) searchParams.set('risk_level', params.risk_level);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE_URL}/api/patients?${searchParams}`);
    if (!res.ok) throw new Error('Failed to fetch patients');
    return res.json();
  },

  async getPatientStats(facilityId?: string) {
    const url = facilityId
      ? `${API_BASE_URL}/api/patients/stats?facility_id=${encodeURIComponent(facilityId)}`
      : `${API_BASE_URL}/api/patients/stats`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch patient stats');
    return res.json();
  },

  async getFacilities() {
    const res = await fetch(`${API_BASE_URL}/api/patients/facilities`);
    if (!res.ok) throw new Error('Failed to fetch facilities');
    return res.json();
  },
};

// ================================================================
// STANDALONE SMS API — NestJS backend (Railway)
// ================================================================

export const smsApi = axios.create({
  baseURL: import.meta.env.VITE_SMS_API_URL || 'https://risebackend-production.up.railway.app',
  headers: { 'Content-Type': 'application/json' },
});

const SMS_TOKEN_STORAGE_KEY = 'chqi_sms_token';
// In development, keep auto-login enabled by default unless explicitly set to false.
const SMS_AUTO_LOGIN = import.meta.env.DEV && import.meta.env.VITE_SMS_AUTO_LOGIN !== 'false';
const SMS_LOGIN_EMAIL = import.meta.env.VITE_SMS_LOGIN_EMAIL || 'ngigid0@gmail.com';
const SMS_LOGIN_PASSWORD = import.meta.env.VITE_SMS_LOGIN_PASSWORD || '123456';

let smsLoginPromise: Promise<string | null> | null = null;

function isPublicSmsEndpoint(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/communications/templates/variables') ||
    url.includes('/communications/templates/preview')
  );
}

function extractSmsToken(payload: unknown): string | null {
  const data = payload as {
    access_token?: string;
    accessToken?: string;
    token?: string;
    data?: { access_token?: string; accessToken?: string; token?: string };
  };

  return (
    data?.data?.access_token ||
    data?.access_token ||
    data?.data?.accessToken ||
    data?.accessToken ||
    data?.data?.token ||
    data?.token ||
    null
  );
}

function mapTemplateFromApi(template: SmsTemplateApi): SmsTemplate {
  return {
    id: template.id,
    facilityId: template.facilityId ?? template.facility_id ?? null,
    name: template.name,
    body: template.body,
    isActive: template.isActive ?? template.is_active ?? true,
    createdAt: template.createdAt ?? template.created_at ?? '',
    updatedAt: template.updatedAt ?? template.updated_at ?? '',
  };
}

function mapTemplatePayloadToApi(data: Partial<SmsTemplate>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (typeof data.name === 'string') payload.name = data.name;
  if (typeof data.body === 'string') payload.body = data.body;

  if ('facilityId' in data) {
    payload.facility_id = data.facilityId ?? null;
  }

  if ('isActive' in data && typeof data.isActive === 'boolean') {
    payload.is_active = data.isActive;
  }

  return payload;
}

// PATCH /sms-templates/:id only accepts name, body, is_active — facility_id is create-only
function mapTemplateUpdatePayloadToApi(data: Partial<SmsTemplate>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (typeof data.name === 'string') payload.name = data.name;
  if (typeof data.body === 'string') payload.body = data.body;

  if ('isActive' in data && typeof data.isActive === 'boolean') {
    payload.is_active = data.isActive;
  }

  return payload;
}

function extractTemplateList(payload: unknown): SmsTemplate[] {
  const source = payload as SmsTemplateApi[] | { data?: SmsTemplateApi[] };
  const list = Array.isArray(source)
    ? source
    : Array.isArray(source?.data)
      ? source.data
      : [];
  return list.map(mapTemplateFromApi);
}

function extractSingleTemplate(payload: unknown): SmsTemplate {
  const source = payload as SmsTemplateApi | { data?: SmsTemplateApi };
  const template = source?.data ?? source;
  return mapTemplateFromApi(template as SmsTemplateApi);
}

async function ensureSmsAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const cached = localStorage.getItem(SMS_TOKEN_STORAGE_KEY);
  if (cached) return cached;

  if (!SMS_AUTO_LOGIN || !SMS_LOGIN_EMAIL || !SMS_LOGIN_PASSWORD) return null;
  if (smsLoginPromise) return smsLoginPromise;

  smsLoginPromise = (async () => {
    try {
      const baseURL = smsApi.defaults.baseURL || 'https://risebackend-production.up.railway.app';
      const res = await axios.post(
        `${baseURL}/auth/login`,
        { email: SMS_LOGIN_EMAIL, password: SMS_LOGIN_PASSWORD },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const token = extractSmsToken(res.data);
      if (token) {
        localStorage.setItem(SMS_TOKEN_STORAGE_KEY, token);
      }
      return token;
    } catch {
      return null;
    } finally {
      smsLoginPromise = null;
    }
  })();

  return smsLoginPromise;
}

// Attach JWT for SMS backend (prefers SMS-specific token)
smsApi.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;

  // These endpoints are public — skip auth header entirely to avoid CORS/preflight issues.
  if (isPublicSmsEndpoint(config.url)) {
    return config;
  }

  if (!config.headers) {
    config.headers = {};
  }

  if (config.headers.Authorization) {
    return config;
  }

  const smsToken = localStorage.getItem(SMS_TOKEN_STORAGE_KEY);
  if (smsToken) {
    config.headers.Authorization = `Bearer ${smsToken}`;
    return config;
  }

  const autoToken = await ensureSmsAuthToken();
  if (autoToken) {
    config.headers.Authorization = `Bearer ${autoToken}`;
    return config;
  }

  // Fallback for existing sessions that only have the app token
  const appToken = localStorage.getItem('chqi_token');
  if (appToken) {
    config.headers.Authorization = `Bearer ${appToken}`;
  }

  return config;
});

// On 401, try one silent re-auth in dev mode and retry once
smsApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as { _smsRetried?: boolean; headers?: Record<string, string> } | undefined;
    const status = error?.response?.status;

    if (!originalRequest || originalRequest._smsRetried || status !== 401 || !SMS_AUTO_LOGIN) {
      return Promise.reject(error);
    }

    originalRequest._smsRetried = true;
    localStorage.removeItem(SMS_TOKEN_STORAGE_KEY);

    const freshToken = await ensureSmsAuthToken();
    if (!freshToken) {
      return Promise.reject(error);
    }

    originalRequest.headers = {
      ...(originalRequest.headers || {}),
      Authorization: `Bearer ${freshToken}`,
    };

    return smsApi(originalRequest);
  }
);

// ── SMS Services ────────────────────────────────────────────────

export const smsServices = {
  // --- Template Variables (for building template bodies) ---
  getTemplateVariables: () =>
    smsApi.get('/communications/templates/variables').then((r) => r.data),

  previewTemplate: (template: string) =>
    smsApi.post('/communications/templates/preview', { template }).then((r) => r.data),

  // --- Template CRUD ---
  getTemplates: (facilityId?: string) =>
    smsApi
      .get('/sms-templates', { params: facilityId ? { facility_id: facilityId } : {} })
      .then((r) => extractTemplateList(r.data)),

  getTemplateById: (id: string) =>
    smsApi.get(`/sms-templates/${id}`).then((r) => extractSingleTemplate(r.data)),

  createTemplate: (data: Partial<SmsTemplate>) =>
    smsApi
      .post('/sms-templates', mapTemplatePayloadToApi(data))
      .then((r) => extractSingleTemplate(r.data)),

  updateTemplate: (id: string, data: Partial<SmsTemplate>) =>
    smsApi
      .patch(`/sms-templates/${id}`, mapTemplateUpdatePayloadToApi(data))
      .then((r) => extractSingleTemplate(r.data)),

  deleteTemplate: (id: string) =>
    smsApi.delete(`/sms-templates/${id}`).then((r) => r.data),

  // --- Workflow Discovery (toolbox config endpoints) ---
  getWorkflowTriggers: () =>
    smsApi.get('/communications/workflows/config/triggers').then((r) => r.data),

  getWorkflowActions: () =>
    smsApi.get('/communications/workflows/config/actions').then((r) => r.data),

  getSystemModules: () =>
    smsApi.get('/communications/workflows/config/system-modules').then((r) => r.data),

  // --- Workflow CRUD ---
  getWorkflows: (facilityId?: string) =>
    smsApi
      .get('/communications/workflows', { params: facilityId ? { facilityId } : {} })
      .then((r) => r.data),

  getWorkflowById: (id: string) =>
    smsApi.get(`/communications/workflows/${id}`).then((r) => r.data),

  createWorkflow: (data: Partial<Workflow>) =>
    smsApi.post('/communications/workflows', data).then((r) => r.data),

  updateWorkflow: (id: string, data: Partial<Workflow>) =>
    smsApi.patch(`/communications/workflows/${id}`, data).then((r) => r.data),

  triggerWorkflow: (id: string, data: WorkflowTriggerRequest) =>
    smsApi.post(`/communications/workflows/${id}/trigger`, data).then((r) => r.data as WorkflowTriggerResponse),

  deleteWorkflow: (id: string) =>
    smsApi.delete(`/communications/workflows/${id}`).then((r) => r.data),
};