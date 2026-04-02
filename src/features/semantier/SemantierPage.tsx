import { useEffect, useMemo, useState, type ReactNode } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import "reactflow/dist/style.css";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleDot,
  FileCode2,
  GitBranch,
  History,
  Info,
  Layers3,
  Link2,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      {
        id: "milestone",
        name: "Milestone",
        type: "ontology",
        prefix: "core:",
        version: "v1.0",
        description: "Tracks contractual delivery checkpoints and acceptance criteria.",
        properties: [
          { name: "milestoneId", type: "string", required: true },
          { name: "contractId", type: "string", required: true },
          { name: "status", type: "enum", required: true },
          { name: "targetDate", type: "date", required: false },
        ],
        actions: ["schedule", "complete", "reopen"],
        snippet: `MAP core:Milestone {\n  milestoneId: string @primary\n  contractId: string\n  status: enum\n  targetDate: date?\n}`,
      },
      {
        id: "payment",
        name: "Payment",
        type: "ontology",
        prefix: "core:",
        version: "v2.0",
        description: "Represents payment settlement events tied to invoices and contracts.",
        properties: [
          { name: "paymentId", type: "string", required: true },
          { name: "invoiceId", type: "string", required: true },
          { name: "settlementAmount", type: "decimal", required: true },
          { name: "settlementDate", type: "date", required: true },
        ],
        actions: ["settle", "refund", "reverse"],
        snippet: `MAP core:Payment {\n  paymentId: string @primary\n  invoiceId: string\n  settlementAmount: decimal\n  settlementDate: date\n}`,
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
        snippet: `MAP fin:GeneralLedger {\n  accountCode: string\n  debit: decimal\n  credit: decimal\n}`,
      },
      {
        id: "journal",
        name: "JournalEntry",
        type: "ontology",
        prefix: "fin:",
        version: "v2.1",
        description: "Atomic bookkeeping entry generated from business and accounting events.",
        properties: [
          { name: "entryId", type: "string", required: true },
          { name: "ledgerCode", type: "string", required: true },
          { name: "amount", type: "decimal", required: true },
          { name: "postedAt", type: "date", required: true },
        ],
        actions: ["draft", "post", "reverse"],
        snippet: `MAP fin:JournalEntry {\n  entryId: string @primary\n  ledgerCode: string\n  amount: decimal\n  postedAt: date\n}`,
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
        snippet: `MAP tax:TaxObligation {\n  taxType: enum\n  taxableAmount: decimal\n  dueDate: date\n}`,
      },
      {
        id: "deduction",
        name: "DeductionRule",
        type: "ontology",
        prefix: "tax:",
        version: "v2.0",
        description: "Tax deduction logic used to evaluate credits, offsets, and compliance constraints.",
        properties: [
          { name: "ruleId", type: "string", required: true },
          { name: "jurisdiction", type: "string", required: true },
          { name: "deductionRate", type: "decimal", required: true },
          { name: "effectiveDate", type: "date", required: true },
        ],
        actions: ["evaluate", "apply", "retire"],
        snippet: `MAP tax:DeductionRule {\n  ruleId: string @primary\n  jurisdiction: string\n  deductionRate: decimal\n  effectiveDate: date\n}`,
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
        actions: ["authenticate", "authorize", "audit"],
        snippet: `DIMENSION core:Actor {\n  actorId: string\n  name: string\n  role: enum\n}`,
      },
      {
        id: "project",
        name: "Project",
        type: "dimension",
        prefix: "mgt:",
        description: "Management dimension used for project-based planning and budget control.",
        properties: [
          { name: "projectId", type: "string", required: true },
          { name: "projectCode", type: "string", required: true },
          { name: "status", type: "enum", required: true },
        ],
        snippet: `DIMENSION mgt:Project {\n  projectId: string\n  projectCode: string\n  status: enum\n}`,
      },
      {
        id: "cost_center",
        name: "CostCenter",
        type: "dimension",
        prefix: "mgt:",
        description: "Management accounting cost attribution dimension.",
        properties: [
          { name: "centerId", type: "string", required: true },
          { name: "name", type: "string", required: true },
          { name: "budget", type: "decimal", required: false },
        ],
        snippet: `DIMENSION mgt:CostCenter {\n  centerId: string\n  name: string\n  budget: decimal?\n}`,
      },
      {
        id: "timeperiod",
        name: "TimePeriod",
        type: "dimension",
        prefix: "core:",
        description: "Canonical reporting period dimension for ledgers, tax, and operational events.",
        properties: [
          { name: "periodId", type: "string", required: true },
          { name: "startDate", type: "date", required: true },
          { name: "endDate", type: "date", required: true },
        ],
        snippet: `DIMENSION core:TimePeriod {\n  periodId: string\n  startDate: date\n  endDate: date\n}`,
      },
    ],
  },
  {
    id: "custom-dimensions",
    name: "Custom Dimensions",
    type: "folder",
    children: [
      {
        id: "region",
        name: "Region",
        type: "dimension",
        prefix: "ext:",
        description: "External geographic segmentation dimension used in tax and revenue policy.",
        properties: [
          { name: "regionCode", type: "string", required: true },
          { name: "country", type: "string", required: true },
        ],
        snippet: `DIMENSION ext:Region {\n  regionCode: string\n  country: string\n}`,
      },
      {
        id: "product",
        name: "ProductLine",
        type: "dimension",
        prefix: "ext:",
        description: "External product hierarchy dimension for revenue and margin analysis.",
        properties: [
          { name: "productLineId", type: "string", required: true },
          { name: "category", type: "string", required: true },
        ],
        snippet: `DIMENSION ext:ProductLine {\n  productLineId: string\n  category: string\n}`,
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
        description: "Execution rule linking completed contracts to revenue and tax evaluation.",
        snippet: `WHEN core:Contract.status CHANGES TO "completed":\n  TRIGGER fin:RevenueRecognition {\n    amount: Contract.amount,\n    recognitionDate: NOW()\n  }\n\n  EVALUATE tax:TaxObligation {\n    taxableAmount: Contract.amount\n  }`,
      },
      {
        id: "invoice-to-ledger",
        name: "InvoiceToLedger",
        type: "rule",
        description: "Posts journal entries after invoice settlement.",
        snippet: `WHEN core:Invoice.status CHANGES TO "settled":\n  TRIGGER fin:JournalEntry {\n    amount: Invoice.grossAmount,\n    postedAt: NOW()\n  }\n\n  UPDATE fin:GeneralLedger {\n    accountCode: Invoice.accountCode\n  }`,
      },
      {
        id: "payment-to-tax",
        name: "PaymentToTax",
        type: "rule",
        description: "Evaluates downstream tax obligations when payments are settled.",
        snippet: `WHEN core:Payment.status CHANGES TO "settled":\n  EVALUATE tax:TaxObligation {\n    taxableAmount: Payment.settlementAmount,\n    dueDate: DERIVE_DUE_DATE(Payment.settlementDate)\n  }`,
      },
    ],
  },
  {
    id: "automation-rules",
    name: "Automation Rules",
    type: "folder",
    children: [
      {
        id: "auto-journal-entry",
        name: "AutoJournalEntry",
        type: "rule",
        description: "Automatically drafts ledger entries from validated revenue events.",
        snippet: `WHEN fin:RevenueRecognition.validated IS true:\n  TRIGGER fin:JournalEntry {\n    amount: RevenueRecognition.amount,\n    postedAt: NOW()\n  }`,
      },
      {
        id: "tax-trigger",
        name: "TaxTrigger",
        type: "rule",
        description: "Triggers deduction and tax checks from contract completion signals.",
        snippet: `WHEN core:Contract.status CHANGES TO "completed":\n  EVALUATE tax:DeductionRule {\n    jurisdiction: Contract.region\n  }\n\n  TRIGGER tax:TaxObligation {\n    taxableAmount: Contract.amount\n  }`,
      },
    ],
  },
];

