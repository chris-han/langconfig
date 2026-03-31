import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, completeFromList, snippetCompletion } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { Compartment, EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

interface PythonCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string }) => void;
  readOnly?: boolean;
  minHeight?: string;
}

const langChainPythonCompletions = completeFromList([
  snippetCompletion('from langchain_openai import ChatOpenAI', {
    label: 'from langchain_openai import ChatOpenAI',
    type: 'keyword',
    detail: 'LangChain import',
  }),
  snippetCompletion('from langchain.agents import AgentExecutor', {
    label: 'from langchain.agents import AgentExecutor',
    type: 'keyword',
    detail: 'LangChain import',
  }),
  snippetCompletion('from langgraph.prebuilt import create_react_agent', {
    label: 'from langgraph.prebuilt import create_react_agent',
    type: 'keyword',
    detail: 'LangGraph import',
  }),
  snippetCompletion('from langgraph.checkpoint.postgres import PostgresSaver', {
    label: 'from langgraph.checkpoint.postgres import PostgresSaver',
    type: 'keyword',
    detail: 'LangGraph import',
  }),
  snippetCompletion('ChatOpenAI(model="${model}", temperature=${temperature}, max_tokens=${maxTokens})', {
    label: 'ChatOpenAI(...)',
    type: 'function',
    detail: 'OpenAI-compatible chat model',
  }),
  snippetCompletion('create_react_agent(llm, tools, state_modifier=system_prompt)', {
    label: 'create_react_agent(...)',
    type: 'function',
    detail: 'Build LangGraph react agent',
  }),
  snippetCompletion('AgentExecutor(\n    agent=agent,\n    tools=tools,\n    checkpointer=checkpointer,\n    verbose=True,\n)', {
    label: 'AgentExecutor(...)',
    type: 'class',
    detail: 'Run the agent with tools',
  }),
  snippetCompletion('agent_executor.invoke(\n    {"messages": [("user", "${prompt}")]},\n    config={"configurable": {"thread_id": "${threadId}"}}\n)', {
    label: 'agent_executor.invoke(...)',
    type: 'method',
    detail: 'Execute the agent',
  }),
  {
    label: 'system_prompt',
    type: 'variable',
    detail: 'System prompt string',
    apply: 'system_prompt',
  },
  {
    label: 'tools',
    type: 'variable',
    detail: 'Configured tool list',
    apply: 'tools',
  },
  {
    label: 'checkpointer',
    type: 'variable',
    detail: 'Checkpoint persistence',
    apply: 'checkpointer',
  },
]);

export default function PythonCodeEditor({
  value,
  onChange,
  onSelectionChange,
  readOnly = false,
  minHeight = '480px',
}: PythonCodeEditorProps) {
  const readOnlyCompartment = useMemo(() => new Compartment(), []);

  const extensions = useMemo<Extension[]>(() => [
    python(),
    EditorState.tabSize.of(4),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': {
        fontSize: '12px',
        backgroundColor: 'var(--color-background-dark)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-dark)',
        borderRadius: '10px',
      },
      '.cm-scroller': {
        fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
        minHeight,
      },
      '.cm-content': {
        padding: '16px',
      },
      '.cm-gutters': {
        backgroundColor: 'rgba(46, 92, 138, 0.08)',
        color: 'var(--color-text-muted)',
        borderRight: '1px solid rgba(46, 92, 138, 0.2)',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(46, 92, 138, 0.08)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(46, 92, 138, 0.14)',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(46, 92, 138, 0.28)',
      },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        border: '1px solid var(--color-border-dark)',
        backgroundColor: 'var(--color-panel-dark)',
        color: 'var(--color-text-primary)',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'rgba(46, 92, 138, 0.14)',
        color: 'var(--color-text-primary)',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--color-primary)',
      },
      '&.cm-focused': {
        outline: 'none',
      },
    }),
    autocompletion({
      activateOnTyping: true,
      override: [langChainPythonCompletions],
    }),
    readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
  ], [minHeight, readOnly, readOnlyCompartment]);

  return (
    <CodeMirror
      value={value}
      height={minHeight}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        dropCursor: false,
        allowMultipleSelections: false,
      }}
      extensions={extensions}
      onChange={(nextValue) => onChange?.(nextValue)}
      onCreateEditor={(view) => {
        const range = view.state.selection.main;
        onSelectionChange?.({
          from: range.from,
          to: range.to,
          text: view.state.doc.sliceString(range.from, range.to),
        });
      }}
      onUpdate={(update) => {
        const range = update.state.selection.main;
        onSelectionChange?.({
          from: range.from,
          to: range.to,
          text: update.state.doc.sliceString(range.from, range.to),
        });
      }}
    />
  );
}
