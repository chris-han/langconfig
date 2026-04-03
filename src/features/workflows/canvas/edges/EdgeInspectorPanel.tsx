/**
 * Semantier-style inspector panel for a selected workflow edge.
 * Mirrors the InspectorPane property tab layout from OntologyGraph.
 */
import { useState, useEffect } from 'react';
import type { Edge } from 'reactflow';
import { X, Link2, ArrowRight } from 'lucide-react';

interface EdgeInspectorPanelProps {
  edge: Edge;
  onClose: () => void;
  onLabelChange: (edgeId: string, label: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  true: '#3ccf91',
  false: '#f06a7f',
  continue: '#39d0cf',
  exit: '#f2b94b',
};

function categoryColor(label: string | undefined): string {
  if (!label) return 'var(--primary)';
  return CATEGORY_COLORS[label] ?? '#39d0cf';
}

export default function EdgeInspectorPanel({ edge, onClose, onLabelChange }: EdgeInspectorPanelProps) {
  const [labelDraft, setLabelDraft] = useState(String(edge.label ?? edge.data?.label ?? ''));

  // Reset draft when a different edge is selected
  useEffect(() => {
    setLabelDraft(String(edge.label ?? edge.data?.label ?? ''));
  }, [edge.id, edge.label, edge.data?.label]);

  const commit = () => {
    if (labelDraft !== String(edge.label ?? '')) {
      onLabelChange(edge.id, labelDraft);
    }
  };

  const stroke = (edge.style as any)?.stroke as string | undefined;
  const accentColor = categoryColor(edge.label as string | undefined) ?? stroke;

  const rows: { label: string; value: string }[] = [
    { label: 'ID', value: edge.id },
    { label: 'Source', value: edge.source },
    { label: 'Target', value: edge.target },
    { label: 'Type', value: edge.type ?? 'workflow' },
    { label: 'Animated', value: edge.animated ? 'yes' : 'no' },
  ];

  return (
    <div className="flex h-full flex-col bg-sidebar border-l border-sidebar-border w-[320px] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-primary/20">
            <Link2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Edge</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Identity chip */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: accentColor }}>
            {edge.type ?? 'workflow'} edge
          </span>
        </div>

        {/* Connection diagram */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-xs font-mono">
          <span className="text-foreground truncate max-w-[100px]">{edge.source}</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: accentColor }} />
          <span className="text-foreground truncate max-w-[100px]">{edge.target}</span>
        </div>

        {/* Label edit */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Label</p>
          <input
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            placeholder="e.g. true, false, continue…"
            className="w-full px-2 py-1.5 text-xs rounded-md border bg-background text-foreground border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Press Enter or click away to apply</p>
        </div>

        {/* Property rows */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Properties
          </p>
          <div className="space-y-1">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground" />
                <span className="text-foreground w-16 shrink-0">{label}</span>
                <span className="text-muted-foreground ml-auto font-mono text-[10px] truncate max-w-[140px]" title={value}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Style info */}
        {stroke && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Style</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: stroke }} />
              <span className="text-foreground">Stroke color</span>
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">{stroke}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
