import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  reconnectEdge,
  useReactFlow,
  getBezierPath,
  getSmoothStepPath,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "reactflow";
import dagre from "dagre";
import { ArrowRight, Box, CircleDot, Grip, LayoutTemplate } from "lucide-react";
import { SEMANTIER_NODE_DRAG_MIME } from "./dragDropContract";

type NodeType = "entity" | "dimension" | "event";
type RelCategory = "structural" | "interoperation";

interface NodeData {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
  properties: Array<{ name: string; type: string; required: boolean }>;
  actions?: string[];
  isRelated?: boolean;
  connectState?: "compatible" | "incompatible" | null;
  connectedHandles?: Record<string, "source" | "target">;
}

interface TreeDropNode {
  id: string;
  name: string;
  type: string;
  prefix?: string;
}

const resolveDroppedTreeNode = (event: React.DragEvent): TreeDropNode | null => {
  const raw = event.dataTransfer.getData(SEMANTIER_NODE_DRAG_MIME) || event.dataTransfer.getData("text/plain");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TreeDropNode;
    if (!parsed?.id || !parsed?.name || !parsed?.type) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const RELATIONSHIP_DEFS: Record<string, { category: RelCategory; stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  participates: { category: "structural", stroke: "#2dd4bf", strokeWidth: 2 },
  participated_by: { category: "structural", stroke: "#2dd4bf", strokeWidth: 2 },
  triggers: { category: "interoperation", stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "5,4" },
  triggered_by: { category: "interoperation", stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "5,4" },
  posts: { category: "interoperation", stroke: "#a064dc", strokeWidth: 2, strokeDasharray: "5,4" },
  posted_by: { category: "interoperation", stroke: "#a064dc", strokeWidth: 2, strokeDasharray: "5,4" },
  dimensions: { category: "structural", stroke: "#508cdc", strokeWidth: 1.5 },
  dimension_of: { category: "structural", stroke: "#508cdc", strokeWidth: 1.5 },
  relates: { category: "structural", stroke: "#888888", strokeWidth: 1 },
};

function buildEdge(source: string, target: string, relType: string): Edge {
  const definition = RELATIONSHIP_DEFS[relType] ?? RELATIONSHIP_DEFS.relates;
  const isInterop = definition.category === "interoperation";
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    label: relType,
    type: "ontology",
    animated: isInterop,
    style: {
      stroke: definition.stroke,
      strokeWidth: definition.strokeWidth,
      strokeDasharray: isInterop ? definition.strokeDasharray ?? "5,4" : undefined,
    } as CSSProperties,
    markerEnd: { type: MarkerType.ArrowClosed, color: definition.stroke, width: 16, height: 16 },
    reconnectable: true,
    data: { relType, category: definition.category },
  };
}

const defaultPropertiesForNodeType = (nodeType: NodeType): Array<{ name: string; type: string; required: boolean }> => {
  if (nodeType === "entity") {
    return [
      { name: "id", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "status", type: "enum", required: false },
    ];
  }

  if (nodeType === "dimension") {
    return [
      { name: "id", type: "string", required: true },
      { name: "name", type: "string", required: true },
    ];
  }

  return [
    { name: "ruleId", type: "string", required: true },
    { name: "condition", type: "string", required: true },
  ];
};

