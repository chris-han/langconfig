/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Settings,
  Shield,
  Zap,
  Cpu,
  Save,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Copy,
  Plus,
  ArrowRight,
  Code,
  Globe,
  Database,
  Search,
  BookOpen,
  GitBranch,
  Layers3,
  Bot
} from 'lucide-react';
import apiClient from '../../../lib/api-client';
import { getModelDisplayName } from '../../../lib/modelDisplayNames';
import CustomToolBuilder from '../../tools/ui/CustomToolBuilder';
import ContextPreviewModal from '../../../components/workflows/ContextPreviewModal';

interface NodeConfigPanelProps {
  selectedNode: {
    id: string;
    name: string;
    agentType: string;
    model?: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    max_retries?: number;
    recursion_limit?: number;
    tools?: string[];
    native_tools?: string[];
    custom_tools?: string[];
    middleware?: any[];
    condition?: string;
    max_iterations?: number;
    exit_condition?: string;
    // DeepAgent fields
    subagents?: any[];
    use_deepagents?: boolean;
    // Skills
    skills?: string[];
    enable_skills?: boolean;
    // Tool Node specifics
    tool_type?: string;
    tool_id?: string;
  };
  onClose: () => void;
  onSave: (nodeId: string, config: any) => void;
  onDelete: (nodeId: string) => void;
  tokenCostInfo?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_cost: number;
  };
}

interface Skill {
  skill_id: string;
  name: string;
  description: string;
  category: string;
}

