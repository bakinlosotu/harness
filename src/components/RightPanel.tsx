import React, { useState } from 'react';
import { FileText, Mail, X } from 'lucide-react';
import { Doc, Keys, ModelRef } from '../lib/storage';
import { DocumentsTab } from './DocumentsTab';
import { EmailTab } from './EmailTab';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  documents: Doc[];
  selectedDocIds: string[];
  onToggleDoc: (docId: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
  uploadProgress: string | null;
  keys: Keys;
  onOpenKeys: () => void;
  currentModel: ModelRef | null;
  activeTab: 'documents' | 'email';
  onTabChange: (tab: 'documents' | 'email') => void;
}

export const RightPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  documents,
  selectedDocIds,
  onToggleDoc,
  onUploadFile,
  onDeleteDoc,
  uploadProgress,
  keys,
  onOpenKeys,
  currentModel,
  activeTab,
  onTabChange,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <div
        className="fixed inset-0 bg-black/35 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed top-0 bottom-0 right-0 z-40 w-[340px] bg-[var(--surface)] border-l border-[var(--line)] flex flex-col shadow-lg lg:shadow-none lg:static transition-transform">
        {/* Top Header with Tabs & Close button */}
        <div className="h-14 px-3 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onTabChange('documents')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
                activeTab === 'documents'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Documents ({selectedDocIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('email')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
                activeTab === 'email'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'documents' ? (
            <DocumentsTab
              documents={documents}
              selectedDocIds={selectedDocIds}
              onToggleDoc={onToggleDoc}
              onUploadFile={onUploadFile}
              onDeleteDoc={onDeleteDoc}
              uploadProgress={uploadProgress}
            />
          ) : (
            <EmailTab
              keys={keys}
              onOpenKeys={onOpenKeys}
              currentModel={currentModel}
              selectedDocIds={selectedDocIds}
            />
          )}
        </div>
      </aside>
    </>
  );
};
