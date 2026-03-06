const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
    // Fixed: Added /api prefix
    const res = await fetch(`${API_BASE_URL}/api/conversations`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async getDocuments() {
    // Fixed: Added /api prefix
    const res = await fetch(`${API_BASE_URL}/api/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/analytics/dashboard-stats`);
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