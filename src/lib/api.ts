const API_BASE_URL = 'https://chqi-rag.onrender.com/api';

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
}

export const api = {
  async getConversations() {
    const res = await fetch(`${API_BASE_URL}/conversations`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async getDocuments() {
    const res = await fetch(`${API_BASE_URL}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/analytics/dashboard-stats`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    const data = await res.json();
    return data.data;
  },

  async getSystemHealth() {
    const res = await fetch(`${API_BASE_URL}/system/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  async sendChatMessage(message: string) {
    const res = await fetch(`${API_BASE_URL}/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        phone: 'web-user',
        channel: 'sms'
      }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  async getChatHistory() {
    const res = await fetch(`${API_BASE_URL}/conversations?phone=web-user&limit=100`);
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return res.json();
  },
};
