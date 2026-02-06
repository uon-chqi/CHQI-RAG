import { motion } from 'framer-motion';
import { MessageSquare, Clock, Phone } from 'lucide-react';
import { Badge } from './ui/badge';
import { Conversation } from '../lib/api';

interface MessageCardProps {
  message: Conversation;
  index?: number;
}

export function MessageCard({ message, index = 0 }: MessageCardProps) {
  const maskPhone = (phone: string) => {
    if (phone.length < 8) return phone;
    return phone.slice(0, 4) + '*'.repeat(Math.min(phone.length - 8, 6)) + phone.slice(-4);
  };

  const ChannelIcon = message.channel === 'sms' ? Phone : MessageSquare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-card transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <ChannelIcon className="w-5 h-5 text-emerald-600" />
        </div>

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
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              <ChannelIcon className="w-3 h-3 mr-1" />
              {message.channel.toUpperCase()}
            </Badge>
            <Badge
              className={`text-[10px] px-1.5 py-0 ${
                message.status === 'sent'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : message.status === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
              }`}
              variant="outline"
            >
              {message.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
              <Clock className="w-3 h-3" />
              <span>{new Date(message.created_at).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Patient Message:</p>
            <p className="text-sm text-gray-900">{message.message}</p>
          </div>

          {message.response && (
            <div className="bg-emerald-50 rounded-lg p-3 mb-2">
              <p className="text-xs font-medium text-emerald-700 mb-1">AI Response:</p>
              <p className="text-sm text-gray-900">{message.response}</p>
            </div>
          )}

          {message.error_message && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Error:</p>
              <p className="text-sm text-red-900">{message.error_message}</p>
            </div>
          )}

          {message.response_time_ms && (
            <p className="text-xs text-gray-500 mt-2">
              Response time: {message.response_time_ms}ms
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
