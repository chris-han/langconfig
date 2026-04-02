import { useEffect, useMemo, useState, type ReactNode } from "react";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OntologyGraph from "./OntologyGraph";
import {
  SDSL_LANGUAGE_ID,
  languageConfiguration,
  monarchTokensProvider,
  semantierTheme,
} from "./sdslLanguage";

type ResourceType = "folder" | "ontology" | "dimension" | "rule";
type ExplorerTab = "ontology" | "dimensions" | "rules";
type WorkspaceTab = "editor" | "rules" | "graph";
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
    name: "Execution Rules",
    type: "folder",
    children: [
      {
        id: "contract-to-revenue",
        name: "ContractToRevenue",
        type: "rule",
        description: "Execution rule linking completed contracts to revenue and tax evaluation.",
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

const executionRulesCode = `WHEN core:Contract.status CHANGES TO "completed":\n  TRIGGER fin:RevenueRecognition {\n    amount: Contract.amount,\n    recognitionDate: NOW(),\n    method: DERIVE_FROM(Contract.type)\n  }\n\n  EVALUATE tax:TaxObligation {\n    taxableAmount: Contract.amount,\n    taxType: DERIVE_FROM(Contract.region)\n  }\n\n  RECONCILE {\n    fin:RevenueRecognition.amount == tax:TaxObligation.taxableAmount\n  }`;

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

  const renderNode = (node: TreeNode, level = 0): ReactNode => {
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
          className={[
            "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
            selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            !isFolder ? "cursor-grab active:cursor-grabbing" : "",
          ].join(" ")}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <span className={`material-symbols-outlined text-base text-muted-foreground transition-transform ${isFolder && expanded ? "rotate-90" : ""}`}>
            chevron_right
          </span>
          {!isFolder && node.type === "ontology" && <FileCode2 className="h-4 w-4 text-primary" />}
          {!isFolder && node.type === "dimension" && <CircleDot className="h-4 w-4 text-sky-400" />}
          {!isFolder && node.type === "rule" && <Workflow className="h-4 w-4 text-amber-400" />}
          {isFolder && <Layers3 className="h-4 w-4 text-primary" />}
          <div className="min-w-0 flex-1">
            <div className={`truncate ${isFolder ? "font-semibold text-muted-foreground" : "font-medium text-foreground"}`}>{node.name}</div>
            {!isFolder && (
              <div className="truncate text-xs text-muted-foreground">
                {[node.prefix, node.version].filter(Boolean).join(" ")}
              </div>
            )}
          </div>
        </button>
        {isFolder && expanded && node.children?.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <Card className="h-full rounded-none border-y-0 border-l-0 gap-0 py-0 shadow-none">
      <CardHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Semantier Explorer</CardTitle>
            <CardDescription>Ontology structure and execution rules</CardDescription>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources"
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as ExplorerTab)} className="min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ontology"><BookOpen className="h-4 w-4" />Ontology</TabsTrigger>
            <TabsTrigger value="dimensions"><GitBranch className="h-4 w-4" />Dimensions</TabsTrigger>
            <TabsTrigger value="rules"><Workflow className="h-4 w-4" />Rules</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-3 min-h-0 flex-1 overflow-auto">
            <div className="space-y-1">{groups[activeTab].map((node) => renderNode(node))}</div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function InspectorPane({ selectedItem, graphSelection }: { selectedItem: TreeNode | null; graphSelection: GraphSelection }) {
  const graphData = graphSelection?.type === "node" ? graphSelection.data?.data : graphSelection?.data?.data;
  const edgeData = graphSelection?.type === "edge" ? graphSelection.data : null;
  const propertyRows = graphData?.properties || selectedItem?.properties || [];
  const title =
    graphSelection?.type === "node"
      ? graphData?.label
      : graphSelection?.type === "edge"
        ? edgeData?.label || edgeData?.data?.relType
        : selectedItem?.name;
  const description =
    graphSelection?.type === "node"
      ? graphData?.description
      : graphSelection?.type === "edge"
        ? edgeData?.data?.description
        : selectedItem?.description;

  return (
    <Card className="h-full rounded-none border-y-0 border-r-0 gap-0 py-0 shadow-none">
      <CardHeader className="border-b px-5 py-5">
        <div className="flex items-center gap-2 text-primary">
          <Settings2 className="h-4 w-4" />
          <span className="text-sm font-medium">Inspector</span>
        </div>
        <CardTitle className="text-2xl">{title || "Select a resource"}</CardTitle>
        <CardDescription>{description || "Choose an ontology item, graph node, or edge to inspect its contract."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-auto px-5 py-5">
        {graphSelection?.type === "edge" && (
          <Card className="gap-3 py-4">
            <CardContent className="px-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Relationship</div>
              <div className="mt-3 text-sm font-semibold text-foreground">{edgeData?.source} {"->"} {edgeData?.target}</div>
              <div className="mt-1 text-xs text-muted-foreground">{edgeData?.data?.category}</div>
            </CardContent>
          </Card>
        )}

        {(selectedItem?.prefix || selectedItem?.version || graphSelection?.type === "node") && (
          <Card className="gap-3 py-4">
            <CardContent className="px-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Identity</div>
              <div className="mt-3 space-y-1 text-sm font-semibold text-foreground">
                {selectedItem?.prefix && <div>{selectedItem.prefix}{selectedItem.name}</div>}
                {selectedItem?.version && <div className="text-xs font-normal text-muted-foreground">{selectedItem.version}</div>}
                {graphSelection?.type === "node" && <div>{graphData?.type}</div>}
              </div>
            </CardContent>
          </Card>
        )}

        {propertyRows.length > 0 && (
          <Card className="gap-3 py-4">
            <CardContent className="space-y-3 px-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fields</div>
              {propertyRows.map((property: any) => (
                <div key={property.name} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border bg-muted/40 px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{property.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{property.type}</div>
                  </div>
                  <div className={`self-start rounded-full px-2 py-1 text-[11px] font-semibold ${property.required ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                    {property.required ? "required" : "optional"}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!!selectedItem?.actions?.length && (
          <Card className="gap-3 py-4">
            <CardContent className="px-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedItem.actions.map((action) => (
                  <div key={action} className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">
                    {action}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

export default function SemantierPage() {
  const monaco = useMonaco();
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("graph");
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>("ontology");
  const explorerGroups = useMemo<Record<ExplorerTab, TreeNode[]>>(
    () => ({
      ontology: ontologyData,
      dimensions: dimensionData,
      rules: ruleData,
    }),
    [],
  );
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

  const handleSelectItem = (node: TreeNode) => {
    setSelectedItem(node);
    setGraphSelection(null);
    if (node.snippet) {
      setEditorValue(node.snippet);
      setWorkspaceTab(node.type === "rule" ? "rules" : "editor");
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
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="border-b bg-background/80 backdrop-blur">
        <div className="flex items-start justify-between gap-6 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Semantier Studio</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ontology and Rule Design</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Ontology objects define semantic structure. Execution rules live in a separate layer and are not treated as ontology objects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditorValue(executionRulesCode);
                setWorkspaceTab("rules");
              }}
            >
              <Sparkles className="h-4 w-4" />
              Load rule set
            </Button>
            <Button onClick={() => setValidationState("passed")}>
              <Play className="h-4 w-4" />
              Validate
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t px-6 py-3">
          <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)} className="w-auto">
            <TabsList>
              <TabsTrigger value="graph"><GitBranch className="h-4 w-4" />Graph</TabsTrigger>
              <TabsTrigger value="editor"><FileCode2 className="h-4 w-4" />Schema</TabsTrigger>
              <TabsTrigger value="rules"><Workflow className="h-4 w-4" />Execution Rules</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className={`ml-auto text-sm font-medium ${validationState === "passed" ? "text-emerald-400" : "text-muted-foreground"}`}>
            {validationState === "passed" ? "Validation passed" : "Validation idle"}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={400} minSize={300} maxSize={500}>
            <ExplorerPane
              groups={explorerGroups}
              activeTab={explorerTab}
              onTabChange={setExplorerTab}
              selectedItem={selectedItem}
              onSelectItem={handleSelectItem}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={55}>
            <div className="h-full min-h-0 p-4">
              <Card className="h-full gap-0 overflow-hidden py-0">
                <CardHeader className="border-b px-5 py-4">
                  <CardTitle className="text-lg">
                    {selectedItem ? (
                      <>
                        <span className="text-muted-foreground">{selectedItem.prefix ?? ""}</span>
                        {selectedItem.name}
                      </>
                    ) : (
                      "Semantic Workspace"
                    )}
                  </CardTitle>
                  <CardDescription>
                    {workspaceTab === "graph" && "Interactive ontology graph with drag, drop, reconnect, and re-layout."}
                    {workspaceTab === "editor" && "Schema editing surface for ontology definitions."}
                    {workspaceTab === "rules" && "Execution rule layer for triggers and reconciliation logic."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-full min-h-0 p-0">
                  {workspaceTab === "graph" && <OntologyGraph onSelectItem={handleGraphSelectItem} />}
                  {workspaceTab !== "graph" && (
                    <Editor
                      height="100%"
                      language={SDSL_LANGUAGE_ID}
                      theme="semantier-langconfig"
                      value={workspaceTab === "rules" ? executionRulesCode : editorValue}
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
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={400} minSize={300} maxSize={500}>
            <InspectorPane selectedItem={selectedItem} graphSelection={graphSelection} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
