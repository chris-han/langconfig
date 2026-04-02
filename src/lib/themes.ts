/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type ThemeName = 'langconfig' | 'semantier' | 'dark' | 'light' | 'midnight' | 'ocean' | 'forest' | 'botanical' | 'godspeed' | 'cream' | 'cream-peach';

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    primary: string;
    backgroundLight: string;
    backgroundDark: string;
    panelDark: string;
    borderDark: string;
    textMuted: string;
    textPrimary: string;
    inputBackground: string;
    logoBackground: string;
    nodeBackground: string;
    nodeBackgroundLight: string;
    categoryBackground: string;
  };
  textured?: boolean;
  tokens?: Partial<{
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    surfaceBase: string;
    surfacePanel: string;
    surfaceElevated: string;
    surfaceOverlay: string;
    interactiveHover: string;
    interactiveActive: string;
    interactiveSelection: string;
    interactiveSelectionForeground: string;
    statusSuccess: string;
    statusWarning: string;
    statusError: string;
    statusInfo: string;
    editorBg: string;
    nodeBg: string;
    nodeBorder: string;
    semWarning: string;
    semSuccess: string;
    semInfo: string;
  }>;
}

const darkThemes = new Set<ThemeName>(['semantier', 'dark', 'midnight', 'ocean', 'forest', 'botanical', 'godspeed']);

