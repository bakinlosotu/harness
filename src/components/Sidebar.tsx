import React, { useState } from 'react';
import {
  Plus,
  Search,
  Settings as SettingsIcon,
  PanelLeftClose,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { ConversationMeta } from '../lib/storage';

interface Props {
  conversations: ConversationMeta[];
  currentId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<Props> = ({
  conversations,
  currentId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onOpenSettings,
  isOpen,
  onClose,
}) => {
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Grouping by Today / Yesterday / Earlier
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  const todayList: ConversationMeta[] = [];
  const yesterdayList: ConversationMeta[] = [];
  const earlierList: ConversationMeta[] = [];

  for (const c of filteredConvs) {
    if (c.updatedAt >= todayStart) {
      todayList.push(c);
    } else if (c.updatedAt >= yesterdayStart) {
      yesterdayList.push(c);
    } else {
      earlierList.push(c);
    }
  }

  const startRename = (c: ConversationMeta) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = (id: string) => {
    const clean = editingTitle.trim();
    if (clean) {
      onRenameConversation(id, clean);
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onDeleteConversation(id);
    setConfirmDeleteId(null);
    setMenuOpenId(null);
  };

  const renderGroup = (title: string, list: ConversationMeta[]) => {
    if (list.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className="px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
          {title}
        </div>
        <div className="space-y-0.5">
          {list.map((c) => {
            const isSelected = c.id === currentId;
            const isEditing = c.id === editingId;
            const isMenuOpen = c.id === menuOpenId;
            const isDeleting = c.id === confirmDeleteId;

            return (
              <div key={c.id} className="relative group">
                {isEditing ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-[var(--surface)] border border-[var(--accent)] rounded-md mx-2">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(c.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-transparent text-xs text-[var(--ink)] focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename(c.id)}
                      className="text-[var(--success)] p-0.5 hover:opacity-80"
                      aria-label="Confirm rename"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[var(--muted)] p-0.5 hover:opacity-80"
                      aria-label="Cancel rename"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex items-center justify-between px-3 py-2 mx-2 rounded-md text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                        : 'text-[var(--ink)] hover:bg-[var(--canvas)]'
                    }`}
                    onClick={() => {
                      onSelectConversation(c.id);
                      if (window.innerWidth < 900) {
                        onClose();
                      }
                    }}
                  >
                    <span className="truncate pr-2">{c.title || 'Untitled chat'}</span>

                    {/* Context menu trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(isMenuOpen ? null : c.id);
                      }}
                      className={`p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] opacity-0 group-hover:opacity-100 ${
                        isMenuOpen ? 'opacity-100' : ''
                      }`}
                      aria-label="Chat options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-4 top-8 z-30 w-32 bg-[var(--surface)] border border-[var(--line)] rounded-md shadow-lg py-1 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(c);
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--canvas)] text-[var(--ink)] cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(c.id);
                        setMenuOpenId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--canvas)] text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}

                {/* Confirm Delete inline popup */}
                {isDeleting && (
                  <div className="p-2 mx-2 bg-[var(--surface)] border border-[var(--danger)] rounded-md text-xs space-y-1 mt-1">
                    <div className="text-[var(--danger)] font-medium">Delete chat?</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="px-2 py-0.5 bg-[var(--danger)] text-white rounded text-[11px] hover:opacity-90"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 border border-[var(--line)] rounded text-[11px] text-[var(--muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/35 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-[260px] bg-[var(--surface)] border-r border-[var(--line)] flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header: Wordmark & Collapse */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--line)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-[var(--ink)]">Harness</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer lg:hidden"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action button & Search */}
        <div className="p-3 space-y-2 border-b border-[var(--line)] shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 900) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[var(--accent)] text-white text-xs font-medium rounded-md hover:opacity-90 transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted)]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter chats…"
              className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
        </div>

        {/* Chats list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--muted)]">
              No conversations yet.
            </div>
          ) : (
            <>
              {renderGroup('Today', todayList)}
              {renderGroup('Yesterday', yesterdayList)}
              {renderGroup('Earlier', earlierList)}
              {filteredConvs.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-[var(--muted)]">
                  No matching chats.
                </div>
              )}
            </>
          )}
        </div>

        {/* Settings button */}
        <div className="p-3 border-t border-[var(--line)] shrink-0 bg-[var(--surface)]">
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--canvas)] text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
};
