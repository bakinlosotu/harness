import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Globe } from 'lucide-react';
import { Citation } from '../lib/storage';

interface Props {
  citations: Citation[];
  messageId: string;
}

export const SourcesList: React.FC<Props> = ({ citations, messageId }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-2 border-t border-[var(--line)] text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)] font-medium cursor-pointer py-1"
        aria-expanded={isOpen}
      >
        <span>Sources ({citations.length})</span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {citations.map((c) => (
            <div
              key={c.n}
              id={`cite-${messageId}-${c.n}`}
              className="p-2.5 rounded-md bg-[var(--canvas)] border border-[var(--line)] space-y-1 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
                  <span className="w-4 h-4 rounded bg-[var(--cite)] text-[var(--cite-text)] flex items-center justify-center text-[10px] font-bold">
                    {c.n}
                  </span>
                  {c.kind === 'doc' ? (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-[var(--muted)]" />
                      <span>{c.title}</span>
                      {c.page && (
                        <span className="text-[var(--muted)] font-normal">
                          · page {c.page}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-[var(--muted)]" />
                      <span>{c.title}</span>
                    </span>
                  )}
                </div>

                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline flex items-center gap-1 text-[11px] shrink-0"
                  >
                    <span>Visit</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {c.excerpt && (
                <div className="text-[var(--muted)] text-[11px] leading-relaxed line-clamp-3 hover:line-clamp-none pl-5">
                  "{c.excerpt}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
