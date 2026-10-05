import React from 'react';
import { PanelLeft, Settings as SettingsIcon, Moon, Sun, PanelRight } from 'lucide-react';
import { Keys, ModelRef, Theme } from '../lib/storage';
import { ModelPicker } from './ModelPicker';

interface Props {
  currentModel: ModelRef | null;
  keys: Keys;
  onSelectModel: (model: ModelRef) => void;
  onOpenKeys: () => void;
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
  isRightPanelOpen: boolean;
  onOpenSettings: () => void;
  theme: Theme;
  onThemeToggle: () => void;
}

export const TopBar: React.FC<Props> = ({
  currentModel,
  keys,
  onSelectModel,
  onOpenKeys,
  onToggleSidebar,
  onToggleRightPanel,
  isRightPanelOpen,
  onOpenSettings,
  theme,
  onThemeToggle,
}) => {
  return (
    <header className="h-14 border-b border-[var(--line)] bg-[var(--surface)] px-4 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle Icon */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Wordmark and BYOK Badge */}
        <div className="flex items-center gap-1.5 mr-1">
          <span className="font-bold text-sm tracking-tight text-[var(--ink)]">Harness</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E7E7FA] dark:bg-[#2A2A55] text-[#3D3BBF] dark:text-[#8C8AF5] tracking-wide">
            BYOK
          </span>
        </div>

        {/* Model Picker Pill */}
        <ModelPicker
          currentModel={currentModel}
          keys={keys}
          onSelectModel={onSelectModel}
          onOpenKeys={onOpenKeys}
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark/Light Theme Toggle */}
        <button
          type="button"
          onClick={onThemeToggle}
          className="p-1.5 rounded-md hover:bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-[var(--canvas)] text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition"
          title="Open settings"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>

        {/* Right Panel Toggle (Documents / Email) */}
        <button
          type="button"
          onClick={onToggleRightPanel}
          className={`p-1.5 rounded-md border transition cursor-pointer ${
            isRightPanelOpen
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'border-[var(--line)] hover:bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
          title="Toggle documents and email panel"
          aria-label="Toggle right panel"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
