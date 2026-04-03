/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Search, Database, Settings, Filter, RefreshCw, Save, Check } from 'lucide-react';
import apiClient from "../../../lib/api-client";
import { useProject } from "../../../contexts/ProjectContext";
import SearchMetricsDisplay from './SearchMetricsDisplay';
import SearchHistoryLog from './SearchHistoryLog';
import StorageMetrics from '../../../components/ui/StorageMetrics';

interface Document {
  id: number;
  project_id: number;
  name: string;
  document_type: string;
  size: number;
  chunk_count?: number;
  indexing_status: 'not_indexed' | 'indexing' | 'ready' | 'failed';
  created_at: string;
  indexed_at?: string;
  metadata?: any;
}

interface SearchResult {
  document_id: number;
  document_name: string;
  chunk_text: string;
  similarity_score: number;
  metadata: any;
  chunk_id?: string;
  chunk_index?: number;
  total_chunks_in_doc?: number;
  chunk_token_count?: number;
  chunk_char_count?: number;
  source_location?: string;
  retrieval_rank?: number;
}

interface SearchMetrics {
  query: string;
  use_hyde: boolean;
  hyde_auto_detected: boolean;
  use_toon: boolean;
  top_k: number;
  retrieval_duration_ms: number;
  query_tokens: number;
  total_context_tokens: number;
  results_count: number;
  avg_similarity_score: number;
  max_similarity_score: number;
  min_similarity_score: number;
}

