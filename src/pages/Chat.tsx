import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Bot, Clock, Loader2 } from 'lucide-react';
import { api, ChatMessage } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history from database on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setError(null);
      const response = await api.getChatHistory();
      const conversations = response.data || [];

      // Convert DB conversations to chat messages (oldest first)
      const history: ChatMessage[] = [];
      const sorted = [...conversations].sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      for (const conv of sorted) {
        // Add user message
        history.push({
          id: `user-${conv.id}`,
          message: conv.message,
          timestamp: new Date(conv.created_at),
          isLoading: false,
        });

        // Add bot response if exists
        if (conv.response) {
          history.push({
            id: `bot-${conv.id}`,
            message: '',
            response: conv.response,
            timestamp: new Date(conv.created_at),
            isLoading: false,
          });
        }
      }

      setMessages(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Failed to load chat history. Starting fresh.');
      // Don't crash, just start with empty messages
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      message: messageText,
      timestamp: new Date(),
      isLoading: false,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Add loading message for bot response
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      message: '',
      response: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Fixed: Pass only the message, phone parameter is now handled in api.ts
      const response = await api.sendChatMessage(messageText);
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id 
          ? { 
              ...msg, 
              response: response.data?.response || 'I apologize, but I couldn\'t generate a response.',
              isLoading: false 
            }
          : msg
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred. Please try again.';
      
      setError(errorMessage);
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id 
          ? { 
              ...msg, 
              response: `Sorry, I encountered an error: ${errorMessage}`,
              isLoading: false,
              error: errorMessage
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group messages by date for date separators
  const getDateLabel = (index: number): string | null => {
    if (index === 0) return formatDate(messages[0].timestamp);
    const prevDate = messages[index - 1].timestamp.toDateString();
    const currDate = messages[index].timestamp.toDateString();
    if (prevDate !== currDate) return formatDate(messages[index].timestamp);
    return null;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-xl border border-green-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-green-200 bg-green-50">
        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-green-900">Healthcare RAG Assistant</h2>
          <p className="text-sm text-green-600">Ask me anything about medical topics</p>
        </div>
        <div className="text-xs text-green-500">
          {messages.filter(m => m.message && !m.response).length} messages
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-3" />
            <p className="text-green-600">Loading conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Start a Conversation
            </h3>
            <p className="text-green-600 max-w-sm">
              Ask anything about healthcare, medications, symptoms, or medical procedures. 
              I'll provide evidence-based information to help you.
            </p>
            <div className="mt-6 space-y-2 text-sm text-green-500">
              <p>Try asking:</p>
              <p>&quot;What are the side effects of HIV drugs?&quot;</p>
              <p>&quot;How to manage diabetes?&quot;</p>
              <p>&quot;What is hypertension?&quot;</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = !!msg.message && !msg.response;
            const isBot = !!msg.response;
            const dateLabel = getDateLabel(index);

            return (
              <div key={msg.id}>
                {/* Date Separator */}
                {dateLabel && (
                  <div className="flex items-center justify-center my-3">
                    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
                      {dateLabel}
                    </span>
                  </div>
                )}

                {/* User Message */}
                {isUser && (
                  <div className="flex justify-end">
                    <div className="max-w-[70%] bg-green-600 text-white rounded-lg rounded-tr-sm px-4 py-2">
                      <p className="break-words">{msg.message}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <Clock className="w-3 h-3 opacity-70" />
                        <span className="text-xs opacity-70">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bot Response */}
                {isBot && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-2 max-w-[80%]">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-green-600" />
                      </div>
                      <div className={`${msg.error ? 'bg-red-50' : 'bg-gray-100'} rounded-lg rounded-tl-sm px-4 py-2`}>
                        {msg.isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }}></div>
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                            </div>
                            <span className="text-sm text-gray-600">Thinking...</span>
                          </div>
                        ) : (
                          <>
                            <p className={`break-words whitespace-pre-wrap ${msg.error ? 'text-red-700' : 'text-gray-700'}`}>
                              {msg.response}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {formatTime(msg.timestamp)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-green-200 p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your medical question..."
              className="min-h-[44px] max-h-32 resize-none border-green-200 focus:ring-green-600 focus:border-green-600"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-green-600 hover:bg-green-700 text-white p-3 h-11 w-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          This is for demonstration purposes. Always consult healthcare professionals for medical advice.
        </div>
      </div>
    </div>
  );
}