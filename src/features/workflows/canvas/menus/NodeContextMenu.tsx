/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { memo } from 'react';
import { Trash2, Copy, Brain, Database, Settings, FileText as FileIcon } from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeData: any;
  onClose: () => void;
  onChatWithAgent: (nodeId: string, nodeData: any) => void;
  onSaveToLibrary: (nodeId: string, nodeData: any) => void;
  onCopyLangChainCode: (nodeId: string, nodeData: any) => void;
  onDuplicateNode: (nodeId: string, nodeData: any) => void;
  onConfigureNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

/**
 * Context menu that appears when right-clicking a node in the workflow canvas
 */
const NodeContextMenu = memo(function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeData,
  onClose,
  onChatWithAgent,
  onSaveToLibrary,
  onCopyLangChainCode,
  onDuplicateNode,
  onConfigureNode,
  onDeleteNode,
}: NodeContextMenuProps) {
  const menuButtonBase =
    'w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 text-foreground hover:bg-muted';

  const menuButtonLargeBase =
    'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 text-foreground hover:bg-muted';

  return (
    <>
      {/* Backdrop to catch clicks */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />
      <div
        className="fixed z-[9999] bg-card border border-primary/50 rounded-md shadow-2xl py-1 min-w-[200px]"
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chat with Agent */}
        <button
          onClick={() => onChatWithAgent(nodeId, nodeData)}
          className={`${menuButtonLargeBase} rounded-t-sm`}
        >
          <Brain className="w-4 h-4 shrink-0 text-primary" />
          <div>
            <div className="font-medium">Chat with Agent</div>
            <div className="text-xs text-muted-foreground">Open chat interface for this agent</div>
          </div>
        </button>

        {/* Divider */}
        <div className="h-px my-1 bg-border" />

        {/* Save to Agent Library */}
        <button
          onClick={() => onSaveToLibrary(nodeId, nodeData)}
          className={menuButtonLargeBase}
        >
          <Database className="w-4 h-4 shrink-0 text-primary" />
          <div>
            <div className="font-medium">Save to Library</div>
            <div className="text-xs text-muted-foreground">Reuse this agent in other workflows</div>
          </div>
        </button>

        {/* Divider */}
        <div className="h-px my-1 bg-border" />

        {/* Copy LangChain Code */}
        <button
          onClick={() => onCopyLangChainCode(nodeId, nodeData)}
          className={menuButtonBase}
        >
          <FileIcon className="w-4 h-4 shrink-0 text-primary" />
          Copy LangChain Code
        </button>

        {/* Duplicate Node */}
        <button
          onClick={() => onDuplicateNode(nodeId, nodeData)}
          className={menuButtonBase}
        >
          <Copy className="w-4 h-4 shrink-0 text-primary" />
          Duplicate Node
        </button>

        {/* Configure Node */}
        <button
          onClick={() => onConfigureNode(nodeId)}
          className={menuButtonBase}
        >
          <Settings className="w-4 h-4 shrink-0 text-primary" />
          Configure
        </button>

        {/* View Metrics - only show if token cost exists */}
        {nodeData.executionStatus?.tokenCost && (
          <button
            onClick={() => onConfigureNode(nodeId)}
            className={menuButtonBase}
          >
            <Brain className="w-4 h-4 shrink-0 text-primary" />
            <div className="flex-1 flex items-center justify-between">
              <span>View Metrics</span>
              <span className="text-xs font-mono text-muted-foreground">
                {nodeData.executionStatus.tokenCost.costString}
              </span>
            </div>
          </button>
        )}

        {/* Divider */}
        <div className="h-px my-1 bg-border" />

        {/* Delete Node */}
        <button
          onClick={() => onDeleteNode(nodeId)}
          className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 text-destructive hover:bg-destructive/10 rounded-b-sm"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          Delete Node
        </button>
      </div>
    </>
  );
});

export default NodeContextMenu;
