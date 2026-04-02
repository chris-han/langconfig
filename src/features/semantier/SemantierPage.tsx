import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import "reactflow/dist/style.css";
import {
  BookOpen,
  CircleDot,
  FileCode2,
  GitBranch,
  Layers3,
  Play,
  Search,
  Settings2,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  SDSL_LANGUAGE_ID,
  languageConfiguration,
  monarchTokensProvider,
  semantierTheme,
} from "./sdslLanguage";
import OntologyGraph from "./OntologyGraph";

type ResourceType = "folder" | "ontology" | "dimension" | "rule";
type ExplorerTab = "ontology" | "dimensions" | "rules";
type WorkspaceTab = "editor" | "logic" | "graph";
type GraphSelection = { type: "node" | "edge"; data: any } | null;

interface TreeNode {
  id: string;
  name: string;
  type: ResourceType;
  prefix?: string;
  version?: string;
  description?: string;
  properties?: Array<{ name: string; type: string; required: boolean }>;
  actions?: string[];
  children?: TreeNode[];
  snippet?: string;
}

const ontologyData: TreeNode[] = [
  {
    id: "core",
    name: "Core Business",
    type: "folder",
    children: [
      {
        id: "contract",
        name: "Contract",
        type: "ontology",
        prefix: "core:",
        version: "v1.5",
        description: "Legally binding agreement between parties.",
        properties: [
          { name: "contractId", type: "string", required: true },
          { name: "amount", type: "decimal", required: true },
          { name: "status", type: "enum", required: true },
          { name: "signDate", type: "date", required: false },
        ],
        actions: ["sign", "amend", "terminate"],
        snippet: `MAP core:Contract {\n  contractId: string @primary\n  amount: decimal\n  status: enum\n  signDate: date?\n}`,
      },
      {
        id: "invoice",
        name: "Invoice",
        type: "ontology",
        prefix: "core:",
        version: "v2.1",
        description: "Commercial document representing billable demand.",
        properties: [
          { name: "invoiceId", type: "string", required: true },
          { name: "dueDate", type: "date", required: true },
          { name: "grossAmount", type: "decimal", required: true },
        ],
        snippet: `MAP core:Invoice {\n  invoiceId: string @primary\n  dueDate: date\n  grossAmount: decimal\n}`,
      },
    ],
  },
  {
    id: "finance",
    name: "Financial Domain",
    type: "folder",
    children: [
      {
        id: "revenue",
        name: "RevenueRecognition",
        type: "ontology",
        prefix: "fin:",
        version: "v1.2",
        description: "Captures how and when revenue becomes recognized.",
        properties: [
          { name: "recognitionDate", type: "date", required: true },
          { name: "amount", type: "decimal", required: true },
          { name: "method", type: "enum", required: true },
        ],
        actions: ["recognize", "defer", "reverse"],
        snippet: `MAP fin:RevenueRecognition {\n  recognitionDate: date\n  amount: decimal\n  method: enum\n}`,
      },
      {
        id: "ledger",
        name: "GeneralLedger",
        type: "ontology",
        prefix: "fin:",
        version: "v3.0",
        description: "Normalized accounting ledger entries.",
        properties: [
          { name: "accountCode", type: "string", required: true },
          { name: "debit", type: "decimal", required: true },
          { name: "credit", type: "decimal", required: true },
        ],
        actions: ["post", "reconcile", "close"],
      },
    ],
  },
  {
    id: "tax",
    name: "Tax Domain",
    type: "folder",
    children: [
      {
        id: "obligation",
        name: "TaxObligation",
        type: "ontology",
        prefix: "tax:",
        version: "v1.8",
        description: "Tax liabilities created by revenue or invoice events.",
        properties: [
          { name: "taxType", type: "enum", required: true },
          { name: "taxableAmount", type: "decimal", required: true },
          { name: "dueDate", type: "date", required: true },
        ],
        actions: ["calculate", "file", "defer"],
      },
    ],
  },
];

