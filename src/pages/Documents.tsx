import { useEffect, useState, useRef } from 'react';
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { api, Document } from '../lib/api';

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.getDocuments();
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileInputRef.current?.files?.[0] || !uploadTitle) {
      alert('Please select a file and enter a title');
      return;
    }

    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadTitle);

    setUploading(true);

    try {
      const response = await fetch('http://localhost:3001/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
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
        <h2 className="text-2xl font-bold text-green-900 mb-1">Document Library</h2>
        <p className="text-green-600">Upload and manage medical documents for the RAG system</p>
      </div>

      <div className="bg-white rounded-xl border border-green-200 p-6">
        <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload New Document
        </h3>

        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">
              Document Title
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g., Diabetes Treatment Guidelines"
              className="w-full px-4 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">
              Select File (PDF or DOCX)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="w-full px-4 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-green-200 bg-green-50">
          <h3 className="text-lg font-bold text-green-900">Uploaded Documents</h3>
        </div>

        <div className="divide-y divide-green-100">
          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <p className="text-green-600">No documents uploaded yet</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="p-4 hover:bg-green-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-green-900 mb-1">{doc.title}</h4>
                      <p className="text-sm text-green-600 mb-2">{doc.file_name}</p>

                      <div className="flex items-center gap-4 text-sm text-green-500">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(doc.status)}
                          <span className="capitalize">{doc.status}</span>
                        </div>
                        {doc.total_chunks > 0 && (
                          <span>{doc.total_chunks} chunks</span>
                        )}
                        <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
