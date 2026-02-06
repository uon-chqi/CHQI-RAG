import { useEffect, useState } from 'react';
import { MessageSquare, Clock, TrendingUp, Users, FileText, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, Conversation, DashboardStats } from '../lib/api';
import { Badge } from '../components/ui/badge';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todayMessages: 0,
    weekMessages: 0,
    accuracyRate: 0,
    avgResponseTime: 0,
    activePatients: 0,
    docsIndexed: 0,
    totalChunks: 0,
    todayChange: 0,
    weekChange: 0,
    accuracyChange: 0,
    responseChange: 0,
  });
  const [recentMessages, setRecentMessages] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, conversationsData] = await Promise.all([
        api.getDashboardStats(),
        api.getConversations(),
      ]);

      setStats(statsData);
      setRecentMessages(conversationsData.data?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 8) return phone;
    return phone.slice(0, 4) + '*'.repeat(Math.min(phone.length - 8, 6)) + phone.slice(-4);
  };

  const statCards = [
    {
      label: "Today's Messages",
      value: stats.todayMessages.toLocaleString(),
      change: stats.todayChange,
      icon: MessageSquare,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'This Week',
      value: stats.weekMessages.toLocaleString(),
      change: stats.weekChange,
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Accuracy Rate',
      value: `${stats.accuracyRate}%`,
      change: stats.accuracyChange,
      icon: Zap,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Avg Response',
      value: `${(stats.avgResponseTime / 1000).toFixed(1)}s`,
      change: stats.responseChange,
      icon: Clock,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Active Patients',
      value: stats.activePatients.toLocaleString(),
      change: null,
      icon: Users,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Docs Indexed',
      value: stats.docsIndexed.toLocaleString(),
      subtitle: `${stats.totalChunks} chunks`,
      change: null,
      icon: FileText,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-card transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                  <h3 className="text-3xl font-bold text-gray-900">{card.value}</h3>
                  {card.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                  )}
                  {card.change !== null && card.change !== undefined && (
                    <p className={`text-sm mt-2 ${card.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {card.change >= 0 ? '↑' : '↓'} {Math.abs(card.change)}% from yesterday
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Recent Messages</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft"></span>
            <span className="text-sm text-gray-600">Live</span>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {recentMessages.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No messages yet</div>
          ) : (
            recentMessages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {maskPhone(message.patient_phone)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          message.channel === 'sms'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {message.channel === 'sms' ? 'SMS' : 'WhatsApp'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          message.status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : message.status === 'error'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {message.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(message.created_at).toLocaleTimeString()}</span>
                        {message.response_time_ms && (
                          <span className="text-gray-400">• {message.response_time_ms}ms</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 mb-1">{message.message}</p>
                    {message.response && (
                      <p className="text-sm text-gray-600 mt-1">→ {message.response.substring(0, 150)}...</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
