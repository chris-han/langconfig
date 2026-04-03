/**
 * Semantier-style edge for the Workflow Canvas.
 * Mirrors the OntologyEdge pattern: smooth-step path with borderRadius,
 * edge label rendered via EdgeLabelRenderer as a tinted monospace chip,
 * and a wider invisible interaction band for easier selection.
 */
import type { EdgeProps } from 'reactflow';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

export default function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const edgeLabel = (data as any)?.label ?? (label as string | undefined) ?? '';

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={20} />
      {edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, calc(-50% - 3px)) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 5,
            }}
            className="nodrag nopan"
          >
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-border/60 backdrop-blur text-primary bg-[rgba(20,24,32,0.9)]"
            >
              {edgeLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