const initialEditorValue = `// Semantier starter\nMAP core:Contract {\n  contractId: string @primary\n  amount: decimal\n  status: enum\n  signDate: date?\n}\n\nDIMENSION mgt:CostCenter {\n  centerId: string\n  name: string\n  budget: decimal?\n}`;

const executionRulesCode = `WHEN core:Contract.status CHANGES TO "completed":\n  TRIGGER fin:RevenueRecognition {\n    amount: Contract.amount,\n    recognitionDate: NOW(),\n    method: DERIVE_FROM(Contract.type)\n  }\n\n  EVALUATE tax:TaxObligation {\n    taxableAmount: Contract.amount,\n    taxType: DERIVE_FROM(Contract.region)\n  }\n\n  RECONCILE {\n    fin:RevenueRecognition.amount == tax:TaxObligation.taxableAmount\n  }`;

const reconciliationAlerts = [
  {
    id: "1",
    type: "warning" as const,
    domain: "管理会计",
    message: "此修改将导致管理会计分摊额与财务总账数额产生不勾稽",
    delta: "¥12,000",
  },
  {
    id: "2",
    type: "info" as const,
    domain: "税务",
    message: "税务义务已根据新规则 tax:DeductionRule_v2 自动更新",
  },
  {
    id: "3",
    type: "error" as const,
    domain: "财务",
    message: "收入确认时间点违反 ASC 606 准则要求",
  },
];