const INITIAL_NODES: Node<NodeData>[] = [
  {
    id: "contract",
    position: { x: 100, y: 100 },
    type: "custom",
    data: {
      id: "contract",
      label: "Contract",
      type: "entity",
      description: "Core legal agreement object",
      properties: [
        { name: "contractId", type: "string", required: true },
        { name: "amount", type: "decimal", required: true },
        { name: "status", type: "enum", required: true },
        { name: "signDate", type: "date", required: false },
      ],
      actions: ["sign", "amend", "terminate"],
    },
  },
  {
    id: "revenue",
    position: { x: 450, y: 80 },
    type: "custom",
    data: {
      id: "revenue",
      label: "RevenueRecognition",
      type: "event",
      description: "Revenue recognition event",
      properties: [
        { name: "recognitionDate", type: "date", required: true },
        { name: "amount", type: "decimal", required: true },
        { name: "method", type: "enum", required: true },
      ],
      actions: ["recognize", "defer", "reverse"],
    },
  },
  {
    id: "tax",
    position: { x: 450, y: 280 },
    type: "custom",
    data: {
      id: "tax",
      label: "TaxObligation",
      type: "event",
      description: "Tax liability event",
      properties: [
        { name: "taxType", type: "enum", required: true },
        { name: "taxableAmount", type: "decimal", required: true },
        { name: "dueDate", type: "date", required: true },
      ],
      actions: ["calculate", "file", "defer"],
    },
  },
  {
    id: "ledger",
    position: { x: 750, y: 120 },
    type: "custom",
    data: {
      id: "ledger",
      label: "GeneralLedger",
      type: "entity",
      description: "General ledger accounting target",
      properties: [
        { name: "accountCode", type: "string", required: true },
        { name: "debit", type: "decimal", required: true },
        { name: "credit", type: "decimal", required: true },
      ],
      actions: ["post", "reconcile", "close"],
    },
  },
  {
    id: "actor",
    position: { x: 100, y: 300 },
    type: "custom",
    data: {
      id: "actor",
      label: "Actor",
      type: "dimension",
      description: "Participating counterparty dimension",
      properties: [
        { name: "actorId", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "role", type: "enum", required: true },
      ],
      actions: ["authenticate", "authorize", "audit"],
    },
  },
  {
    id: "cost_center",
    position: { x: 750, y: 300 },
    type: "custom",
    data: {
      id: "cost_center",
      label: "CostCenter",
      type: "dimension",
      description: "Management accounting allocation dimension",
      properties: [
        { name: "centerId", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "budget", type: "decimal", required: false },
      ],
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  buildEdge("actor", "contract", "participates"),
  buildEdge("contract", "revenue", "triggers"),
  buildEdge("contract", "tax", "triggers"),
  buildEdge("revenue", "ledger", "posts"),
  buildEdge("contract", "cost_center", "dimensions"),
];

const RELATIONSHIP_RULES: Record<string, Array<{ targets: string[]; relationType: string }>> = {
  contract: [
    { targets: ["revenue", "tax"], relationType: "triggers" },
    { targets: ["cost_center"], relationType: "dimensions" },
    { targets: ["actor"], relationType: "participated_by" },
  ],
  revenue: [
    { targets: ["ledger"], relationType: "posts" },
    { targets: ["contract"], relationType: "triggered_by" },
  ],
  tax: [{ targets: ["contract"], relationType: "triggered_by" }],
  ledger: [{ targets: ["revenue"], relationType: "posted_by" }],
  actor: [{ targets: ["contract"], relationType: "participates" }],
  cost_center: [{ targets: ["contract"], relationType: "dimension_of" }],
};

function getRelatedNodeIds(nodeId: string): string[] {
  const related = new Set<string>();
  const forward = RELATIONSHIP_RULES[nodeId];
  if (forward) {
    forward.forEach((rule) => rule.targets.forEach((target) => related.add(target)));
  }
  Object.entries(RELATIONSHIP_RULES).forEach(([source, rules]) => {
    rules.forEach((rule) => {
      if (rule.targets.includes(nodeId)) {
        related.add(source);
      }
    });
  });
  return Array.from(related);
}

function getRelationshipType(sourceId: string, targetId: string): string {
  const rules = RELATIONSHIP_RULES[sourceId];
  if (rules) {
    for (const rule of rules) {
      if (rule.targets.includes(targetId)) {
        return rule.relationType;
      }
    }
  }
  const reverseRules = RELATIONSHIP_RULES[targetId];
  if (reverseRules) {
    for (const rule of reverseRules) {
      if (rule.targets.includes(sourceId)) {
        return rule.relationType;
      }
    }
  }
  return "relates";
}

function isConnectionValid(sourceId: string, targetId: string): boolean {
  return sourceId !== targetId && getRelatedNodeIds(sourceId).includes(targetId);
}

function syncPortStates(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData>[] {
  const portMap = new Map<string, Record<string, "source" | "target">>();
  edges.forEach((edge) => {
    if (edge.sourceHandle) {
      if (!portMap.has(edge.source)) {
        portMap.set(edge.source, {});
      }
      portMap.get(edge.source)![edge.sourceHandle] = "source";
    }
    if (edge.targetHandle) {
      if (!portMap.has(edge.target)) {
        portMap.set(edge.target, {});
      }
      portMap.get(edge.target)![edge.targetHandle] = "target";
    }
  });
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data, connectedHandles: portMap.get(node.id) ?? {} },
  }));
}

