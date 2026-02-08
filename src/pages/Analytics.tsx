import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface TopicData {
  topic: string;
  count: number;
}

interface ChannelData {
  name: string;
  value: number;
  color: string;
}

export default function Analytics() {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [topicsRes, channelRes] = await Promise.all([
        fetch('http://localhost:5000/api/analytics/topics'),
        fetch('http://localhost:5000/api/analytics/channel-stats'),
      ]);

      const topicsData = await topicsRes.json();
      const channelData = await channelRes.json();

      setTopics(topicsData.data || []);
      setChannelStats([
        { name: 'SMS', value: channelData.data.sms, color: '#3b82f6' },
        { name: 'WhatsApp', value: channelData.data.whatsapp, color: '#16a34a' },
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-green-900 mb-1">Analytics Dashboard</h2>
        <p className="text-green-600">Insights and trends from patient interactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-green-200 p-6">
          <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top Medical Topics
          </h3>

          {topics.length === 0 ? (
            <div className="py-12 text-center text-green-600">
              No data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#bbf7d0" />
                <XAxis dataKey="topic" stroke="#166534" />
                <YAxis stroke="#166534" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="#16a34a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-green-200 p-6">
          <h3 className="text-lg font-bold text-green-900 mb-4">Channel Distribution</h3>

          {channelStats.reduce((sum, stat) => sum + stat.value, 0) === 0 ? (
            <div className="py-12 text-center text-green-600">
              No data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={channelStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-green-200 p-6">
        <h3 className="text-lg font-bold text-green-900 mb-4">Query Breakdown</h3>
        <div className="space-y-3">
          {topics.slice(0, 5).map((topic, index) => {
            const maxCount = Math.max(...topics.map((t) => t.count));
            const percentage = (topic.count / maxCount) * 100;

            return (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-green-900 capitalize">
                    {topic.topic}
                  </span>
                  <span className="text-sm text-green-600">{topic.count} queries</span>
                </div>
                <div className="w-full bg-green-100 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