const versionHistory = [
  { version: "v2.1.0", date: "2024-03-15", author: "系统", changes: "添加 signDate 可选属性" },
  { version: "v2.0.0", date: "2024-02-01", author: "张明", changes: "重构 amount 字段精度" },
  { version: "v1.5.0", date: "2024-01-10", author: "李华", changes: "新增 status 枚举值" },
  { version: "v1.0.0", date: "2023-12-01", author: "系统", changes: "初始版本" },
];

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
            "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
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
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="border-b border-sidebar-border p-3">
        <div className="mb-3 flex items-center gap-2">
          <Layers3 className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">Resource Explorer</div>
            <div className="text-xs text-muted-foreground">Ontology, dimensions, and rules</div>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources"
            className="h-8 border-sidebar-border bg-sidebar-accent pl-9 text-sm"
          />
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as ExplorerTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-auto w-full justify-start rounded-none border-b border-sidebar-border bg-transparent p-0">
          <TabsTrigger value="ontology" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <BookOpen className="h-3.5 w-3.5" />
            Ontology
          </TabsTrigger>
          <TabsTrigger value="dimensions" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <GitBranch className="h-3.5 w-3.5" />
            Dimensions
          </TabsTrigger>
          <TabsTrigger value="rules" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <Workflow className="h-3.5 w-3.5" />
            Rules
          </TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="m-0 min-h-0 flex-1 overflow-auto p-2">
          <div className="space-y-1">{groups[activeTab].map((node) => renderNode(node))}</div>
        </TabsContent>
      </Tabs>
    </div>
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
  const actions = graphData?.actions || selectedItem?.actions || [];
  const identityLabel =
    graphSelection?.type === "node"
      ? graphData?.type
      : graphSelection?.type === "edge"
        ? edgeData?.data?.category
        : [selectedItem?.prefix, selectedItem?.version].filter(Boolean).join(" ");

  return (
    <div className="flex h-full flex-col bg-sidebar border-l border-sidebar-border">
      <Tabs defaultValue="properties" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-auto w-full justify-start rounded-none border-b border-sidebar-border bg-transparent p-0">
          <TabsTrigger value="properties" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <Settings2 className="h-3.5 w-3.5" />
            属性
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <Link2 className="h-3.5 w-3.5" />
            勾稽
            <span className="ml-1 rounded bg-destructive px-1 py-0 text-[10px] font-semibold text-destructive-foreground">
              {reconciliationAlerts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="versions" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <History className="h-3.5 w-3.5" />
            版本
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="m-0 flex-1 overflow-auto p-3">
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card/60 p-3">
              <div className="flex items-center gap-2 text-primary">
                <Settings2 className="h-4 w-4" />
                <span className="text-sm font-medium">Inspector</span>
              </div>
              <div className="mt-3 text-lg font-semibold text-sidebar-foreground">{title || "Select a resource"}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description || "Choose an ontology item, graph node, or edge to inspect its contract."}
              </div>
            </div>

            {graphSelection?.type === "edge" && (
                <Card className="gap-3 rounded-md py-4">
                <CardContent className="px-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Relationship</div>
                  <div className="mt-3 text-sm font-semibold text-foreground">{edgeData?.source} {"->"} {edgeData?.target}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{edgeData?.data?.category}</div>
                </CardContent>
              </Card>
            )}

            {(title || identityLabel) && (
                <Card className="gap-3 rounded-md py-4">
                <CardContent className="px-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Identity</div>
                  <div className="mt-3 space-y-1 text-sm font-semibold text-foreground">
                    {title && <div>{title}</div>}
                    {identityLabel && <div className="text-xs font-normal text-muted-foreground">{identityLabel}</div>}
                  </div>
                </CardContent>
              </Card>
            )}

            {propertyRows.length > 0 ? (
                <Card className="gap-3 rounded-md py-4">
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
            ) : (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-4 py-10 text-center">
                <Settings2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">选择一个资源查看属性</p>
              </div>
            )}

            {actions.length > 0 && (
              <Card className="gap-3 py-4">
                <CardContent className="px-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {actions.map((action: string) => (
                      <div key={action} className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">
                        {action}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reconciliation" className="m-0 flex-1 overflow-auto">
          <div className="border-b border-border bg-card/50 p-3">
            <h3 className="text-sm font-medium">实时勾稽检查</h3>
            <p className="mt-1 text-xs text-muted-foreground">监测跨域数据一致性，确保业财税三位一体</p>
          </div>
          <div className="space-y-3 p-3">
            {reconciliationAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={[
                    "rounded-md border p-3",
                  alert.type === "warning" ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/8" : "",
                  alert.type === "error" ? "border-destructive/40 bg-destructive/8" : "",
                  alert.type === "info" ? "border-[var(--status-info)]/40 bg-[var(--status-info)]/8" : "",
                ].join(" ")}
              >
                <div className="flex items-start gap-2">
                  {alert.type === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />}
                  {alert.type === "error" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  {alert.type === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-info)]" />}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded border px-1.5 py-0 text-[10px] text-muted-foreground">{alert.domain}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground">{alert.message}</p>
                    {alert.delta && <p className="mt-2 text-sm font-semibold text-[var(--status-warning)]">差额: {alert.delta}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-sidebar-border p-3">
            <Button variant="outline" size="sm" className="w-full text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              重新检查全部
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="m-0 flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">版本历史</span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">语义版本控制</span>
            </div>
            <div className="space-y-2">
              {versionHistory.map((entry, index) => (
                <div
                  key={entry.version}
                  className={[
                    "rounded-md border p-3",
                    index === 0 ? "border-primary/40 bg-primary/6" : "border-border",
                  ].join(" ")}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${index === 0 ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}>
                      {entry.version}
                    </span>
                    {index === 0 && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    <span className="ml-auto text-xs text-muted-foreground">{entry.date}</span>
                  </div>
                  <p className="text-xs text-foreground">{entry.changes}</p>
                  <p className="mt-1 text-xs text-muted-foreground">by {entry.author}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="border-t border-sidebar-border p-3">
        <Button variant="secondary" size="sm" className="w-full text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          AI 自动对齐
        </Button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          导入非标准数据，AI 自动对齐到 Semantier 维度
        </p>
      </div>
    </div>
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Layers3 className="h-4 w-4" />
            </div>
            <span className="font-semibold text-foreground">Semantier Studio</span>
            <div className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">Beta</div>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">
            Ontology objects define structure. Execution rules stay in a separate layer.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setEditorValue(executionRulesCode);
              setWorkspaceTab("rules");
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Load rules
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setValidationState("passed")}>
            <Play className="h-3.5 w-3.5" />
            Validate
          </Button>
        </div>
      </header>

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
            <div className="flex h-full min-h-0 flex-col bg-[var(--editor-bg)]">
              <div className="flex items-center justify-between border-b bg-card px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {selectedItem ? (
                      <>
                        <span className="text-muted-foreground">{selectedItem.prefix ?? ""}</span>
                        {selectedItem.name}
                      </>
                    ) : (
                      "Semantic Workspace"
                    )}
                  </span>
                  {selectedItem?.version && (
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {selectedItem.version}
                    </span>
                  )}
                </div>
                <div className={`text-xs font-medium ${validationState === "passed" ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {validationState === "passed" ? "Validation passed" : "Validation idle"}
                </div>
              </div>
              <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <TabsList className="h-auto w-full justify-start rounded-none border-b bg-card px-4 py-0">
                  <TabsTrigger value="graph" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent">
                    <GitBranch className="h-4 w-4" />
                    Graph Modeling
                  </TabsTrigger>
                  <TabsTrigger value="rules" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent">
                    <Workflow className="h-4 w-4" />
                    Execution Rules
                  </TabsTrigger>
                  <TabsTrigger value="editor" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent">
                    <FileCode2 className="h-4 w-4" />
                    Code View
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="graph" className="relative m-0 min-h-0 flex-1 overflow-hidden">
                  <OntologyGraph onSelectItem={handleGraphSelectItem} />
                </TabsContent>
                <TabsContent value="rules" className="m-0 min-h-0 flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    language={SDSL_LANGUAGE_ID}
                    theme="semantier-langconfig"
                    value={executionRulesCode}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      roundedSelection: true,
                      automaticLayout: true,
                      readOnly: true,
                    }}
                  />
                </TabsContent>
                <TabsContent value="editor" className="m-0 min-h-0 flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    language={SDSL_LANGUAGE_ID}
                    theme="semantier-langconfig"
                    value={editorValue}
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
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={400} minSize={300} maxSize={500}>
            <InspectorPane selectedItem={selectedItem} graphSelection={graphSelection} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <footer className="flex h-6 items-center justify-between border-t bg-card px-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Workspace: default</span>
          <span>Ontology: {ontologyData.flatMap((group) => group.children ?? []).length} objects</span>
          <span>Dimensions: {dimensionData.flatMap((group) => group.children ?? []).length} definitions</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${validationState === "passed" ? "bg-emerald-400" : "bg-[var(--status-warning)]"}`} />
            {validationState === "passed" ? "Validated" : "Draft"}
          </span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
