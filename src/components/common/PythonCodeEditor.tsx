import { useEffect, useMemo, useState } from 'react';
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react';
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

const darkThemes = new Set(['dark', 'midnight', 'ocean', 'forest', 'botanical', 'godspeed']);

function getCssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') {
    return fallback;
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function getEditorThemeName() {
  if (typeof window === 'undefined') {
    return 'langconfig-editor-light';
  }
  const theme = document.documentElement.getAttribute('data-theme') || 'langconfig';
  return darkThemes.has(theme) ? 'langconfig-editor-dark' : 'langconfig-editor-light';
}

function defineEditorTheme(monacoInstance: typeof monaco, themeName: string) {
  const isDark = themeName.endsWith('-dark');
  const background = getCssVar('--color-background-dark', isDark ? '#101622' : '#D8EDF5');
  const panel = getCssVar('--color-panel-dark', isDark ? '#181e29' : '#E3F0F5');
  const border = getCssVar('--color-border-dark', isDark ? '#232f48' : '#2E5C8A');
  const primary = getCssVar('--color-primary', '#2E5C8A');
  const textPrimary = getCssVar('--color-text-primary', isDark ? '#e5e9f0' : '#1a2332');
  const textMuted = getCssVar('--color-text-muted', isDark ? '#92a4c9' : '#4A6B8A');
  const inputBackground = getCssVar('--color-input-background', isDark ? '#0c1018' : '#FFFFFF');

  monacoInstance.editor.defineTheme(themeName, {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': background,
      'editor.foreground': textPrimary,
      'editorLineNumber.foreground': textMuted,
      'editorLineNumber.activeForeground': textPrimary,
      'editorCursor.foreground': primary,
      'editor.selectionBackground': `${primary}40`,
      'editor.inactiveSelectionBackground': `${primary}22`,
      'editor.lineHighlightBackground': `${primary}14`,
      'editor.lineHighlightBorder': `${primary}00`,
      'editorGutter.background': panel,
      'editorGutter.modifiedBackground': primary,
      'editorGutter.addedBackground': primary,
      'editorIndentGuide.background1': `${border}40`,
      'editorIndentGuide.activeBackground1': `${primary}55`,
      'editorWhitespace.foreground': `${textMuted}55`,
      'editorWidget.background': panel,
      'editorWidget.border': border,
      'editorSuggestWidget.background': panel,
      'editorSuggestWidget.border': border,
      'editorSuggestWidget.foreground': textPrimary,
      'editorSuggestWidget.selectedBackground': `${primary}1f`,
      'input.background': inputBackground,
      'input.foreground': textPrimary,
      'input.border': border,
      'focusBorder': primary,
    },
  });
}

export default function PythonCodeEditor({
  value,
  onChange,
  onSelectionChange,
  readOnly = false,
  minHeight = '480px',
}: PythonCodeEditorProps) {
  const [themeName, setThemeName] = useState(() => getEditorThemeName());

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setThemeName(getEditorThemeName());
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class'],
    });

    return () => observer.disconnect();
  }, []);

  const handleBeforeMount = useMemo<BeforeMount>(() => {
    return (monacoInstance) => {
      defineEditorTheme(monacoInstance, themeName);
    };
  }, [themeName]);

  const handleMount = useMemo<OnMount>(() => {
    return (editor, monaco) => {
      defineEditorTheme(monaco, themeName);
      monaco.editor.setTheme(themeName);

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
  }, [onSelectionChange, themeName]);

  useEffect(() => {
    defineEditorTheme(monaco, themeName);
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  return (
    <div style={{ minHeight }}>
      <Editor
        height={minHeight}
        defaultLanguage="python"
        beforeMount={handleBeforeMount}
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
        theme={themeName}
        loading={<div />}
      />
    </div>
  );
}