function getTypeIcon(type: NodeType) {
  if (type === "entity") {
    return <Box className="h-3.5 w-3.5 text-primary" />;
  }
  if (type === "dimension") {
    return <CircleDot className="h-3.5 w-3.5 text-primary" />;
  }
  return <ArrowRight className="h-3.5 w-3.5 text-primary" />;
}

function PortHandle({
  id,
  type,
  position,
  role,
}: {
  id: string;
  type: "source" | "target";
  position: Position;
  role?: "source" | "target";
}) {
  const inwardPath = {
    top: "M3.2 4.2 L5 6 L6.8 4.2",
    bottom: "M3.2 5.8 L5 4 L6.8 5.8",
    left: "M4.2 3.2 L6 5 L4.2 6.8",
    right: "M5.8 3.2 L4 5 L5.8 6.8",
  }[id] ?? "M4.2 3.2 L6 5 L4.2 6.8";

  const outwardPath = {
    top: "M3.2 5.8 L5 4 L6.8 5.8",
    bottom: "M3.2 4.2 L5 6 L6.8 4.2",
    left: "M5.8 3.2 L4 5 L5.8 6.8",
    right: "M4.2 3.2 L6 5 L4.2 6.8",
  }[id] ?? "M5.8 3.2 L4 5 L5.8 6.8";

  const centeredStyle = {
    top: { left: "50%", top: 0, transform: "translate(-50%, calc(-50% - 1px))" },
    bottom: { left: "50%", top: "100%", transform: "translate(-50%, calc(-50% + 1px))" },
    left: { left: 0, top: "50%", transform: "translate(calc(-50% - 1px), -50%)" },
    right: { left: "100%", top: "50%", transform: "translate(calc(-50% + 1px), -50%)" },
  }[id];

  const isEmit = role === "source";
  const isReceive = role === "target";

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      style={centeredStyle}
      className={[
        "!rounded-full !border-2 transition-all duration-200",
        !role ? "!w-3 !h-3 !bg-teal-700 !border-teal-400 hover:!bg-teal-600 hover:!border-teal-300" : "",
        role ? "!w-3 !h-3 !flex !items-center !justify-center" : "",
        isEmit ? "!bg-amber-500 !border-amber-400" : "",
        isReceive ? "!bg-sky-500 !border-sky-400" : "",
      ].join(" ")}
    >
      {(isEmit || isReceive) && (
        <svg viewBox="0 0 10 10" width="7" height="7" className="pointer-events-none">
          <path
            d={isEmit ? outwardPath : inwardPath}
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )}
    </Handle>
  );
}

