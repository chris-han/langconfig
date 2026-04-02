import { useMemo } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface PythonCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string }) => void;
  readOnly?: boolean;
  minHeight?: string;
}

const langChainPythonCompletions = [
  {
    label: 'from langchain_openai import ChatOpenAI',
    kind: 'Keyword',
    insertText: 'from langchain_openai import ChatOpenAI',
    detail: 'LangChain import',
  },
  {
    label: 'from langchain.agents import AgentExecutor',
    kind: 'Keyword',
    insertText: 'from langchain.agents import AgentExecutor',
    detail: 'LangChain import',
  },
  {
    label: 'from langgraph.prebuilt import create_react_agent',
    kind: 'Keyword',
    insertText: 'from langgraph.prebuilt import create_react_agent',
    detail: 'LangGraph import',
  },
  {
    label: 'from langgraph.checkpoint.postgres import PostgresSaver',
    kind: 'Keyword',
    insertText: 'from langgraph.checkpoint.postgres import PostgresSaver',
    detail: 'LangGraph import',
  },
  {
    label: 'ChatOpenAI(...)',
    kind: 'Function',
    insertText: 'ChatOpenAI(model="${model}", temperature=${temperature}, max_tokens=${maxTokens})',
    detail: 'OpenAI-compatible chat model',
  },
  {
    label: 'create_react_agent(...)',
    kind: 'Function',
    insertText: 'create_react_agent(llm, tools, state_modifier=system_prompt)',
    detail: 'Build LangGraph react agent',
  },
  {
    label: 'AgentExecutor(...)',
    kind: 'Class',
    insertText: 'AgentExecutor(\n    agent=agent,\n    tools=tools,\n    checkpointer=checkpointer,\n    verbose=True,\n)',
    detail: 'Run the agent with tools',
  },
  {
    label: 'agent_executor.invoke(...)',
    kind: 'Method',
    insertText:
      'agent_executor.invoke(\n    {"messages": [("user", "${prompt}")]},\n    config={"configurable": {"thread_id": "${threadId}"}}\n)',
    detail: 'Execute the agent',
  },
  {
    label: 'system_prompt',
    kind: 'Variable',
    insertText: 'system_prompt',
    detail: 'System prompt string',
  },
  {
    label: 'tools',
    kind: 'Variable',
    insertText: 'tools',
    detail: 'Configured tool list',
  },
  {
    label: 'checkpointer',
    kind: 'Variable',
    insertText: 'checkpointer',
    detail: 'Checkpoint persistence',
  },
];

const completionKindMap: Record<string, monaco.languages.CompletionItemKind> = {
  Keyword: monaco.languages.CompletionItemKind.Keyword,
  Function: monaco.languages.CompletionItemKind.Function,
  Class: monaco.languages.CompletionItemKind.Class,
  Method: monaco.languages.CompletionItemKind.Method,
  Variable: monaco.languages.CompletionItemKind.Variable,
};

export default function PythonCodeEditor({
  value,
  onChange,
  onSelectionChange,
  readOnly = false,
  minHeight = '480px',
}: PythonCodeEditorProps) {
  const handleMount = useMemo<OnMount>(() => {
    return (editor, monaco) => {
      monaco.languages.registerCompletionItemProvider('python', {
        triggerCharacters: ['.', '(', '_'],
        provideCompletionItems: () => ({
          suggestions: langChainPythonCompletions.map((item) => ({
            label: item.label,
            kind: completionKindMap[item.kind] ?? monaco.languages.CompletionItemKind.Text,
            insertText: item.insertText,
            detail: item.detail,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          })),
        }),
      });

      const emitSelection = () => {
        const selection = editor.getSelection();
        if (!selection) {
          return;
        }
        const model = editor.getModel();
        if (!model) {
          return;
        }
        const from = model.getOffsetAt(selection.getStartPosition());
        const to = model.getOffsetAt(selection.getEndPosition());
        onSelectionChange?.({
          from,
          to,
          text: model.getValueInRange(selection),
        });
      };

      emitSelection();
      editor.onDidChangeCursorSelection(emitSelection);
    };
  }, [onSelectionChange]);

  return (
    <div style={{ minHeight }}>
      <Editor
        height={minHeight}
        defaultLanguage="python"
        value={value}
        onMount={handleMount}
        onChange={(nextValue) => onChange?.(nextValue ?? '')}
        options={{
          fontSize: 12,
          fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
          tabSize: 4,
          readOnly,
          minimap: { enabled: false },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          folding: true,
          contextmenu: true,
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          overviewRulerBorder: false,
        }}
        theme="vs-dark"
        loading={<div />}
      />
    </div>
  );
}