const dimensionData: TreeNode[] = [
  {
    id: "standard-dimensions",
    name: "Standard Dimensions",
    type: "folder",
    children: [
      {
        id: "actor",
        name: "Actor",
        type: "dimension",
        prefix: "core:",
        description: "Party participating in an agreement or workflow.",
        properties: [
          { name: "actorId", type: "string", required: true },
          { name: "name", type: "string", required: true },
          { name: "role", type: "enum", required: true },
        ],
      },
      {
        id: "cost_center",
        name: "CostCenter",
        type: "dimension",
        prefix: "mgt:",
        description: "Management accounting cost attribution dimension.",
        properties: [
          { name: "centerId", type: "string", required: true },
          { name: "budget", type: "decimal", required: false },
        ],
      },
    ],
  },
];

const ruleData: TreeNode[] = [
  {
    id: "reconciliation-rules",
    name: "Reconciliation Rules",
    type: "folder",
    children: [
      {
        id: "contract-to-revenue",
        name: "ContractToRevenue",
        type: "rule",
        description: "Ensures contract completion drives recognized revenue and tax obligations.",
        snippet: `WHEN core:Contract.status CHANGES TO "completed":\n  TRIGGER fin:RevenueRecognition {\n    amount: Contract.amount,\n    recognitionDate: NOW()\n  }\n\n  EVALUATE tax:TaxObligation {\n    taxableAmount: Contract.amount\n  }`,
      },
      {
        id: "invoice-to-ledger",
        name: "InvoiceToLedger",
        type: "rule",
        description: "Posts journal entries after invoice settlement.",
      },
    ],
  },
];

const initialEditorValue = `// Semantier starter\nMAP core:Contract {\n  contractId: string @primary\n  amount: decimal\n  status: enum\n  signDate: date?\n}\n\nDIMENSION mgt:CostCenter {\n  centerId: string\n  budget: decimal?\n}`;

const logicWeaveCode = `WHEN core:Contract.status CHANGES TO "completed":\n  TRIGGER fin:RevenueRecognition {\n    amount: Contract.amount,\n    recognitionDate: NOW(),\n    method: DERIVE_FROM(Contract.type)\n  }\n\n  EVALUATE tax:TaxObligation {\n    taxableAmount: Contract.amount,\n    taxType: DERIVE_FROM(Contract.region)\n  }\n\n  RECONCILE {\n    fin:RevenueRecognition.amount == tax:TaxObligation.taxableAmount\n  }`;

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flattenTree(node.children) : [])]);
}