const NodeConfigPanel = ({
  selectedNode,
  onClose,
  onSave,
  onDelete,
  tokenCostInfo
}: NodeConfigPanelProps) => {
  const [agentName, setAgentName] = useState(selectedNode.name);
  const [config, setConfig] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [availableCustomTools, setAvailableCustomTools] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<any[]>([]);
  const [showToolConfigModal, setShowToolConfigModal] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  // DeepAgent context preview state
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [selectedDeepAgentId, setSelectedDeepAgentId] = useState<string | null>(null);
  const [contextMode, setContextMode] = useState<'standard' | 'rag' | 'long_term_memory'>('standard');
  const [contextWindowSize, setContextWindowSize] = useState(4000);

  // State for collapsible sections
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const [skillsCollapsed] = useState(true); // Default collapsed
  const [middlewareCollapsed] = useState(true); // Default collapsed
  const [subagentsCollapsed] = useState(false);
  const [advancedCollapsed] = useState(true);

  // Local state for complex config items
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [enabledMiddleware, setEnabledMiddleware] = useState<string[]>([]);
  const [customGuardrails, setCustomGuardrails] = useState<string | null>(null);
  const [defaultGuardrails, setDefaultGuardrails] = useState('');
  const [guardrailsDescription, setGuardrailsDescription] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Tool Node specific state
  const [toolNodeAvailableTools, setToolNodeAvailableTools] = useState<{ custom: any[], mcp: any[], cli: any[] }>({ custom: [], mcp: [], cli: [] });
  const [toolSchema, setToolSchema] = useState<any>(null);
  const [loadingToolSchema, setLoadingToolSchema] = useState(false);

  // Initialize config from selectedNode
  useEffect(() => {
    if (selectedNode) {
      setAgentName(selectedNode.name);
      setConfig({ ...selectedNode });

      // Initialize local arrays
      setSelectedSkills(selectedNode.skills || []);
      const middlewareTypes = (selectedNode.middleware || [])
        .filter((m: any) => m.enabled !== false)
        .map((m: any) => m.type);
      setEnabledMiddleware(middlewareTypes);

      // DeepAgent context preview setup
      if (selectedNode.use_deepagents) {
        setSelectedDeepAgentId(selectedNode.id);
      } else {
        setSelectedDeepAgentId(null);
      }
    }
  }, [selectedNode]);

  // Fetch available schemas and tools
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCustomTools = async (signal: AbortSignal) => {
      try {
        const response = await apiClient.listCustomTools();
        setAvailableCustomTools(response.data || []);
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) return;
        console.error('Failed to fetch custom tools:', error);
      }
    };

    const fetchSkills = async (signal: AbortSignal) => {
      try {
        const response = await apiClient.apiFetch(`${apiClient.baseURL}/api/skills/`, { signal });
        setAvailableSkills(response || []);
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) return;
        console.error('Failed to fetch skills:', error);
      }
    };

    const fetchWorkflows = async () => {
      try {
        const response = await apiClient.apiFetch(`${apiClient.baseURL}/api/workflows/`);
        setAvailableWorkflows(response || []);
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
      }
    };

    const fetchDefaultGuardrails = async () => {
      try {
        const response = await apiClient.apiFetch(`${apiClient.baseURL}/api/settings/default-guardrails`, { signal: abortController.signal });
        setDefaultGuardrails(response?.guardrails || '');
        setGuardrailsDescription(response?.description || '');
      } catch (error) {
        console.error('Failed to fetch default guardrails:', error);
      }
    };

    fetchCustomTools(abortController.signal);
    fetchSkills(abortController.signal);
    fetchWorkflows();
    fetchDefaultGuardrails();

    return () => {
      abortController.abort();
    };
  }, []);

  // Fetch available tools for Tool Node
  useEffect(() => {
    const abortController = new AbortController();

    const fetchToolNodeTools = async () => {
      try {
        // Fetch custom tools
        const customToolsRes = await apiClient.listCustomTools();
        const customTools = customToolsRes.data || [];

        // MCP tools - placeholder
        const mcpTools = [
          { tool_id: 'read_file', name: 'Read File', description: 'Read content from a file' },
          { tool_id: 'write_file', name: 'Write File', description: 'Write content to a file' },
          { tool_id: 'ls', name: 'List Files', description: 'List files in a directory' },
          { tool_id: 'grep', name: 'Grep', description: 'Search file contents with regex' }
        ];

        setToolNodeAvailableTools({ custom: customTools, mcp: mcpTools, cli: [] });
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
          return;
        }
        console.error('Failed to fetch tools:', error);
      }
    };

    fetchToolNodeTools();

    return () => {
      abortController.abort();
    };
  }, []);

  // Tool schema loading helper
  const loadToolSchema = async (type: string, id: string) => {
    setLoadingToolSchema(true);
    try {
      if (type === 'custom') {
        const tool = availableCustomTools.find(t => t.tool_id === id);
        setToolSchema(tool?.schema || null);
      } else {
        // MCP/CLI schemas - placeholder
        setToolSchema(null);
      }
    } catch (err) {
      console.error('Error loading tool schema:', err);
    } finally {
      setLoadingToolSchema(false);
    }
  };

  useEffect(() => {
    if (selectedNode?.agentType === 'TOOL_NODE' && selectedNode.tool_type && selectedNode.tool_id && availableCustomTools.length > 0) {
      loadToolSchema(selectedNode.tool_type, selectedNode.tool_id);
    }
  }, [selectedNode?.tool_id, availableCustomTools.length]);

  if (!selectedNode || !config) {
    return (
      <div className="w-96 bg-sidebar border-l border-sidebar-border flex items-center justify-center">
        <div className="text-center px-6">
          <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-5xl mb-3 block">
            radio_button_unchecked
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a node to configure
          </p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (config) {
      setSaveStatus('saving');
      // Prepare final config with local overrides
      const finalConfig = {
        ...config,
        name: agentName,
        skills: selectedSkills,
        // Update middleware based on enabled types
        middleware: (config.middleware || []).map((m: any) => ({
          ...m,
          enabled: enabledMiddleware.includes(m.type)
        }))
      };

      onSave(config.id, finalConfig);
      setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 500);
    }
  };

  // Helper to update specific fields in config
  const updateConfig = (updates: any) => {
    setConfig((prev: any) => ({ ...prev, ...updates }));
    // Auto-save logic if needed
  };

  const toggleNativeTool = (toolId: string) => {
    const currentTools = config.native_tools || [];
    const newTools = currentTools.includes(toolId)
      ? currentTools.filter((id: string) => id !== toolId)
      : [...currentTools, toolId];
    updateConfig({ native_tools: newTools });
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const toggleMiddleware = (type: string) => {
    setEnabledMiddleware(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <>
      <div className="w-96 bg-sidebar border-l border-sidebar-border flex flex-col overflow-visible relative" style={{ zIndex: 100000 }}>
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="flex-1 bg-transparent border-none text-lg font-bold focus:ring-0 p-0"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-sidebar-accent rounded transition-colors">
              <X className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {config.agentType}
            </span>
            {config.model && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                {getModelDisplayName(config.model)}
              </span>
            )}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* System Prompt — agent nodes only */}
          {!['START_NODE', 'END_NODE', 'CONDITIONAL_NODE', 'TOOL_NODE'].includes(config.agentType) && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                System Prompt
              </label>
              <textarea
                value={config.system_prompt || ''}
                onChange={(e) => updateConfig({ system_prompt: e.target.value })}
                placeholder="You are a helpful AI assistant..."
                rows={6}
                className="w-full text-sm bg-muted border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
              />
            </div>
          )}

          {/* Condition — CONDITIONAL nodes */}
          {config.agentType === 'CONDITIONAL_NODE' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Condition Expression
              </label>
              <textarea
                value={config.condition || ''}
                onChange={(e) => updateConfig({ condition: e.target.value })}
                placeholder="state.get('approved') == True"
                rows={3}
                className="w-full text-sm bg-muted border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 font-mono"
              />
              <div className="mt-2 space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max Iterations</label>
                  <input
                    type="number"
                    value={config.max_iterations ?? 10}
                    onChange={(e) => updateConfig({ max_iterations: parseInt(e.target.value) || 10 })}
                    min={1}
                    max={100}
                    className="w-full text-sm bg-muted border border-border rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Exit Condition</label>
                  <input
                    type="text"
                    value={config.exit_condition || ''}
                    onChange={(e) => updateConfig({ exit_condition: e.target.value })}
                    placeholder="done"
                    className="w-full text-sm bg-muted border border-border rounded-md px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Temperature + Max Tokens — agent nodes */}
          {!['START_NODE', 'END_NODE', 'TOOL_NODE'].includes(config.agentType) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Temperature
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.temperature ?? 0.7}
                    onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {(config.temperature ?? 0.7).toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={config.max_tokens ?? 4000}
                  onChange={(e) => updateConfig({ max_tokens: parseInt(e.target.value) || 4000 })}
                  min={256}
                  max={200000}
                  className="w-full text-sm bg-muted border border-border rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          )}

          {/* Native Tools */}
          {!['START_NODE', 'END_NODE', 'TOOL_NODE'].includes(config.agentType) && (
            <div>
              <button
                onClick={() => setToolsCollapsed(!toolsCollapsed)}
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Native Tools
                  {(config.native_tools || []).length > 0 && (
                    <span className="bg-primary/10 text-primary px-1.5 rounded text-[10px] font-medium normal-case tracking-normal">
                      {(config.native_tools || []).length} enabled
                    </span>
                  )}
                </span>
                {toolsCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {!toolsCollapsed && (
                <div className="space-y-1.5">
                  {[
                    { id: 'web_search', name: 'Web Search', description: 'Search the web (DuckDuckGo)', icon: Search },
                    { id: 'web_fetch', name: 'Web Fetch', description: 'Fetch webpage content', icon: Globe },
                    { id: 'read_file', name: 'Read File', description: 'Read file with line numbers', icon: BookOpen },
                    { id: 'write_file', name: 'Write File', description: 'Create / overwrite files', icon: Save },
                    { id: 'edit_file', name: 'Edit File', description: 'String-replace in files', icon: Code },
                    { id: 'ls', name: 'List Directory', description: 'List directory contents', icon: Database },
                    { id: 'glob', name: 'Glob', description: 'Find files by pattern', icon: Search },
                    { id: 'grep', name: 'Grep', description: 'Regex search in files', icon: Search },
                    { id: 'reasoning_chain', name: 'Reasoning Chain', description: 'Multi-step reasoning', icon: GitBranch },
                    { id: 'memory_store', name: 'Store Memory', description: 'Save to long-term memory', icon: Layers3 },
                    { id: 'memory_recall', name: 'Recall Memory', description: 'Retrieve from memory', icon: Layers3 },
                  ].map(({ id, name, description, icon: Icon }) => {
                    const active = (config.native_tools || []).includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleNativeTool(id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                          active ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-transparent hover:border-border'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="min-w-0">
                          <div className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{description}</div>
                        </div>
                        {active && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Custom Tools */}
          {!['START_NODE', 'END_NODE', 'TOOL_NODE'].includes(config.agentType) && availableCustomTools.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-primary" />
                Custom Tools
                {(config.custom_tools || []).length > 0 && (
                  <span className="bg-primary/10 text-primary px-1.5 rounded text-[10px] font-medium normal-case tracking-normal">
                    {(config.custom_tools || []).length} enabled
                  </span>
                )}
              </label>
              <div className="space-y-1.5">
                {availableCustomTools.map((tool: any) => {
                  const active = (config.custom_tools || []).includes(tool.tool_id);
                  return (
                    <button
                      key={tool.tool_id}
                      onClick={() => {
                        const cur = config.custom_tools || [];
                        updateConfig({ custom_tools: active ? cur.filter((id: string) => id !== tool.tool_id) : [...cur, tool.tool_id] });
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                        active ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-transparent hover:border-border'
                      }`}
                    >
                      <Code className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{tool.name}</div>
                        {tool.description && (
                          <div className="text-[10px] text-muted-foreground truncate">{tool.description}</div>
                        )}
                      </div>
                      {active && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedToolId(tool.tool_id); setShowToolConfigModal(true); }}
                            className="p-1 hover:bg-muted rounded"
                            title="Configure tool"
                          >
                            <Settings className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Skills */}
          {!['START_NODE', 'END_NODE', 'TOOL_NODE'].includes(config.agentType) && availableSkills.length > 0 && (
            <div>
              <button
                onClick={() => {}}
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                  Skills
                  {selectedSkills.length > 0 && (
                    <span className="bg-primary/10 text-primary px-1.5 rounded text-[10px] font-medium normal-case tracking-normal">
                      {selectedSkills.length} active
                    </span>
                  )}
                </span>
              </button>
              <div className="space-y-1.5">
                {availableSkills.map((skill: Skill) => {
                  const active = selectedSkills.includes(skill.skill_id);
                  return (
                    <button
                      key={skill.skill_id}
                      onClick={() => toggleSkill(skill.skill_id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                        active ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-transparent hover:border-border'
                      }`}
                    >
                      <Layers3 className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{skill.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{skill.description}</div>
                      </div>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Middleware */}
          {!['START_NODE', 'END_NODE', 'TOOL_NODE'].includes(config.agentType) && (
            <div>
              <button
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Middleware
                  {enabledMiddleware.length > 0 && (
                    <span className="bg-primary/10 text-primary px-1.5 rounded text-[10px] font-medium normal-case tracking-normal">
                      {enabledMiddleware.length} active
                    </span>
                  )}
                </span>
              </button>
              <div className="space-y-1.5">
                {[
                  { id: 'timestamp', name: 'Timestamp Injection', description: 'Inject current time into context' },
                  { id: 'logging', name: 'Request Logging', description: 'Log inputs and outputs' },
                  { id: 'cost_tracking', name: 'Cost Tracking', description: 'Track token usage / costs' },
                  { id: 'tool_retry', name: 'Tool Retry Logic', description: 'Auto-retry failed tool calls' },
                  { id: 'pii', name: 'PII Detection', description: 'Redact sensitive data from logs' },
                  { id: 'hitl', name: 'Human-in-Loop', description: 'Require human approval for actions' },
                ].map(({ id, name, description }) => {
                  const active = enabledMiddleware.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleMiddleware(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                        active ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-transparent hover:border-border'
                      }`}
                    >
                      <Shield className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{description}</div>
                      </div>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Advanced
              </span>
              {showAdvancedSettings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {showAdvancedSettings && (
              <div className="space-y-3 bg-muted rounded-md p-3 border border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Max Retries</label>
                    <input
                      type="number"
                      value={config.max_retries ?? 3}
                      onChange={(e) => updateConfig({ max_retries: parseInt(e.target.value) || 3 })}
                      min={0}
                      max={10}
                      className="w-full text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Recursion Limit</label>
                    <input
                      type="number"
                      value={config.recursion_limit ?? 300}
                      onChange={(e) => updateConfig({ recursion_limit: parseInt(e.target.value) || 300 })}
                      min={10}
                      max={1000}
                      className="w-full text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
                {/* Conversation Context toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-foreground">Conversation Context</div>
                    <div className="text-[10px] text-muted-foreground">Maintain cross-node message history</div>
                  </div>
                  <button
                    onClick={() => updateConfig({ enable_conversation_context: !config.enable_conversation_context })}
                    className={`w-9 h-5 rounded-full transition-colors relative ${config.enable_conversation_context ? 'bg-primary' : 'bg-border'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.enable_conversation_context ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Token Cost Info */}
          {tokenCostInfo && (
            <div className="bg-muted rounded-md p-3 border border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                Token Usage
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Prompt</span>
                <span className="text-right text-foreground font-mono">{tokenCostInfo.prompt_tokens?.toLocaleString?.() ?? '—'}</span>
                <span className="text-muted-foreground">Completion</span>
                <span className="text-right text-foreground font-mono">{tokenCostInfo.completion_tokens?.toLocaleString?.() ?? '—'}</span>
                <span className="text-muted-foreground">Total</span>
                <span className="text-right text-foreground font-mono">{tokenCostInfo.total_tokens?.toLocaleString?.() ?? '—'}</span>
              </div>
            </div>
          )}

          {/* Delete Node */}
          <div className="pt-1">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Node
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDelete(config.id)}
                  className="flex-1 px-3 py-2 rounded-md text-sm bg-destructive text-white hover:opacity-90 transition-opacity"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-2 rounded-md text-sm bg-muted text-foreground hover:bg-card transition-colors border border-border"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="w-full px-3 py-2 rounded-md text-sm font-medium bg-primary text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {showToolConfigModal && selectedToolId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowToolConfigModal(false)}>
          <div className="bg-background border border-sidebar-border rounded-md w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <CustomToolBuilder existingToolId={selectedToolId} skipTemplateStep={false} onClose={() => setShowToolConfigModal(false)} />
          </div>
        </div>
      )}

      {showContextPreview && selectedDeepAgentId && (
        <ContextPreviewModal
          agentTemplateId={Number(selectedDeepAgentId)}
          query=""
          contextMode={contextMode}
          windowSize={contextWindowSize}
          onClose={() => setShowContextPreview(false)}
        />
      )}
    </>
  );
};

export default NodeConfigPanel;
