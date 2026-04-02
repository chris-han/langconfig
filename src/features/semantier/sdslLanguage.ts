export const SDSL_LANGUAGE_ID = "sdsl";

export const monarchTokensProvider = {
  defaultToken: "invalid",
  tokenPostfix: ".sdsl",
  keywords: [
    "DIMENSION", "MAP", "BIND", "ASSERT",
    "FROM", "WHERE", "WHEN", "THEN",
    "TRIGGER", "EVALUATE", "RECONCILE", "UPDATE",
    "DERIVE_FROM", "CHECK", "NOW", "NULL",
    "true", "false",
  ],
  typeKeywords: [
    "string", "decimal", "integer", "boolean", "date", "datetime",
    "enum", "uuid",
  ],
  namespaces: ["core", "fin", "tax", "mgt"],
  operators: [
    "==", "!=", "<=", ">=", "<", ">", "=", "+", "-", "*", "/",
    "??", "->", "::", "@",
  ],
  symbols: /[=><!~?:&|+\-*/^%@]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/[a-z][a-z0-9]*(?=:)/, {
        cases: {
          "@namespaces": "type.identifier",
          "@default": "identifier",
        },
      }],
      [/(?<=:)[A-Z][a-zA-Z0-9]*/, "type"],
      [/[A-Z_][A-Z0-9_]+/, {
        cases: {
          "@keywords": "keyword",
          "@default": "type",
        },
      }],
      [/[a-z][a-z0-9]*(?=\()/, {
        cases: {
          "@typeKeywords": "type.identifier",
          "@default": "identifier",
        },
      }],
      [/@[a-z][a-zA-Z0-9]*/, "annotation"],
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/"/, "string", "@string_double"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/'/, "string", "@string_single"],
      [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
      [/\d+/, "number"],
      [/[a-z_][a-zA-Z0-9_]*/, {
        cases: {
          "@typeKeywords": "type.identifier",
          "@default": "identifier",
        },
      }],
      [/[A-Z][a-zA-Z0-9_]*/, "type.identifier"],
      [/@symbols/, {
        cases: {
          "@operators": "operator",
          "@default": "",
        },
      }],
      [/[{}()[\]]/, "@brackets"],
      [/[;,.]/, "delimiter"],
      [/[ \t\r\n]+/, "white"],
    ],
    comment: [
      [/[^/*]+/, "comment"],
      [/\/\*/, "comment", "@push"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"],
    ],
    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"],
    ],
  },
};

export const languageConfiguration = {
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "\"", close: "\"", notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "\"", close: "\"" },
    { open: "'", close: "'" },
  ],
};

export const semantierTheme = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "keyword", foreground: "C792EA", fontStyle: "bold" },
    { token: "type", foreground: "FFCB6B" },
    { token: "type.identifier", foreground: "82AAFF" },
    { token: "identifier", foreground: "EEFFFF" },
    { token: "string", foreground: "C3E88D" },
    { token: "number", foreground: "F78C6C" },
    { token: "number.float", foreground: "F78C6C" },
    { token: "comment", foreground: "546E7A", fontStyle: "italic" },
    { token: "operator", foreground: "89DDFF" },
    { token: "annotation", foreground: "FFCB6B", fontStyle: "italic" },
    { token: "delimiter", foreground: "89DDFF" },
    { token: "invalid", foreground: "FF5370", fontStyle: "underline" },
  ],
  colors: {
    "editor.background": "#112031",
    "editor.foreground": "#EEFFFF",
    "editorLineNumber.foreground": "#6A7F95",
    "editorCursor.foreground": "#FFCB6B",
    "editor.lineHighlightBackground": "#162B40",
    "editor.selectionBackground": "#29435C",
    "editor.inactiveSelectionBackground": "#22394F",
  },
};