function ExplorerPane({
  groups,
  activeTab,
  onTabChange,
  selectedItem,
  onSelectItem,
}: {
  groups: Record<ExplorerTab, TreeNode[]>;
  activeTab: ExplorerTab;
  onTabChange: (tab: ExplorerTab) => void;
  selectedItem: TreeNode | null;
  onSelectItem: (node: TreeNode) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(groups[activeTab].map((node) => node.id)));

  useEffect(() => {
    setExpandedIds(new Set(groups[activeTab].map((node) => node.id)));
  }, [activeTab, groups]);

  const normalizedQuery = query.trim().toLowerCase();

  const matchesNode = (node: TreeNode): boolean => {
    if (!normalizedQuery) {
      return true;
    }
    const selfMatches = [node.name, node.prefix, node.description].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    return selfMatches || !!node.children?.some(matchesNode);
  };

  const filtered = groups[activeTab].filter(matchesNode);

  const renderNode = (node: TreeNode, level = 0) => {
    if (!matchesNode(node)) {
      return null;
    }

    const isFolder = node.type === "folder";
    const expanded = expandedIds.has(node.id);
    const selected = selectedItem?.id === node.id;

    return (
      <div key={node.id}>
        <button
          draggable={!isFolder}
          onDragStart={(event) => {
            if (isFolder) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.setData("application/semantier-node", JSON.stringify(node));
            event.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => {
            if (isFolder) {
              setExpandedIds((current) => {
                const next = new Set(current);
                if (next.has(node.id)) {
                  next.delete(node.id);
                } else {
                  next.add(node.id);
                }
                return next;
              });
            } else {
              onSelectItem(node);
            }
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            paddingLeft: `${14 + level * 18}px`,
            borderRadius: 14,
            border: selected ? "1px solid rgba(46, 92, 138, 0.35)" : "1px solid transparent",
            background: selected ? "rgba(46, 92, 138, 0.12)" : "transparent",
            color: "var(--color-text-primary)",
            textAlign: "left",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, color: "var(--color-text-muted)", transform: isFolder && expanded ? "rotate(90deg)" : "none" }}
          >
            chevron_right
          </span>
          {!isFolder && node.type === "ontology" && <FileCode2 size={16} color="var(--color-primary)" />}
          {!isFolder && node.type === "dimension" && <CircleDot size={16} color="#0F766E" />}
          {!isFolder && node.type === "rule" && <Workflow size={16} color="#C2410C" />}
          {isFolder && <Layers3 size={16} color="var(--color-primary)" />}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: isFolder ? 700 : 600 }}>{node.name}</span>
            {!isFolder && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {[node.prefix, node.version].filter(Boolean).join(" ")}
              </span>
            )}
          </div>
        </button>
        {isFolder && expanded && node.children?.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  const tabButton = (tab: ExplorerTab, label: string, icon: ReactNode) => (
    <button
      onClick={() => onTabChange(tab)}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 14,
        border: activeTab === tab ? "1px solid rgba(46, 92, 138, 0.3)" : "1px solid transparent",
        background: activeTab === tab ? "rgba(46, 92, 138, 0.12)" : "transparent",
        color: activeTab === tab ? "var(--color-primary)" : "var(--color-text-muted)",
        fontWeight: 600,
      }}
    >
      {icon}
      <span style={{ fontSize: 12 }}>{label}</span>
    </button>
  );

  return (
    <aside
      style={{
        width: 300,
        minWidth: 300,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(46, 92, 138, 0.12)",
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ padding: 18, borderBottom: "1px solid rgba(46, 92, 138, 0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: "linear-gradient(135deg, #2E5C8A, #6B9E7E)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Layers3 size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>Semantier Explorer</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Ontology, dimensions, and rules</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(46, 92, 138, 0.14)",
          }}
        >
          <Search size={16} color="var(--color-text-muted)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search semantic resources"
            style={{
              flex: 1,
              border: 0,
              outline: "none",
              background: "transparent",
              color: "var(--color-text-primary)",
              fontSize: 13,
            }}
          />
        </div>
      </div>
      <div style={{ padding: 14, display: "flex", gap: 8 }}>
        {tabButton("ontology", "Ontology", <BookOpen size={15} />)}
        {tabButton("dimensions", "Dimensions", <GitBranch size={15} />)}
        {tabButton("rules", "Rules", <Workflow size={15} />)}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 14px" }}>
        {filtered.map((node) => renderNode(node))}
      </div>
    </aside>
  );
}