function setSemanticThemeTokens(theme: Theme, isDarkTheme: boolean) {
  const root = document.documentElement;
  const tokens = theme.tokens ?? {};
  const foreground = tokens.foreground ?? theme.colors.textPrimary;
  const background = tokens.background ?? theme.colors.backgroundDark;
  const panel = tokens.card ?? theme.colors.panelDark;
  const secondary = tokens.secondary ?? theme.colors.nodeBackground;
  const border = tokens.border ?? theme.colors.borderDark;
  const input = tokens.input ?? theme.colors.inputBackground;
  const primary = tokens.primary ?? theme.colors.primary;
  const primaryForeground = tokens.primaryForeground ?? (isDarkTheme ? '#071417' : '#ffffff');

  root.style.setProperty('--background', background);
  root.style.setProperty('--foreground', foreground);
  root.style.setProperty('--card', panel);
  root.style.setProperty('--card-foreground', tokens.cardForeground ?? foreground);
  root.style.setProperty('--popover', tokens.popover ?? panel);
  root.style.setProperty('--popover-foreground', tokens.popoverForeground ?? foreground);
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-foreground', primaryForeground);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--secondary-foreground', tokens.secondaryForeground ?? foreground);
  root.style.setProperty('--muted', tokens.muted ?? theme.colors.backgroundLight);
  root.style.setProperty('--muted-foreground', tokens.mutedForeground ?? theme.colors.textMuted);
  root.style.setProperty('--accent', tokens.accent ?? primary);
  root.style.setProperty('--accent-foreground', tokens.accentForeground ?? primaryForeground);
  root.style.setProperty('--destructive', tokens.destructive ?? '#f06a7f');
  root.style.setProperty('--destructive-foreground', tokens.destructiveForeground ?? '#fff6f8');
  root.style.setProperty('--border', border);
  root.style.setProperty('--input', input);
  root.style.setProperty('--ring', tokens.ring ?? (isDarkTheme ? 'rgba(57, 208, 207, 0.42)' : 'rgba(46, 92, 138, 0.28)'));
  root.style.setProperty('--sidebar', tokens.sidebar ?? background);
  root.style.setProperty('--sidebar-foreground', tokens.sidebarForeground ?? foreground);
  root.style.setProperty('--sidebar-primary', tokens.sidebarPrimary ?? primary);
  root.style.setProperty('--sidebar-primary-foreground', tokens.sidebarPrimaryForeground ?? primaryForeground);
  root.style.setProperty('--sidebar-accent', tokens.sidebarAccent ?? secondary);
  root.style.setProperty('--sidebar-accent-foreground', tokens.sidebarAccentForeground ?? foreground);
  root.style.setProperty('--sidebar-border', tokens.sidebarBorder ?? border);
  root.style.setProperty('--surface-base', tokens.surfaceBase ?? background);
  root.style.setProperty('--surface-panel', tokens.surfacePanel ?? panel);
  root.style.setProperty('--surface-elevated', tokens.surfaceElevated ?? theme.colors.logoBackground);
  root.style.setProperty('--surface-overlay', tokens.surfaceOverlay ?? (isDarkTheme ? 'rgba(10, 13, 18, 0.78)' : 'rgba(245, 249, 252, 0.82)'));
  root.style.setProperty('--interactive-hover', tokens.interactiveHover ?? (isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(46, 92, 138, 0.06)'));
  root.style.setProperty('--interactive-active', tokens.interactiveActive ?? (isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(46, 92, 138, 0.1)'));
  root.style.setProperty('--interactive-selection', tokens.interactiveSelection ?? (isDarkTheme ? 'rgba(57, 208, 207, 0.16)' : 'rgba(46, 92, 138, 0.14)'));
  root.style.setProperty('--interactive-selection-foreground', tokens.interactiveSelectionForeground ?? foreground);
  root.style.setProperty('--status-success', tokens.statusSuccess ?? '#3ccf91');
  root.style.setProperty('--status-warning', tokens.statusWarning ?? '#f2b94b');
  root.style.setProperty('--status-error', tokens.statusError ?? '#f06a7f');
  root.style.setProperty('--status-info', tokens.statusInfo ?? '#5ca7ff');
  root.style.setProperty('--primary-base', primary);
  root.style.setProperty('--editor-bg', tokens.editorBg ?? background);
  root.style.setProperty('--node-bg', tokens.nodeBg ?? theme.colors.nodeBackground);
  root.style.setProperty('--node-border', tokens.nodeBorder ?? theme.colors.nodeBackgroundLight);
  root.style.setProperty('--sem-warning', tokens.semWarning ?? '#f2b94b');
  root.style.setProperty('--sem-success', tokens.semSuccess ?? '#3ccf91');
  root.style.setProperty('--sem-info', tokens.semInfo ?? '#5ca7ff');
}

export const themes: Record<ThemeName, Theme> = {
  'semantier': {
    name: 'semantier',
    displayName: 'OpenChamber Semantier',
    colors: {
      primary: 'oklch(0.65 0.18 180)',
      backgroundLight: 'oklch(0.18 0.005 260)',
      backgroundDark: 'oklch(0.12 0.005 260)',
      panelDark: 'oklch(0.15 0.005 260)',
      borderDark: 'oklch(0.25 0.005 260)',
      textMuted: 'oklch(0.55 0 0)',
      textPrimary: 'oklch(0.95 0 0)',
      inputBackground: 'oklch(0.18 0.005 260)',
      logoBackground: 'oklch(0.15 0.005 260)',
      nodeBackground: 'oklch(0.18 0.008 260)',
      nodeBackgroundLight: 'oklch(0.28 0.008 260)',
      categoryBackground: 'oklch(0.18 0.005 260)',
    },
    tokens: {
      background: 'oklch(0.12 0.005 260)',
      foreground: 'oklch(0.95 0 0)',
      card: 'oklch(0.15 0.005 260)',
      cardForeground: 'oklch(0.95 0 0)',
      popover: 'oklch(0.15 0.005 260)',
      popoverForeground: 'oklch(0.95 0 0)',
      primary: 'oklch(0.65 0.18 180)',
      primaryForeground: 'oklch(0.12 0.005 260)',
      secondary: 'oklch(0.22 0.005 260)',
      secondaryForeground: 'oklch(0.85 0 0)',
      muted: 'oklch(0.18 0.005 260)',
      mutedForeground: 'oklch(0.55 0 0)',
      accent: 'oklch(0.65 0.18 180)',
      accentForeground: 'oklch(0.12 0.005 260)',
      destructive: 'oklch(0.55 0.2 25)',
      destructiveForeground: 'oklch(0.95 0 0)',
      border: 'oklch(0.25 0.005 260)',
      input: 'oklch(0.18 0.005 260)',
      ring: 'oklch(0.65 0.18 180)',
      sidebar: 'oklch(0.1 0.005 260)',
      sidebarForeground: 'oklch(0.85 0 0)',
      sidebarPrimary: 'oklch(0.65 0.18 180)',
      sidebarPrimaryForeground: 'oklch(0.12 0.005 260)',
      sidebarAccent: 'oklch(0.18 0.005 260)',
      sidebarAccentForeground: 'oklch(0.95 0 0)',
      sidebarBorder: 'oklch(0.22 0.005 260)',
      surfaceBase: 'oklch(0.12 0.005 260)',
      surfacePanel: 'oklch(0.15 0.005 260)',
      surfaceElevated: 'oklch(0.15 0.005 260)',
      surfaceOverlay: 'rgba(10, 13, 18, 0.78)',
      interactiveHover: 'rgba(255, 255, 255, 0.06)',
      interactiveActive: 'rgba(255, 255, 255, 0.1)',
      interactiveSelection: 'rgba(57, 208, 207, 0.16)',
      interactiveSelectionForeground: 'oklch(0.95 0 0)',
      statusSuccess: 'oklch(0.65 0.18 145)',
      statusWarning: 'oklch(0.75 0.18 80)',
      statusError: 'oklch(0.55 0.2 25)',
      statusInfo: 'oklch(0.65 0.15 240)',
      editorBg: 'oklch(0.14 0.005 260)',
      nodeBg: 'oklch(0.18 0.008 260)',
      nodeBorder: 'oklch(0.28 0.008 260)',
      semWarning: 'oklch(0.75 0.18 80)',
      semSuccess: 'oklch(0.65 0.18 145)',
      semInfo: 'oklch(0.65 0.15 240)',
    },
  },
  langconfig: {
    name: 'langconfig',
    displayName: 'LangConfig (Signature)',
    colors: {
      primary: '#2E5C8A',
      backgroundLight: '#F5F9FC',
      backgroundDark: '#D8EDF5',
      panelDark: '#E3F0F5',
      borderDark: '#2E5C8A',
      textMuted: '#4A6B8A',
      textPrimary: '#1a2332',
      inputBackground: '#FFFFFF',
      logoBackground: '#FFFFFF',
      nodeBackground: '#6B9E7E',
      nodeBackgroundLight: '#8AB5A0',
      categoryBackground: '#C5E0E5',
    },
    textured: true,
  },
  dark: {
    name: 'dark',
    displayName: 'Dark Blue',
    colors: {
      primary: '#135bec',
      backgroundLight: '#f6f6f8',
      backgroundDark: '#101622',
      panelDark: '#181e29',
      borderDark: '#232f48',
      textMuted: '#92a4c9',
      textPrimary: '#e5e9f0',
      inputBackground: '#0c1018',
      logoBackground: '#1a2332', // Slightly lighter than panel for contrast
      nodeBackground: '#181e29',
      nodeBackgroundLight: '#232f48',
      categoryBackground: '#1a2332',
    },
  },
  light: {
    name: 'light',
    displayName: 'Light',
    colors: {
      primary: '#2563eb',
      backgroundLight: '#ffffff',
      backgroundDark: '#f8fafc',
      panelDark: '#f1f5f9',
      borderDark: '#e2e8f0',
      textMuted: '#64748b',
      textPrimary: '#1e293b',
      inputBackground: '#ffffff',
      logoBackground: '#ffffff', // White for clean look
      nodeBackground: '#f1f5f9',
      nodeBackgroundLight: '#e2e8f0',
      categoryBackground: '#e2e8f0',
    },
  },
  midnight: {
    name: 'midnight',
    displayName: 'Midnight',
    colors: {
      primary: '#8b5cf6',
      backgroundLight: '#fafafa',
      backgroundDark: '#0a0a0a',
      panelDark: '#141414',
      borderDark: '#262626',
      textMuted: '#a3a3a3',
      textPrimary: '#f5f5f5',
      inputBackground: '#050505',
      logoBackground: '#1a1a1a', // Slightly lighter than background
      nodeBackground: '#141414',
      nodeBackgroundLight: '#262626',
      categoryBackground: '#1a1a1a',
    },
  },
  ocean: {
    name: 'ocean',
    displayName: 'Ocean',
    colors: {
      primary: '#06b6d4',
      backgroundLight: '#f0fdfa',
      backgroundDark: '#042f2e',
      panelDark: '#134e4a',
      borderDark: '#FF8559',
      textMuted: '#5FB9B0',
      textPrimary: '#ecfeff',
      inputBackground: '#022020',
      logoBackground: '#0a3a38', // Teal that contrasts with turquoise header
      nodeBackground: '#134e4a',
      nodeBackgroundLight: '#0f6b66',
      categoryBackground: '#0a4a46',
    },
  },
  forest: {
    name: 'forest',
    displayName: 'Forest',
    colors: {
      primary: '#10b981',
      backgroundLight: '#f0fdf4',
      backgroundDark: '#022c22',
      panelDark: '#064e3b',
      borderDark: '#5B9BD5',
      textMuted: '#6DB893',
      textPrimary: '#d1fae5',
      inputBackground: '#011a15',
      logoBackground: '#083d2e', // Dark forest green that works with emerald header
      nodeBackground: '#064e3b',
      nodeBackgroundLight: '#0a6b4a',
      categoryBackground: '#083d2e',
    },
  },
  botanical: {
    name: 'botanical',
    displayName: 'Botanical',
    colors: {
      primary: '#2D7A5E',
      backgroundLight: '#F5F3E8',
      backgroundDark: '#1E3A2C',
      panelDark: '#2A5040',
      borderDark: '#C17455',
      textMuted: '#A8B99C',
      textPrimary: '#F5F3E8',
      inputBackground: '#152820',
      logoBackground: '#1E3A2C', // Match background for subtle look
      nodeBackground: '#2A5040',
      nodeBackgroundLight: '#3a6450',
      categoryBackground: '#254838',
    },
  },
  godspeed: {
    name: 'godspeed',
    displayName: 'Godspeed',
    colors: {
      primary: '#92B4C8',
      backgroundLight: '#F5E9D3',
      backgroundDark: '#4A4035',
      panelDark: '#5A5045',
      borderDark: '#B8A89A',
      textMuted: '#A8C4D8',
      textPrimary: '#F5E9D3',
      inputBackground: '#3a3028',
      logoBackground: '#635850', // Warm medium brown that contrasts with powder blue
      nodeBackground: '#5A5045',
      nodeBackgroundLight: '#6a6055',
      categoryBackground: '#544a40',
    },
  },
  cream: {
    name: 'cream',
    displayName: 'Cream',
    colors: {
      primary: '#2E5C8A', // Keep blue primary
      backgroundLight: '#FDF8F3', // Warm cream background
      backgroundDark: '#F5EFE7', // Slightly darker cream
      panelDark: '#FEFAF5', // Light cream panels
      borderDark: '#E8DCC8', // Warm taupe borders
      textMuted: '#8B7D6B', // Warm brown muted text
      textPrimary: '#2D2416', // Dark warm text
      inputBackground: '#FFFFFF', // White inputs
      logoBackground: '#FFFFFF', // White for clean contrast
      nodeBackground: '#F5EFE7',
      nodeBackgroundLight: '#E8DCC8',
      categoryBackground: '#2E5C8A', // Use primary color (blue)
    },
  },
  'cream-peach': {
    name: 'cream-peach',
    displayName: 'Cream (Peach)',
    colors: {
      primary: '#2E5C8A', // Keep blue primary
      backgroundLight: '#FDF8F3', // Warm cream background
      backgroundDark: '#F5EFE7', // Slightly darker cream
      panelDark: '#FEFAF5', // Light cream panels
      borderDark: '#E8DCC8', // Warm taupe borders
      textMuted: '#8B7D6B', // Warm brown muted text
      textPrimary: '#2D2416', // Dark warm text
      inputBackground: '#FFFFFF', // White inputs
      logoBackground: '#FFFFFF', // White for clean contrast
      nodeBackground: '#F5EFE7',
      nodeBackgroundLight: '#E8DCC8',
      categoryBackground: '#E8B896', // Peachy-terracotta accent for categories
    },
  },
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDarkTheme = darkThemes.has(theme.name);

  // Set CSS variables
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-background-light', theme.colors.backgroundLight);
  root.style.setProperty('--color-background-dark', theme.colors.backgroundDark);
  root.style.setProperty('--color-panel-dark', theme.colors.panelDark);
  root.style.setProperty('--color-border-dark', theme.colors.borderDark);
  root.style.setProperty('--color-text-muted', theme.colors.textMuted);
  root.style.setProperty('--color-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--color-input-background', theme.colors.inputBackground);
  root.style.setProperty('--color-logo-background', theme.colors.logoBackground);
  root.style.setProperty('--color-node-background', theme.colors.nodeBackground);
  root.style.setProperty('--color-node-background-light', theme.colors.nodeBackgroundLight);
  root.style.setProperty('--color-category-background', theme.colors.categoryBackground);
  root.style.setProperty('--color-background', theme.colors.backgroundDark);
  root.style.setProperty('--color-background-secondary', theme.colors.backgroundLight);
  root.style.setProperty('--color-bg-surface', theme.colors.panelDark);
  root.style.setProperty('--color-panel-light', theme.colors.panelDark);
  root.style.setProperty('--color-border', theme.colors.borderDark);
  root.style.setProperty('--color-border-light', theme.colors.nodeBackgroundLight);
  root.style.setProperty('--color-text-secondary', theme.colors.textMuted);
  root.style.setProperty('--color-primary-light', theme.colors.nodeBackgroundLight);
  root.style.setProperty('--color-primary-alpha', `${theme.colors.primary}33`);
  root.style.setProperty('--color-primary-alpha-10', `${theme.colors.primary}1A`);
  root.style.setProperty('--color-success', '#3ccf91');
  root.style.setProperty('--color-success-subtle', 'rgba(60, 207, 145, 0.18)');
  root.style.setProperty('--color-warning-bg', 'rgba(242, 185, 75, 0.12)');
  root.style.setProperty('--color-warning-border', 'rgba(242, 185, 75, 0.28)');
  root.style.setProperty('--color-warning-text', '#f2b94b');
  root.style.setProperty('--color-accent', theme.colors.primary);

  setSemanticThemeTokens(theme, isDarkTheme);

  // Set data-theme attribute for CSS targeting
  root.setAttribute('data-theme', theme.name);
  root.classList.toggle('dark', isDarkTheme);

  // Add/remove textured class
  if (theme.textured) {
    root.classList.add('textured-theme');
  } else {
    root.classList.remove('textured-theme');
  }

  // Save to localStorage
  localStorage.setItem('langconfig-theme', theme.name);
}

export function loadTheme(): Theme {
  const savedTheme = localStorage.getItem('langconfig-theme') as ThemeName;
  return themes[savedTheme] || themes.langconfig;
}

export function initializeTheme() {
  const theme = loadTheme();
  applyTheme(theme);
  return theme;
}
