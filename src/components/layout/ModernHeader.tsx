/**
 * Copyright (c) 2025 Cade Russell (Ghost Peony)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState } from 'react';
import { Bell, ChevronDown, HelpCircle, Settings, User } from 'lucide-react';
import { useProject } from "../../contexts/ProjectContext";
import { useChat } from '../../features/chat/state/ChatContext';
import { Button } from '../ui/button';

interface ModernHeaderProps {
  currentView: 'studio' | 'library' | 'settings' | 'knowledge' | 'agents' | 'skills' | 'home' | 'community' | 'semantier';
  onViewChange: (view: 'studio' | 'library' | 'settings' | 'knowledge' | 'agents' | 'skills' | 'home' | 'community' | 'semantier') => void;
}

export default function ModernHeader({
  currentView,
  onViewChange
}: ModernHeaderProps) {
  const { activeProject, projects, setActiveProjectId, loading } = useProject();
  const { openChat } = useChat();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const navItems: { key: ModernHeaderProps['currentView']; label: string; icon: string }[] = [
    { key: 'studio',    label: 'Studio',    icon: 'account_tree' },
    { key: 'agents',    label: 'Agents',    icon: 'psychology' },
    { key: 'library',   label: 'Library',   icon: 'folder' },
    { key: 'knowledge', label: 'Knowledge', icon: 'database' },
    { key: 'community', label: 'Community', icon: 'groups' },
    { key: 'semantier', label: 'Semantier', icon: 'schema' },
  ];

  return (
    <header className="h-12 flex items-center px-4 bg-card border-b border-border shrink-0 z-20 gap-4">

      {/* Brand */}
      <button
        onClick={() => onViewChange('home')}
        className="flex items-center gap-2 shrink-0 focus:outline-none"
      >
        <img
          src="/GhostPeony.png"
          alt="GhostPeony"
          className="h-7 w-7 rounded-md object-cover"
          style={{ transform: 'rotate(-45deg)' }}
        />
        <img
          src="/langconfignewlogo.png"
          alt="LangConfig"
          className="h-5 w-auto"
        />
      </button>

      {/* Nav tabs — left-anchored, natural flow */}
      <nav className="flex items-center gap-1">
        {navItems.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={`flex items-center gap-1.5 px-3 h-8 text-sm rounded-sm transition-colors ${
              currentView === key
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">

        {/* Chat / message */}
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Chat (Ctrl+K)" onClick={openChat}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Project selector */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 min-w-[120px] justify-start"
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
          >
            <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: '15px' }}>folder_open</span>
            <span className="truncate">{loading ? 'Loading…' : activeProject?.name || 'No Project'}</span>
            <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground" />
          </Button>

          {showProjectDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowProjectDropdown(false)} />
              <div className="absolute right-0 mt-1 w-56 rounded-md shadow-md border bg-card border-border z-40 py-1 max-h-80 overflow-auto">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No projects found</div>
                ) : (
                  projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => { setActiveProjectId(project.id); setShowProjectDropdown(false); }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${activeProject?.id === project.id ? 'text-primary' : 'text-foreground'}`}>
                          {project.name}
                        </div>
                        {project.description && (
                          <div className="text-xs text-muted-foreground truncate">{project.description}</div>
                        )}
                      </div>
                      {activeProject?.id === project.id && (
                        <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: '14px' }}>check</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Bell */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>

        {/* Help */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4" />
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewChange('settings')}>
          <Settings className="h-4 w-4" />
        </Button>

        {/* User */}
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
        </Button>
      </div>

    </header>
  );
}