function OntologyNode({ data, selected }: NodeProps<NodeData>) {
  const displayedProperties = data.properties.slice(0, 4);

  return (
    <div
      className={[
        "w-52 rounded-lg border-2 shadow-lg transition-colors duration-200",
        "bg-card backdrop-blur-sm border-primary/40",
        selected ? "node-blink" : "",
        data.isRelated && !selected ? "node-related-blink" : "",
        data.connectState === "compatible" ? "node-connect-compatible" : "",
        data.connectState === "incompatible" ? "node-connect-incompatible" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Grip className="h-3 w-3 text-muted-foreground cursor-grab shrink-0" />
        <div className="p-0.5 rounded bg-primary/20">{getTypeIcon(data.type)}</div>
        <span className="font-medium text-sm truncate">{data.label}</span>
      </div>
      <div className="p-2 space-y-1">
        {displayedProperties.map((property) => (
          <div key={property.name} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${property.required ? "bg-primary" : "bg-muted-foreground"}`} />
            <span className="text-foreground truncate">{property.name}</span>
            <span className="text-muted-foreground ml-auto font-mono text-[10px]">{property.type}</span>
          </div>
        ))}
        {data.properties.length > 4 && (
          <div className="text-xs text-muted-foreground text-center pt-1">+{data.properties.length - 4} more</div>
        )}
      </div>
      <PortHandle id="top" type="target" position={Position.Top} role={data.connectedHandles?.top} />
      <PortHandle id="bottom" type="source" position={Position.Bottom} role={data.connectedHandles?.bottom} />
      <PortHandle id="left" type="source" position={Position.Left} role={data.connectedHandles?.left} />
      <PortHandle id="right" type="source" position={Position.Right} role={data.connectedHandles?.right} />
    </div>
  );
}

function OntologyEdge({
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

  const relationshipName = (data as any)?.relType ?? (label as string) ?? "";
  const stroke = (style as CSSProperties)?.stroke as string | undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={20} />
      {relationshipName && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, calc(-50% - 3px)) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
              zIndex: 5,
            }}
            className="nodrag nopan"
          >
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-card/90 border border-border/60 backdrop-blur" style={{ color: stroke ?? "inherit" }}>
              {relationshipName}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function MagneticConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromPosition: Position;
  toPosition: Position;
  connectionStatus: "valid" | "invalid" | null;
}) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const isInvalid = connectionStatus === "invalid";
  const stroke = isInvalid ? "#ef4444" : "#2dd4bf";
  const glow = isInvalid ? "rgba(239,68,68,0.35)" : "rgba(45,212,191,0.35)";

  return (
    <g>
      <path d={path} stroke={glow} strokeWidth={isInvalid ? 8 : 14} fill="none" />
      <path
        d={path}
        stroke={stroke}
        strokeWidth={2}
        fill="none"
        strokeDasharray={isInvalid ? "4,3" : "10,5"}
        className={isInvalid ? "conn-line-invalid" : "conn-line-valid"}
      />
      <circle cx={toX} cy={toY} r={connectionStatus === "valid" ? 6 : 4} fill={stroke} opacity={0.9} />
    </g>
  );
}

function getLayoutedElements(nodes: Node<NodeData>[], edges: Edge[], direction = "TB") {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 120 });
  const width = 208;
  const height = 160;

  nodes.forEach((node) => graph.setNode(node.id, { width, height }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);

  const usedHandles = new Map<string, Map<string, string>>();
  const pickHandle = (nodeId: string, preferences: string[], relationType: string) => {
    if (!usedHandles.has(nodeId)) {
      usedHandles.set(nodeId, new Map());
    }
    const used = usedHandles.get(nodeId)!;
    for (const handle of preferences) {
      if (!used.has(handle) || used.get(handle) === relationType) {
        used.set(handle, relationType);
        return handle;
      }
    }
    return preferences[0];
  };

  const layoutedNodes = nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: { x: position.x - width / 2, y: position.y - height / 2 },
    };
  });

  const layoutedEdges = edges.map((edge) => {
    const source = layoutedNodes.find((node) => node.id === edge.source);
    const target = layoutedNodes.find((node) => node.id === edge.target);
    if (!source || !target) {
      return { ...edge, type: "ontology", reconnectable: true };
    }
    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    let sourcePrefs: string[];
    let targetPrefs: string[];
    if (Math.abs(dx) > Math.abs(dy)) {
      sourcePrefs = dx > 0 ? ["right", "bottom", "top", "left"] : ["left", "bottom", "top", "right"];
      targetPrefs = dx > 0 ? ["left", "top", "bottom", "right"] : ["right", "top", "bottom", "left"];
    } else {
      sourcePrefs = dy > 0 ? ["bottom", "right", "left", "top"] : ["top", "right", "left", "bottom"];
      targetPrefs = dy > 0 ? ["top", "left", "right", "bottom"] : ["bottom", "left", "right", "top"];
    }
    const relationType = (edge.data as any)?.relType ?? "default";
    return {
      ...edge,
      sourceHandle: pickHandle(edge.source, sourcePrefs, relationType),
      targetHandle: pickHandle(edge.target, targetPrefs, relationType),
      type: "ontology",
      reconnectable: true,
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

const GRAPH_CSS = `
@keyframes v0-node-blink {
  0%,100% { filter: drop-shadow(0 0 4px rgba(250,204,21,.6)); transform: scale(1); }
  50% { filter: drop-shadow(0 0 20px rgba(250,204,21,.9)); transform: scale(1.06); }
}
.node-blink { animation: v0-node-blink 1.5s ease-in-out infinite; z-index: 1000; }
@keyframes v0-node-rel {
  0%,100% { filter: drop-shadow(0 0 2px rgba(45,212,191,.4)); }
  50% { filter: drop-shadow(0 0 12px rgba(45,212,191,.7)); }
}
.node-related-blink { animation: v0-node-rel 2s ease-in-out infinite; }
@keyframes magnetic-breathe {
  0%,100% { box-shadow: 0 0 0 2px rgba(45,212,191,.5),0 0 10px rgba(45,212,191,.3); border-color: rgba(45,212,191,.8) !important; }
  50% { box-shadow: 0 0 0 3px rgba(45,212,191,.9),0 0 24px rgba(45,212,191,.6); border-color: rgba(45,212,191,1) !important; }
}
.node-connect-compatible { animation: magnetic-breathe .8s ease-in-out infinite; z-index: 900; }
.node-connect-incompatible { opacity: .35; filter: grayscale(.5); }
@keyframes v0-edge-glow {
  0%,100% { stroke: rgba(250,204,21,.85); stroke-width: 2.5px; filter: drop-shadow(0 0 2px rgba(250,204,21,.9)); }
  50% { stroke: rgba(255,220,50,1); stroke-width: 3.5px; filter: drop-shadow(0 0 4px rgba(255,220,50,1)); }
}
.react-flow__edge.selected path.react-flow__edge-path {
  animation: v0-edge-glow 1s ease-in-out infinite;
  stroke: rgba(250,204,21,1) !important;
}
.react-flow__edge.selected path.react-flow__edge-interaction { stroke-width: 28px; cursor: pointer; }
@keyframes handle-valid-breathe {
  0%,100% { transform: scale(1.3); opacity:.9; }
  50% { transform: scale(1.55); opacity:1; }
}
.react-flow__handle-valid {
  background-color: rgb(45,212,191) !important;
  box-shadow: 0 0 0 3px rgba(45,212,191,.5), 0 0 16px rgba(45,212,191,.8) !important;
  animation: handle-valid-breathe .8s ease-in-out infinite !important;
  z-index: 10 !important;
}
@keyframes handle-shake {
  0%,100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
.react-flow__handle-invalid {
  background-color: rgb(239,68,68) !important;
  box-shadow: 0 0 8px rgba(239,68,68,.8) !important;
  animation: handle-shake .15s ease-in-out infinite !important;
}
@keyframes conn-dash-flow { 0% { stroke-dashoffset: 30; } 100% { stroke-dashoffset: 0; } }
@keyframes conn-invalid-pulse { 0%,100% { opacity:.7; } 50% { opacity:1; } }
.conn-line-valid { animation: conn-dash-flow .5s linear infinite; }
.conn-line-invalid { animation: conn-invalid-pulse .3s ease-in-out infinite; }
`;

function RelationLegend() {
  return (
    <div className="absolute top-3 right-3 bg-card/90 backdrop-blur border border-border rounded-lg p-3 z-10 text-xs pointer-events-none">
      <p className="text-muted-foreground font-semibold mb-2 uppercase tracking-wider text-[10px]">Relationships</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <svg width="36" height="10" viewBox="0 0 36 10">
            <line x1="0" y1="5" x2="28" y2="5" stroke="#2dd4bf" strokeWidth="2" />
            <polygon points="24,2 30,5 24,8" fill="#2dd4bf" />
          </svg>
          <span className="text-foreground">structural</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="36" height="10" viewBox="0 0 36 10">
            <line x1="0" y1="5" x2="28" y2="5" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,4">
              <animate attributeName="stroke-dashoffset" from="0" to="-9" dur="0.4s" repeatCount="indefinite" />
            </line>
            <polygon points="24,2 30,5 24,8" fill="#ef4444" />
          </svg>
          <span className="text-foreground">interoperation</span>
        </div>
      </div>
    </div>
  );
}

function OntologyGraphInner({ onSelectItem }: { onSelectItem?: (type: "node" | "edge", data: any) => void }) {
  const initialGraph = useMemo(() => {
    const layout = getLayoutedElements(INITIAL_NODES, INITIAL_EDGES);
    return {
      nodes: syncPortStates(layout.nodes, layout.edges),
      edges: layout.edges,
    };
  }, []);
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialGraph.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialGraph.edges);
  const edgeReconnectSuccessful = useRef(true);
  const { fitView, screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    setNodes((current) => syncPortStates(current, edges));
  }, [edges]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      const tagName = (event.target as HTMLElement | null)?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA") {
        return;
      }

      setNodes((current) => {
        const selectedNodeIds = new Set(current.filter((n) => n.selected).map((n) => n.id));
        if (selectedNodeIds.size === 0) return current;

        setEdges((eds) =>
          eds.filter(
            (ed) =>
              !ed.selected &&
              !selectedNodeIds.has(ed.source) &&
              !selectedNodeIds.has(ed.target),
          ),
        );

        onSelectItem?.("node", null);
        return current.filter((n) => !selectedNodeIds.has(n.id));
      });

      setEdges((current) => current.filter((edge) => !edge.selected));
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onSelectItem]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current) as Node<NodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    edgeReconnectSuccessful.current = true;
    setEdges((current) => reconnectEdge(oldEdge, connection, current));
  }, []);

  const onReconnectEnd = useCallback((_: MouseEvent | TouchEvent, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      setEdges((current) => current.filter((item) => item.id !== edge.id));
    }
  }, []);

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    return !!connection.source && !!connection.target && isConnectionValid(connection.source, connection.target);
  }, []);

  const onConnectStart = useCallback((_: any, params: { nodeId: string | null }) => {
    if (!params.nodeId) {
      return;
    }
    const compatible = new Set(getRelatedNodeIds(params.nodeId));
    setNodes((current) =>
      current.map((node) =>
        node.id === params.nodeId
          ? node
          : { ...node, data: { ...node.data, connectState: compatible.has(node.id) ? "compatible" : "incompatible" } },
      ),
    );
  }, []);

  const onConnectEnd = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, connectState: null } })));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }
    const relationType = getRelationshipType(connection.source, connection.target);
    const definition = RELATIONSHIP_DEFS[relationType] ?? RELATIONSHIP_DEFS.relates;
    const isInterop = definition.category === "interoperation";
    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      label: relationType,
      type: "ontology",
      animated: isInterop,
      style: {
        stroke: definition.stroke,
        strokeWidth: definition.strokeWidth,
        strokeDasharray: isInterop ? definition.strokeDasharray ?? "5,4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: definition.stroke, width: 16, height: 16 },
      reconnectable: true,
      data: { relType: relationType, category: definition.category },
    };
    setEdges((current) => addEdge(newEdge, current));
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<NodeData>) => {
    const related = getRelatedNodeIds(node.id);
    setNodes((current) =>
      current.map((item) => ({
        ...item,
        selected: item.id === node.id,
        data: { ...item.data, isRelated: related.includes(item.id), connectState: null },
      })),
    );
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false, zIndex: 0 })));
    onSelectItem?.("node", node);
  }, [onSelectItem]);

  const onEdgeClick = useCallback((_: React.MouseEvent, clickedEdge: Edge) => {
    setNodes((current) => current.map((node) => ({ ...node, selected: false, data: { ...node.data, isRelated: false } })));
    setTimeout(() => {
      setEdges((current) => {
        const stacked = current
          .filter((edge) => edge.source === clickedEdge.source && edge.target === clickedEdge.target)
          .sort((a, b) => a.id.localeCompare(b.id));
        if (stacked.length > 1) {
          const currentIndex = stacked.findIndex((edge) => edge.id === clickedEdge.id);
          const next = stacked[(currentIndex + 1) % stacked.length];
          return current.map((edge) => ({ ...edge, selected: edge.id === next.id, zIndex: edge.id === next.id ? 1000 : 0 }));
        }
        return current.map((edge) => ({ ...edge, selected: edge.id === clickedEdge.id, zIndex: edge.id === clickedEdge.id ? 1000 : 0 }));
      });
    }, 10);
    onSelectItem?.("edge", clickedEdge);
  }, [onSelectItem]);

  const onPaneClick = useCallback(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: false,
        data: { ...node.data, isRelated: false, connectState: null },
      })),
    );
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false, zIndex: 0 })));
    onSelectItem?.("node", null);
  }, [onSelectItem]);

  const onLayout = useCallback(() => {
    const layout = getLayoutedElements(nodes, edges);
    setNodes(syncPortStates(layout.nodes, layout.edges));
    setEdges(layout.edges);
  }, [edges, nodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const treeNode = resolveDroppedTreeNode(event);
    if (!treeNode) {
      return;
    }
    if (treeNode.type === "folder") {
      return;
    }

    const graphTypeMap: Record<string, NodeType> = {
      ontology: "entity",
      dimension: "dimension",
      rule: "event",
    };
    const existingNode = nodes.find((node) => node.id === treeNode.id);
    if (existingNode) {
      fitView({
        nodes: [existingNode],
        duration: 400,
        padding: 0.5,
      });
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: node.id === treeNode.id,
          data: { ...node.data, isRelated: false, connectState: null },
        })),
      );
      onSelectItem?.("node", existingNode);
      return;
    }

    const nodeType = graphTypeMap[treeNode.type] ?? "entity";
    const newNode: Node<NodeData> = {
      id: treeNode.id,
      position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      type: "custom",
      data: {
        id: treeNode.id,
        label: treeNode.name,
        type: nodeType,
        description: treeNode.prefix ? `${treeNode.prefix}${treeNode.name}` : "",
        properties: defaultPropertiesForNodeType(nodeType),
        actions: [],
      },
    };
    setNodes((current) => syncPortStates([...current, newNode], edges));
    onSelectItem?.("node", newNode);
  }, [edges, fitView, nodes, onSelectItem, screenToFlowPosition]);

  const nodeTypes = useMemo(() => ({ custom: OntologyNode }), []);
  const edgeTypes = useMemo(() => ({ ontology: OntologyEdge }), []);

  return (
    <div className="relative w-full h-full bg-background" onDragOver={onDragOver} onDrop={onDrop}>
      <style>{GRAPH_CSS}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineComponent={MagneticConnectionLine as any}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} color="var(--color-border)" gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <RelationLegend />
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={onLayout}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors bg-card/90 border border-border text-muted-foreground hover:bg-accent hover:text-foreground backdrop-blur shadow-xl"
        >
          <LayoutTemplate size={16} />
          Re-layout
        </button>
      </div>
    </div>
  );
}

export default function OntologyGraph({ onSelectItem }: { onSelectItem?: (type: "node" | "edge", data: any) => void }) {
  return (
    <ReactFlowProvider>
      <OntologyGraphInner onSelectItem={onSelectItem} />
    </ReactFlowProvider>
  );
}
