/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SettingsCategory } from './SettingsLayout';

interface SettingsSidebarProps {
  currentCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

interface MenuSection {
  id: SettingsCategory;
  label: string;
  icon: string;
}

const menuSections: MenuSection[] = [
  { id: 'general', label: 'General', icon: 'tune' },
  { id: 'api-keys', label: 'API Keys & Providers', icon: 'key' },
  { id: 'model-defaults', label: 'Model Defaults', icon: 'psychology' },
  { id: 'local-models', label: 'Local Models', icon: 'computer' },
  { id: 'local-workspace', label: 'Local Workspace', icon: 'folder_open' },
  { id: 'appearance', label: 'Appearance & Theme', icon: 'palette' },
  { id: 'about', label: 'About', icon: 'info' },
];

export default function SettingsSidebar({
  currentCategory,
  onCategoryChange
}: SettingsSidebarProps) {
  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-4 py-6">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <span className="material-symbols-outlined text-xl">settings</span>
          Settings
        </h2>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuSections.map((section) => {
          const isActive = currentCategory === section.id;

          return (
            <button
              key={section.id}
              onClick={() => onCategoryChange(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 dark:bg-primary/20'
                  : 'hover:bg-white/5'
              }`}
              style={{
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent'
              }}
            >
              <span className="material-symbols-outlined text-base">
                {section.icon}
              </span>
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