export default function KnowledgeBaseView() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [indexingDocumentIds, setIndexingDocumentIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [useHyDE, setUseHyDE] = useState(false);
  const [useTOON, setUseTOON] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [searchMetrics, setSearchMetrics] = useState<SearchMetrics | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<SearchMetrics | null>(null);
  const [comparisonResults, setComparisonResults] = useState<SearchResult[]>([]);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [extractArchives, setExtractArchives] = useState(true);
  const [isFolderUpload, setIsFolderUpload] = useState(false);

  // RAG Configuration State
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-large');
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [ragLlmProvider, setRagLlmProvider] = useState('auto');
  const [availableProviders, setAvailableProviders] = useState<{ value: string; label: string }[]>([]);
  const [savingRAGConfig, setSavingRAGConfig] = useState(false);
  const [ragConfigSaveMessage, setRagConfigSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const { activeProjectId } = useProject();
  // Expanded file type support - includes code files, documents, images, and archives
  const SUPPORTED_FILES = '.txt,.md,.pdf,.json,.py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.h,.hpp,.cs,.rb,.go,.rs,.php,.swift,.kt,.scala,.r,.sql,.sh,.bash,.doc,.docx,.html,.htm,.xml,.csv,.yaml,.yml,.zip,.tar,.gz,.tgz,.rar,.7z,.rtf,.odt,.epub,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp';

  useEffect(() => {
    const abortController = new AbortController();

    if (activeProjectId) {
      loadDocuments(abortController.signal);
    }

    return () => {
      abortController.abort();
    };
  }, [selectedStatus, activeProjectId]);

  // Load RAG settings when settings panel is opened
  useEffect(() => {
    if (showSettings) {
      loadRAGSettings();
    }
  }, [showSettings]);

  const loadRAGSettings = async () => {
    try {
      const [settingsRes, providersRes] = await Promise.all([
        apiClient.getSettings(),
        apiClient.getRagLlmProviders(),
      ]);
      const settings = settingsRes.data;
      const remoteProviders: Array<{ value: string; label: string }> = providersRes.data?.providers || [];

      setEmbeddingModel(settings.embedding_model || 'text-embedding-3-large');
      setChunkSize(settings.chunk_size || 1000);
      setChunkOverlap(settings.chunk_overlap || 200);
      setRagLlmProvider(settings.rag_llm_provider || 'auto');
      setAvailableProviders([
        { value: 'auto', label: 'Auto (use first available)' },
        ...remoteProviders,
      ]);
    } catch (error) {
      console.error('Failed to load RAG settings:', error);
    }
  };

  const saveRAGSettings = async () => {
    setSavingRAGConfig(true);
    setRagConfigSaveMessage(null);
    try {
      await apiClient.updateSettings({
        embedding_model: embeddingModel,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        rag_llm_provider: ragLlmProvider,
      });
      setRagConfigSaveMessage({ type: 'success', text: 'RAG Configuration saved successfully!' });
      setTimeout(() => setRagConfigSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save RAG settings:', error);
      setRagConfigSaveMessage({ type: 'error', text: 'Failed to save configuration. Please try again.' });
    } finally {
      setSavingRAGConfig(false);
    }
  };

  const loadDocuments = async (signal?: AbortSignal) => {
    if (!activeProjectId) return;

    try {
      setLoading(true);
      const params: any = { project_id: activeProjectId };
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      const response = await apiClient.listDocuments({ ...params, signal });
      setDocuments(response.data);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        return;
      }
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!activeProjectId) {
      alert('Please select a project first');
      return;
    }
    setUploadFiles(files);
    // Set default name from first file if only one file
    if (files.length === 1) {
      setUploadName(files[0].name);
    } else {
      setUploadName('');
    }
    setShowUploadModal(true);
  };

  const handleFileUpload = async () => {
    if (!uploadFiles || !activeProjectId) return;

    setUploading(true);
    setShowUploadModal(false);
    try {
      const fileArray = Array.from(uploadFiles);
      const hasArchives = fileArray.some(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['zip', 'tar', 'gz', 'tgz', 'rar', '7z'].includes(ext || '');
      });

      // Use bulk upload if multiple files or archives with extraction enabled
      if (fileArray.length > 1 || (hasArchives && extractArchives)) {
        const metadata: any = {};
        if (uploadName) metadata.name = uploadName;
        if (uploadDescription) metadata.description = uploadDescription;
        if (uploadTags) metadata.tags = uploadTags.split(',').map(t => t.trim());

        await apiClient.uploadDocumentsBulk(
          activeProjectId,
          fileArray,
          extractArchives,
          Object.keys(metadata).length > 0 ? metadata : undefined
        );
      } else {
        // Single file upload
        for (let i = 0; i < uploadFiles.length; i++) {
          const file = uploadFiles[i];
          const metadata: any = {};
          if (uploadName) metadata.name = uploadName;
          if (uploadDescription) metadata.description = uploadDescription;
          if (uploadTags) metadata.tags = uploadTags.split(',').map(t => t.trim());
          await apiClient.uploadDocument(activeProjectId, file, Object.keys(metadata).length > 0 ? metadata : undefined);
        }
      }

      await loadDocuments();
      setUploadName('');
      setUploadDescription('');
      setUploadTags('');
      setUploadFiles(null);
      setExtractArchives(true);
      setIsFolderUpload(false);
    } catch (error) {
      console.error('Failed to upload files:', error);
      alert('Failed to upload some files. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await apiClient.deleteDocument(id);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document');
    }
  };

  const handleManualIndex = async (doc: Document) => {
    setIndexingDocumentIds((current) => new Set(current).add(doc.id));

    try {
      await apiClient.indexDocument(doc.id);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to start document indexing:', error);
      alert(`Failed to start indexing for "${doc.name}".`);
    } finally {
      setIndexingDocumentIds((current) => {
        const next = new Set(current);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeProjectId) return;

    try {
      setSearching(true);

      if (compareMode) {

        const response1 = await apiClient.searchDocuments({
          query: searchQuery,
          project_id: activeProjectId,
          top_k: 10,
          use_hyde: useHyDE,
        });
        setSearchResults(response1.data.results);
        setSearchMetrics(response1.data.metrics);

        const response2 = await apiClient.searchDocuments({
          query: searchQuery,
          project_id: activeProjectId,
          top_k: 10,
          use_hyde: useHyDE,
        });
        setComparisonResults(response2.data.results);
        setComparisonMetrics(response2.data.metrics);

      } else {
        const response = await apiClient.searchDocuments({
          query: searchQuery,
          project_id: activeProjectId,
          top_k: 10,
          use_hyde: useHyDE,
        });
        setSearchResults(response.data.results);
        setSearchMetrics(response.data.metrics);
        setComparisonMetrics(null);
        setComparisonResults([]);
      }

      setShowSearchResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. Make sure your project is indexed.');
    } finally {
      setSearching(false);
    }
  };

  const handleRerunFromHistory = (query: string, hyde: boolean, toon: boolean) => {
    setSearchQuery(query);
    setUseHyDE(hyde);
    setUseTOON(toon);
    setTimeout(() => handleSearch(), 100);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchMetrics(null);
    setComparisonMetrics(null);
    setComparisonResults([]);
    setExpandedChunks(new Set());
  };

  const toggleChunkExpansion = (index: number) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChunks(newExpanded);
  };

  const filteredDocuments = documents.filter(doc => {
    if (!doc.name) return false;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalDocuments = documents.length;
  const totalChunks = documents.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0);
  const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
  const readyCount = documents.filter(d => d.indexing_status === 'ready').length;

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'not_indexed': return 'pending';
      case 'indexing': return 'processing';
      case 'ready': return 'ready';
      case 'failed': return 'failed';
      default: return status;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Upload Metadata Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowUploadModal(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Upload {uploadFiles?.length} Document{uploadFiles?.length !== 1 ? 's' : ''}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  Document Name
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Enter document name..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{
                    backgroundColor: 'var(--color-input-background)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description of this document..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  style={{
                    backgroundColor: 'var(--color-input-background)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  Tags (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{
                    backgroundColor: 'var(--color-input-background)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Separate tags with commas
                </p>
              </div>

              {/* Archive Extraction Option */}
              {uploadFiles && Array.from(uploadFiles).some(f => {
                const ext = f.name.split('.').pop()?.toLowerCase();
                return ['zip', 'tar', 'gz', 'tgz', 'rar', '7z'].includes(ext || '');
              }) && (
                <div className="flex items-center gap-2 p-3 bg-status-info/10 rounded-lg border border-status-info/30">
                  <input
                    type="checkbox"
                    id="extract-archives"
                    checked={extractArchives}
                    onChange={(e) => setExtractArchives(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="extract-archives" className="text-sm cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                    Extract and index files from archives
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles(null);
                  setUploadName('');
                  setUploadDescription('');
                  setUploadTags('');
                }}
                className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Knowledge Base
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Manage documents and vector embeddings for RAG-enabled agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDocuments()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted transition-all disabled:opacity-50 border border-border"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted transition-all border border-border"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              RAG Configuration
            </h3>
            {ragConfigSaveMessage && (
              <div className={`flex items-center gap-1.5 text-xs ${ragConfigSaveMessage.type === 'success' ? 'text-status-success' : 'text-status-error'}`}>
                {ragConfigSaveMessage.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 flex items-center justify-center">!</span>}
                <span>{ragConfigSaveMessage.text}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                EMBEDDING MODEL
              </label>
              <select
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ backgroundColor: 'var(--color-input-background)', color: 'var(--color-text-primary)' }}
              >
                <option value="text-embedding-3-large">text-embedding-3-large</option>
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                CHUNK SIZE
              </label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value) || 0)}
                min={100}
                max={10000}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ backgroundColor: 'var(--color-input-background)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                CHUNK OVERLAP
              </label>
              <input
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 0)}
                min={0}
                max={chunkSize - 1}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ backgroundColor: 'var(--color-input-background)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>

          {/* LLM Provider Card (for HyDE) */}
          <div className="mb-4 p-3 rounded-lg border border-yellow-400/40 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  HyDE LLM PROVIDER
                </label>
                <select
                  value={ragLlmProvider}
                  onChange={(e) => setRagLlmProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{ backgroundColor: 'var(--color-input-background)', color: 'var(--color-text-primary)' }}
                >
                  {availableProviders.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              
              <p className="text-xs mt-6 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Used when <strong>HyDE</strong> is enabled for search. Providers are configured in{' '}
                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Settings → API Keys & Providers</span>.
                Only enabled providers appear here.
              </p>
            </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveRAGSettings}
              disabled={savingRAGConfig}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {savingRAGConfig ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex-1 overflow-hidden flex gap-6 p-6">
        {/* Left Column - Documents List (Larger) */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Compact Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-3 transition-all ${isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {uploading ? (
                  <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {uploading ? 'Uploading...' : 'Upload Documents'}
                </h3>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  Drag files here or click to browse
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all cursor-pointer text-sm font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Upload className="w-4 h-4" />
                  <span>Files</span>
                  <input
                    type="file"
                    multiple
                    accept={SUPPORTED_FILES}
                    onChange={(e) => {
                      setIsFolderUpload(false);
                      handleFileSelect(e.target.files);
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-all cursor-pointer text-sm font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Database className="w-4 h-4" />
                  <span>Folder</span>
                  <input
                    type="file"
                    // @ts-ignore - webkitdirectory is not in TS types but works in browsers
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(e) => {
                      setIsFolderUpload(true);
                      handleFileSelect(e.target.files);
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Documents List */}
          <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Documents
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {totalDocuments} total • {readyCount} indexed
                </p>
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ backgroundColor: 'var(--color-input-background)', color: 'var(--color-text-primary)' }}
              >
                <option value="all">All Status</option>
                <option value="ready">Ready</option>
                <option value="indexing">Processing</option>
                <option value="not_indexed">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading documents...</p>
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>No documents found</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {searchQuery ? 'Try adjusting your filter' : 'Upload your first document to get started'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-border-dark">
                {filteredDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium mb-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {doc.name}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {doc.chunk_count || 0} chunks
                          </span>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-muted rounded">
                            {doc.document_type}
                          </span>
                          <span>•</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleManualIndex(doc)}
                          disabled={doc.indexing_status === 'indexing' || indexingDocumentIds.has(doc.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ color: 'var(--color-text-primary)' }}
                          title={doc.indexing_status === 'ready' ? 'Reindex document' : 'Start indexing'}
                        >
                          {doc.indexing_status === 'indexing' || indexingDocumentIds.has(doc.id)
                            ? 'Indexing...'
                            : doc.indexing_status === 'ready'
                              ? 'Reindex'
                              : 'Index'}
                        </button>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${doc.indexing_status === 'ready'
                            ? 'bg-status-success/10 text-status-success'
                            : doc.indexing_status === 'indexing'
                              ? 'bg-status-warning/10 text-status-warning'
                              : doc.indexing_status === 'failed'
                                ? 'bg-status-error/10 text-status-error'
                                : 'bg-muted'
                            }`}
                          style={doc.indexing_status === 'not_indexed' ? { color: 'var(--color-text-muted)' } : {}}
                        >
                          {getStatusDisplay(doc.indexing_status)}
                        </span>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Stats & Search (Narrower) */}
        <div className="w-96 flex-shrink-0 overflow-y-auto space-y-4">
          {/* Stats Cards */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Statistics
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Documents</p>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{totalDocuments}</p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Filter className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Indexed</p>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{readyCount}</p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Chunks</p>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{totalChunks}</p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Storage</p>
                </div>
                <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatFileSize(totalSize)}</p>
              </div>
            </div>
          </div>

          {/* Storage Metrics - Detailed breakdown */}
          {activeProjectId && (
            <StorageMetrics
              projectId={activeProjectId}
              onRefresh={loadDocuments}
            />
          )}

          {/* Compact Search Interface */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Semantic Search
              </h3>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by meaning..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{ backgroundColor: 'var(--color-input-background)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity" style={{ color: 'var(--color-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={useHyDE}
                    onChange={(e) => setUseHyDE(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>HyDE</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity" style={{ color: 'var(--color-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={useTOON}
                    onChange={(e) => setUseTOON(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border text-purple-600 focus:ring-purple-600"
                  />
                  <span>TOON</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity" style={{ color: 'var(--color-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={compareMode}
                    onChange={(e) => setCompareMode(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border text-orange-600 focus:ring-orange-600"
                  />
                  <span>Compare</span>
                </label>
              </div>

              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>

              {showSearchResults && (
                <button
                  onClick={clearSearch}
                  className="w-full px-4 py-2 bg-muted rounded-lg hover:bg-muted transition-all border border-border text-sm font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Clear Results
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          {showSearchResults && (
            <div className="space-y-4">
              {/* Metrics Display */}
              {searchMetrics && (
                <SearchMetricsDisplay
                  metrics={searchMetrics}
                  comparisonMetrics={comparisonMetrics || undefined}
                />
              )}

              {/* Results */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Search Results ({searchResults.length})
                </h3>
                {searchResults.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No results found for "{searchQuery}"
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((result, index) => (
                      <div key={index} className="bg-muted/50 border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-primary">{result.document_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              Similarity: {(result.similarity_score * 100).toFixed(1)}%
                            </span>
                            {result.chunk_token_count && (
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {result.chunk_token_count} tokens
                              </span>
                            )}
                            <button
                              onClick={() => toggleChunkExpansion(index)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              {expandedChunks.has(index) ? 'Hide Details' : 'Show Details'}
                            </button>
                          </div>
                        </div>

                        {expandedChunks.has(index) && (
                          <div className="mb-2 pb-2 border-b border-border text-xs space-y-0.5">
                            {result.chunk_id && (
                              <div>
                                <span style={{ color: 'var(--color-text-muted)' }}>Chunk ID:</span>{' '}
                                <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{result.chunk_id}</span>
                              </div>
                            )}
                            {result.chunk_index !== undefined && (
                              <div>
                                <span style={{ color: 'var(--color-text-muted)' }}>Chunk Index:</span>{' '}
                                <span style={{ color: 'var(--color-text-primary)' }}>
                                  {result.chunk_index} of {result.total_chunks_in_doc || '?'}
                                </span>
                              </div>
                            )}
                            {result.chunk_token_count && (
                              <div>
                                <span style={{ color: 'var(--color-text-muted)' }}>Token Count:</span>{' '}
                                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{result.chunk_token_count} tokens</span>
                              </div>
                            )}
                            {result.chunk_char_count && (
                              <div>
                                <span style={{ color: 'var(--color-text-muted)' }}>Character Count:</span>{' '}
                                <span style={{ color: 'var(--color-text-primary)' }}>{result.chunk_char_count} chars</span>
                              </div>
                            )}
                          </div>
                        )}

                        <pre
                          className="text-xs whitespace-pre-wrap font-mono p-2 rounded overflow-x-auto"
                          style={{
                            backgroundColor: 'var(--color-input-background)',
                            color: 'var(--color-text-primary)'
                          }}
                        >
                          {result.chunk_text}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search History */}
              {activeProjectId && (
                <SearchHistoryLog
                  projectId={activeProjectId}
                  onRerun={handleRerunFromHistory}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