function InspectorPane({ selectedItem, graphSelection }: { selectedItem: TreeNode | null; graphSelection: GraphSelection }) {
  const graphData = graphSelection?.type === "node" ? graphSelection.data?.data : graphSelection?.data?.data;
  const edgeData = graphSelection?.type === "edge" ? graphSelection.data : null;

  const propertyRows = graphData?.properties || selectedItem?.properties || [];
  const title = graphSelection?.type === "node"
    ? graphData?.label
    : graphSelection?.type === "edge"
      ? edgeData?.label || edgeData?.data?.relType
      : selectedItem?.name;

  const description = graphSelection?.type === "node"
    ? graphData?.description
    : graphSelection?.type === "edge"
      ? edgeData?.data?.description
      : selectedItem?.description;

  return (
    <aside
      style={{
        width: 320,
        minWidth: 320,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(46, 92, 138, 0.12)",
        background: "rgba(255, 255, 255, 0.66)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ padding: 20, borderBottom: "1px solid rgba(46, 92, 138, 0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Settings2 size={18} color="var(--color-primary)" />
          <strong style={{ fontSize: 15, color: "var(--color-text-primary)" }}>Properties</strong>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {title || "Select a resource"}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--color-text-muted)" }}>
          {description || "Choose an explorer item, graph node, or edge to inspect its semantic contract."}
        </p>
      </div>

      <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {graphSelection?.type === "edge" && (
          <div style={cardStyle}>
            <div style={labelStyle}>Relationship</div>
            <div style={valueStyle}>{edgeData?.source} {"->"} {edgeData?.target}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
              {edgeData?.data?.category}
            </div>
          </div>
        )}

        {(selectedItem?.prefix || selectedItem?.version || graphSelection?.type === "node") && (
          <div style={cardStyle}>
            <div style={labelStyle}>Identity</div>
            <div style={valueStyle}>
              {selectedItem?.prefix && <div>{selectedItem.prefix}{selectedItem.name}</div>}
              {selectedItem?.version && <div style={{ marginTop: 6, color: "var(--color-text-muted)", fontSize: 12 }}>{selectedItem.version}</div>}
              {graphSelection?.type === "node" && <div>{graphData?.category}</div>}
            </div>
          </div>
        )}

        {propertyRows.length > 0 && (
          <div style={cardStyle}>
            <div style={labelStyle}>Fields</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {propertyRows.map((property: any) => (
                <div
                  key={property.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(46, 92, 138, 0.05)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{property.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{property.type}</div>
                  </div>
                  <div
                    style={{
                      alignSelf: "start",
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: property.required ? "#9A3412" : "#0F766E",
                      background: property.required ? "rgba(249, 115, 22, 0.14)" : "rgba(16, 185, 129, 0.14)",
                    }}
                  >
                    {property.required ? "required" : "optional"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!selectedItem?.actions?.length && (
          <div style={cardStyle}>
            <div style={labelStyle}>Actions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selectedItem.actions.map((action) => (
                <span
                  key={action}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-primary)",
                    background: "rgba(46, 92, 138, 0.1)",
                  }}
                >
                  {action}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={labelStyle}>Status</div>
          <div style={valueStyle}>Extraction mode: standalone</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
            OpenChamber session-specific tool integrations were intentionally excluded from this route.
          </div>
        </div>
      </div>
    </aside>
  );
}

const cardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "rgba(255, 255, 255, 0.92)",
  border: "1px solid rgba(46, 92, 138, 0.12)",
  boxShadow: "0 12px 28px rgba(17, 32, 49, 0.06)",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--color-text-muted)",
  marginBottom: 10,
  fontWeight: 700,
};

const valueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  lineHeight: 1.6,
};

export default function SemantierPage() {
  const monaco = useMonaco();
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("editor");
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>("ontology");
  const allResources = useMemo(() => flattenTree([...ontologyData, ...dimensionData, ...ruleData]), []);
  const [selectedItem, setSelectedItem] = useState<TreeNode | null>(allResources.find((node) => node.id === "contract") || null);
  const [graphSelection, setGraphSelection] = useState<GraphSelection>(null);
  const [editorValue, setEditorValue] = useState(initialEditorValue);
  const [validationState, setValidationState] = useState<"idle" | "passed">("idle");

  useEffect(() => {
    if (!monaco) {
      return;
    }

    const existing = monaco.languages.getLanguages().find((language) => language.id === SDSL_LANGUAGE_ID);
    if (!existing) {
      monaco.languages.register({ id: SDSL_LANGUAGE_ID, extensions: [".sdsl"] });
      monaco.languages.setMonarchTokensProvider(SDSL_LANGUAGE_ID, monarchTokensProvider as any);
      monaco.languages.setLanguageConfiguration(SDSL_LANGUAGE_ID, languageConfiguration as any);
    }

    monaco.editor.defineTheme("semantier-langconfig", semantierTheme);
  }, [monaco]);

  const explorerGroups = useMemo<Record<ExplorerTab, TreeNode[]>>(
    () => ({
      ontology: ontologyData,
      dimensions: dimensionData,
      rules: ruleData,
    }),
    [],
  );

  const handleSelectItem = (node: TreeNode) => {
    setSelectedItem(node);
    setGraphSelection(null);
    if (node.snippet) {
      setEditorValue(node.snippet);
      setWorkspaceTab("editor");
    }
  };

  const handleGraphSelectItem = (type: "node" | "edge", data: any) => {
    if (data === null) {
      setGraphSelection(null);
      return;
    }

    setGraphSelection({ type, data });

    if (type === "node") {
      const matchedItem = allResources.find((item) => item.id === data.id);
      if (matchedItem) {
        setSelectedItem(matchedItem);
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        background: "radial-gradient(circle at top left, rgba(107, 158, 126, 0.16), transparent 28%), linear-gradient(180deg, var(--color-background-light), var(--color-background-dark))",
      }}
    >
      <ExplorerPane
        groups={explorerGroups}
        activeTab={explorerTab}
        onTabChange={setExplorerTab}
        selectedItem={selectedItem}
        onSelectItem={handleSelectItem}
      />

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "22px 24px 18px",
            borderBottom: "1px solid rgba(46, 92, 138, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-primary)" }}>
              Hash Route
            </div>
            <h1 style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1.1, color: "var(--color-text-primary)" }}>Semantier</h1>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--color-text-muted)" }}>
              Extracted from OpenChamber as a standalone semantic modeling workspace for LangConfig.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => {
                setEditorValue(logicWeaveCode);
                setWorkspaceTab("logic");
              }}
              style={secondaryButtonStyle}
            >
              <Sparkles size={15} />
              Load logic weave
            </button>
            <button
              onClick={() => setValidationState("passed")}
              style={primaryButtonStyle}
            >
              <Play size={15} />
              Validate
            </button>
          </div>
        </div>

        <div style={{ padding: "14px 24px", display: "flex", gap: 10, alignItems: "center" }}>
          {(["editor", "logic", "graph"] as WorkspaceTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setWorkspaceTab(tab)}
              style={{
                ...secondaryButtonStyle,
                background: workspaceTab === tab ? "rgba(46, 92, 138, 0.12)" : "rgba(255, 255, 255, 0.72)",
                borderColor: workspaceTab === tab ? "rgba(46, 92, 138, 0.24)" : "rgba(46, 92, 138, 0.12)",
                color: workspaceTab === tab ? "var(--color-primary)" : "var(--color-text-primary)",
              }}
            >
              {tab === "editor" && <FileCode2 size={15} />}
              {tab === "logic" && <Sparkles size={15} />}
              {tab === "graph" && <GitBranch size={15} />}
              {tab === "editor" ? "SDSL Editor" : tab === "logic" ? "Logic Weave" : "Ontology Graph"}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 13, color: validationState === "passed" ? "#0F766E" : "var(--color-text-muted)", fontWeight: 600 }}>
            {validationState === "passed" ? "Validation passed" : "Validation idle"}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, padding: "0 24px 24px" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 24,
              overflow: "hidden",
              border: "1px solid rgba(46, 92, 138, 0.14)",
              boxShadow: "0 24px 50px rgba(17, 32, 49, 0.10)",
              background: "rgba(255, 255, 255, 0.72)",
            }}
          >
            {workspaceTab !== "graph" && (
              <Editor
                height="100%"
                language={SDSL_LANGUAGE_ID}
                theme="semantier-langconfig"
                value={workspaceTab === "logic" ? logicWeaveCode : editorValue}
                onChange={(value) => setEditorValue(value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  roundedSelection: true,
                  automaticLayout: true,
                }}
              />
            )}

            {workspaceTab === "graph" && (
              <OntologyGraph onSelectItem={handleGraphSelectItem} />
            )}
          </div>
        </div>
      </section>

      <InspectorPane selectedItem={selectedItem} graphSelection={graphSelection} />
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "11px 16px",
  borderRadius: 14,
  border: "1px solid rgba(46, 92, 138, 0.26)",
  background: "linear-gradient(135deg, #2E5C8A, #6B9E7E)",
  color: "white",
  fontSize: 13,
  fontWeight: 700,
  boxShadow: "0 14px 24px rgba(46, 92, 138, 0.18)",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "11px 14px",
  borderRadius: 14,
  border: "1px solid rgba(46, 92, 138, 0.12)",
  background: "rgba(255, 255, 255, 0.72)",
  color: "var(--color-text-primary)",
  fontSize: 13,
  fontWeight: 600,
};
