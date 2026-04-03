/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Grip } from 'lucide-react';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { getModelDisplayName } from '@/lib/model-utils';
import type { NodeExecutionStatus } from '@/hooks/useNodeExecutionStatus';
import { useWorkflowCanvasContext } from '../context';

/**
 * Custom Node Component with enhanced visuals and execution status
 * Memoized for performance during canvas operations
 */
const CustomNode = memo(function CustomNode({ id, data, selected }: NodeProps) {
  // Always prefer data.config.model over data.model for display
  const modelName = data.config?.model || data.model;
  const agentType = data.agentType || 'default';
  const executionStatus = data.executionStatus as NodeExecutionStatus | undefined;

  // Refs
  const nodeRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef<NodeExecutionStatus | undefined>(executionStatus);

  // Minimal state for model dropdown
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Get functions from context
  const { updateNodeConfig, openNodeContextMenu } = useWorkflowCanvasContext();

  // Fetch available models for dropdown
  const { cloudModels, localModels } = useAvailableModels({
    includeLocal: true,
    onlyValidated: true
  });

  // State for expandable panel
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Middleware state
  const [pauseBefore, setPauseBefore] = useState(data.config?.pauseBefore || false);
  const [pauseAfter, setPauseAfter] = useState(data.config?.pauseAfter || false);

  // Advanced settings state
  const [maxTokens, setMaxTokens] = useState(data.config?.max_tokens || 4000);
  const [maxRetries, setMaxRetries] = useState(data.config?.max_retries || 3);
  const [temperature, setTemperature] = useState(data.config?.temperature ?? 0.7);
  const [reasoningEffort, setReasoningEffort] = useState(data.config?.reasoning_effort || 'low');

  // Token cost info (from execution status or config)
  const tokenCost = data.tokenCost || executionStatus?.tokenCost;

  // Detect if this is a control node
  const isControlNode = ['START_NODE', 'END_NODE', 'CHECKPOINT_NODE', 'OUTPUT_NODE', 'CONDITIONAL_NODE', 'APPROVAL_NODE', 'TOOL_NODE'].includes(agentType);

  // Control node styling configuration - using theme colors
  const controlNodeStyles: Record<string, { icon: string; opacity: number }> = {
    START_NODE: { icon: 'play_circle', opacity: 0.7 },
    END_NODE: { icon: 'stop_circle', opacity: 0.5 },
    CHECKPOINT_NODE: { icon: 'bookmark', opacity: 0.6 },
    OUTPUT_NODE: { icon: 'output', opacity: 0.8 },
    CONDITIONAL_NODE: { icon: 'call_split', opacity: 0.65 },
    APPROVAL_NODE: { icon: 'how_to_reg', opacity: 0.75 },
    TOOL_NODE: { icon: 'construction', opacity: 0.8 },
  };

  const controlStyle = isControlNode ? controlNodeStyles[agentType] : null;

  // Determine border color based on execution state - MEMOIZED
  const borderColor = useMemo(() => {
    if (selected) return '#10b981'; // green-500 for selected
    if (!executionStatus || executionStatus.state === 'idle') return 'var(--color-primary)';

    switch (executionStatus.state) {
      case 'running':
      case 'thinking':
        return '#3b82f6'; // blue-500 for active
      case 'completed':
        return '#10b981'; // green-500 for success
      case 'error':
        return '#ef4444'; // red-500 for error
      default:
        return 'var(--color-primary)';
    }
  }, [selected, executionStatus]);

  // Simple CSS-based animations only (no heavy anime.js effects)
  // Just track previous status for conditional styling
  useEffect(() => {
    prevStatusRef.current = executionStatus;
  }, [executionStatus]);

  // Execution state CSS class (Semantier pattern — no inline border color)
  const stateClass = useMemo(() => {
    if (selected) return 'border-primary node-blink';
    if (!executionStatus || executionStatus.state === 'idle') return 'border-primary/40';
    switch (executionStatus.state) {
      case 'running':
      case 'thinking': return 'border-[#3b82f6] node-running';
      case 'completed': return 'border-[#3ccf91]';
      case 'error': return 'border-[#f06a7f]';
      default: return 'border-primary/40';
    }
  }, [selected, executionStatus]);

  return (
    <div
      ref={nodeRef}
      className={`group w-52 rounded-md border-2 shadow-lg transition-colors duration-200 bg-card backdrop-blur-sm relative ${stateClass}`}
      style={(isControlNode && agentType !== 'TOOL_NODE') ? { opacity: controlStyle?.opacity } : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        openNodeContextMenu(id, data, e.clientX, e.clientY);
      }}
    >

      {/* ── Header row (Semantier pattern) ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Grip className="h-3 w-3 text-muted-foreground cursor-grab shrink-0" />
        <div className="p-0.5 rounded bg-primary/20 shrink-0">
          {isControlNode
            ? <span className="material-symbols-outlined text-[13px] text-primary">{controlStyle?.icon ?? 'settings'}</span>
            : <span className="material-symbols-outlined text-[13px] text-primary">smart_toy</span>}
        </div>
        <span className="font-medium text-sm truncate flex-1">
          {agentType === 'TOOL_NODE' && data.config?.tool_id ? data.config.tool_id : data.label}
        </span>
        {/* Conversation context badge */}
        {!isControlNode && data.config?.enable_conversation_context && (
          <MessageSquare className="w-3 h-3 text-[#3b82f6] shrink-0" aria-label="Conversation context" />
        )}
        {/* Tool count badge */}
        {!isControlNode && (() => {
          const total = (data.config?.native_tools?.length || 0) + (data.config?.tools?.length || 0) + (data.config?.custom_tools?.length || 0);
          if (!total) return null;
          const color = (data.config?.custom_tools?.length || 0) > 0 ? 'text-[#f59e0b]' : 'text-primary';
          return <span className={`text-[10px] font-mono font-bold ${color}`}>{total}T</span>;
        })()}
      </div>

      {/* ── Body rows (Semantier pattern) ── */}
      <div className="p-2 space-y-1">
        {/* Model row — clickable */}
        {modelName && modelName !== 'none' && (
          <div className="relative" style={{ zIndex: 9999 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModelDropdown(!showModelDropdown);
              }}
              className="nodrag flex w-full items-center gap-2 text-xs rounded hover:bg-muted/50 px-1 py-0.5 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-primary" />
              <span className="text-foreground truncate">{getModelDisplayName(modelName)}</span>
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">model</span>
            </button>

            {/* Model Dropdown */}
            {showModelDropdown && (
              <div
                className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 rounded-md shadow-xl nodrag nopan"
                style={{
                  backgroundColor: 'var(--color-background-dark)',
                  border: '2px solid var(--color-border-dark)',
                  minWidth: '220px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  zIndex: 9999,
                }}
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Cloud Models */}
                {cloudModels.length > 0 && (
                  <div>
                    <div
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide sticky top-0"
                      style={{
                        backgroundColor: 'var(--color-background-dark)',
                        color: 'var(--color-text-muted)',
                        borderBottom: '1px solid var(--color-border-dark)',
                      }}
                    >
                      Cloud Models
                    </div>
                    {cloudModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newConfig = {
                            ...data.config,
                            model: model.id
                          };
                          updateNodeConfig(id, newConfig);
                          setShowModelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm transition-all"
                        style={{
                          color: data.config?.model === model.id ? '#ffffff' : 'var(--color-text-primary)',
                          backgroundColor: data.config?.model === model.id ? 'var(--color-primary)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (data.config?.model !== model.id) {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                            e.currentTarget.style.color = '#ffffff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (data.config?.model !== model.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }
                        }}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Local Models */}
                {localModels.length > 0 && (
                  <div>
                    <div
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide sticky top-0"
                      style={{
                        backgroundColor: 'var(--color-background-dark)',
                        color: 'var(--color-text-muted)',
                        borderBottom: '1px solid var(--color-border-dark)',
                      }}
                    >
                      Local Models
                    </div>
                    {localModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newConfig = {
                            ...data.config,
                            model: model.id
                          };
                          updateNodeConfig(id, newConfig);
                          setShowModelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm transition-all"
                        style={{
                          color: data.config?.model === model.id ? '#ffffff' : 'var(--color-text-primary)',
                          backgroundColor: data.config?.model === model.id ? 'var(--color-primary)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (data.config?.model !== model.id) {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                            e.currentTarget.style.color = '#ffffff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (data.config?.model !== model.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }
                        }}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execution status row */}
        {executionStatus && executionStatus.state !== 'idle' && (
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              executionStatus.state === 'running' || executionStatus.state === 'thinking'
                ? 'bg-[#3b82f6] animate-pulse'
                : executionStatus.state === 'completed' ? 'bg-[#3ccf91]' : 'bg-[#f06a7f]'
            }`} />
            <span className="text-muted-foreground">{executionStatus.state}</span>
            {tokenCost && tokenCost.totalTokens > 0 && (
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">{tokenCost.costString}</span>
            )}
          </div>
        )}
        {/* Warning row */}
        {!isControlNode && executionStatus?.warnings && executionStatus.warnings.length > 0 && (
          <div
            className="flex items-center gap-1.5 text-xs cursor-help"
            title={executionStatus.warnings.map((w: { message: string }) => w.message).join('\n')}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              executionStatus.warnings.some((w: { severity: string }) => w.severity === 'error') ? 'bg-[#f06a7f]' : 'bg-[#f59e0b]'
            }`} />
            <span className="text-muted-foreground">{executionStatus.warnings.length} warning{executionStatus.warnings.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* ── Handles (Semantier PortHandle style) ── */}
      {agentType !== 'START_NODE' && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ left: 0, top: '50%', transform: 'translate(calc(-50% - 1px), -50%)' }}
          className="!rounded-full !border-2 !w-3 !h-3 !bg-teal-700 !border-teal-400 hover:!bg-teal-600 hover:!border-teal-300 transition-all duration-200"
        />
      )}
      {agentType !== 'END_NODE' && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ left: '100%', top: '50%', transform: 'translate(calc(-50% + 1px), -50%)' }}
          className="!rounded-full !border-2 !w-3 !h-3 !bg-teal-700 !border-teal-400 hover:!bg-teal-600 hover:!border-teal-300 transition-all duration-200"
        />
      )}

      {/* Expand/Collapse Button (Semantier: subtle bottom bar) */}
      {!isControlNode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsPanelExpanded(!isPanelExpanded);
          }}
          className="nodrag nopan w-full flex items-center justify-center py-1 border-t border-border/50 hover:bg-muted/50 transition-colors rounded-b-md"
        >
          <span
            className="material-symbols-outlined text-muted-foreground"
            style={{ fontSize: '14px', transform: isPanelExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            expand_more
          </span>
        </button>
      )}

      {/* Expandable Panel - Positioned below node */}
      {!isControlNode && isPanelExpanded && (
        <div
          className="absolute top-full mt-4 left-1/2 transform -translate-x-1/2 nodrag nopan z-30 rounded-md shadow-2xl border-2 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-panel-dark)',
            borderColor: 'var(--color-border-dark)',
            minWidth: '240px',
            maxWidth: '260px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Panel Content */}
          <div className="p-3 space-y-2.5">
            {/* Quick Settings Row 1 - Pause Options */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={pauseBefore}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setPauseBefore(newValue);
                    const newConfig = {
                      ...data.config,
                      pauseBefore: newValue
                    };
                    updateNodeConfig(id, newConfig);
                  }}
                  className="w-3.5 h-3.5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <div className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                  Pause Before
                </div>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={pauseAfter}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setPauseAfter(newValue);
                    const newConfig = {
                      ...data.config,
                      pauseAfter: newValue
                    };
                    updateNodeConfig(id, newConfig);
                  }}
                  className="w-3.5 h-3.5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <div className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                  Pause After
                </div>
              </label>
            </div>

            {/* Quick Settings Row 2 - Temperature Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Temperature
                </label>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded" style={{
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-background-dark)'
                }}>
                  {temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  setTemperature(newValue);
                  const newConfig = {
                    ...data.config,
                    temperature: newValue
                  };
                  updateNodeConfig(id, newConfig);
                }}
                className="w-full h-1.5 rounded-md appearance-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-border-dark)',
                  accentColor: 'var(--color-primary)'
                }}
              />
            </div>

            {/* Quick Settings Row 3 - Compact Number Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value) || 4000;
                    setMaxTokens(newValue);
                    const newConfig = {
                      ...data.config,
                      max_tokens: newValue
                    };
                    updateNodeConfig(id, newConfig);
                  }}
                  min="100"
                  max="16000"
                  step="100"
                  className="w-full px-1.5 py-0.5 text-[11px] border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{
                    backgroundColor: 'var(--color-background-light)',
                    borderColor: 'var(--color-border-dark)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Retries
                </label>
                <input
                  type="number"
                  value={maxRetries}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value) || 3;
                    setMaxRetries(newValue);
                    const newConfig = {
                      ...data.config,
                      max_retries: newValue
                    };
                    updateNodeConfig(id, newConfig);
                  }}
                  min="0"
                  max="10"
                  className="w-full px-1.5 py-0.5 text-[11px] border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{
                    backgroundColor: 'var(--color-background-light)',
                    borderColor: 'var(--color-border-dark)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Reasoning Effort Dropdown - For Gemini models */}
            {modelName && modelName.startsWith('gemini') && (
              <div>
                <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Reasoning Effort
                </label>
                <select
                  value={reasoningEffort}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setReasoningEffort(newValue);
                    const newConfig = {
                      ...data.config,
                      reasoning_effort: newValue
                    };
                    updateNodeConfig(id, newConfig);
                  }}
                  className="w-full px-1.5 py-1 text-[11px] border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{
                    backgroundColor: 'var(--color-background-light)',
                    borderColor: 'var(--color-border-dark)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <option value="none">None (96% cheaper)</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {reasoningEffort === 'none' && 'Maximum cost savings'}
                  {reasoningEffort === 'low' && 'Balanced performance'}
                  {reasoningEffort === 'medium' && 'Enhanced reasoning'}
                  {reasoningEffort === 'high' && 'Maximum reasoning depth'}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t" style={{ borderColor: 'var(--color-border-dark)' }} />

            {/* Token Statistics - Bottom */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Prompt Tokens</span>
                <span className="font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {tokenCost?.promptTokens?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Completion</span>
                <span className="font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {tokenCost?.completionTokens?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Total Tokens</span>
                <span className="font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {tokenCost?.totalTokens?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border-dark)' }}>
                <div className="flex justify-between">
                  <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>Cost</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                    {tokenCost?.costString || '$0.00'}
                  </span>
                </div>
                {tokenCost && tokenCost.totalTokens > 0 && (
                  <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Priced for {getModelDisplayName(modelName)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CustomNode;
