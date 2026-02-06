import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  error?: string;
  responseTime?: number;
  totalVectors?: number;
}

export default function SystemHealth() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const response = await fetch('http://localhost:3001/api/system/health');
      const data = await response.json();

      if (data.success) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Error checking system health:', error);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Activity className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getServiceName = (name: string) => {
    const names: Record<string, string> = {
      gemini: 'Google Gemini AI',
      vector_db: 'Vector Database (Pinecone)',
      sms: "Africa's Talking SMS",
      whatsapp: 'Twilio WhatsApp',
    };
    return names[name] || name;
  };

  const overallStatus = services.every((s) => s.status === 'healthy')
    ? 'healthy'
    : services.some((s) => s.status === 'down')
    ? 'down'
    : 'degraded';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-900 mb-1">System Health</h2>
          <p className="text-green-600">Monitor the status of all system components</p>
        </div>
        <button
          onClick={checkHealth}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className={`rounded-xl border-2 p-6 ${getStatusColor(overallStatus)}`}>
        <div className="flex items-center gap-3">
          {getStatusIcon(overallStatus)}
          <div>
            <h3 className="text-lg font-bold">Overall System Status</h3>
            <p className="text-sm capitalize">{overallStatus}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <div
            key={service.name}
            className="bg-white rounded-xl border border-green-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(service.status)}
                <div>
                  <h4 className="font-bold text-green-900">{getServiceName(service.name)}</h4>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-1 ${getStatusColor(
                      service.status
                    )}`}
                  >
                    {service.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {service.responseTime && (
                <div className="flex justify-between">
                  <span className="text-green-600">Response Time:</span>
                  <span className="text-green-900 font-medium">{service.responseTime}ms</span>
                </div>
              )}

              {service.totalVectors !== undefined && (
                <div className="flex justify-between">
                  <span className="text-green-600">Total Vectors:</span>
                  <span className="text-green-900 font-medium">{service.totalVectors}</span>
                </div>
              )}

              {service.error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800 font-medium">Error:</p>
                  <p className="text-xs text-red-700 mt-1">{service.error}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-green-200 p-6">
        <h3 className="text-lg font-bold text-green-900 mb-4">System Requirements</h3>
        <div className="space-y-3 text-sm text-green-700">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Gemini API:</strong> Required for embeddings and text generation
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Pinecone:</strong> Vector database for document storage and similarity search
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Africa's Talking:</strong> SMS messaging gateway for patient communications
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Twilio:</strong> WhatsApp messaging integration for patient support
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
