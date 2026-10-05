import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  RotateCw,
  Edit3,
  AlertCircle,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { Message as MessageType, ModelRef } from '../lib/storage';
import { getProviderBadgeClass, getProviderLetter } from './ModelPicker';
import { SourcesList } from './SourcesList';

interface Props {
  message: MessageType;
  isLastUserMessage?: boolean;
  isLastAssistantMessage?: boolean;
  onRetry?: () => void;
  onRetryWith?: (model: ModelRef) => void;
  onEditUserMessage?: (newText: string) => void;
  onOpenKeys?: () => void;
  availableModels?: ModelRef[];
}

export const MessageItem: React.FC<Props> = ({
  message,
  isLastUserMessage,
  isLastAssistantMessage,
  onRetry,
  onRetryWith,
  onEditUserMessage,
  onOpenKeys,
  availableModels = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showRetryWithMenu, setShowRetryWithMenu] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editText.trim() && onEditUserMessage) {
      onEditUserMessage(editText.trim());
      setIsEditing(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Click on citation chip: scroll to source
  const handleCitationClick = (num: number) => {
    const el = document.getElementById(`cite-${message.id}-${num}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.classList.add('ring-2', 'ring-[var(--accent)]');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[var(--accent)]'), 2000);
    }
  };

  // Replace [n] in markdown with custom tokens or renderers
  const validCitationNums = new Set(message.citations?.map((c) => c.n) || []);

  const renderTextWithCitations = (text: string) => {
    if (validCitationNums.size === 0) return text;
    // We split on [n]
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (validCitationNums.has(num)) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCitationClick(num)}
              className="citation-chip"
              title={`View source [${num}]`}
            >
              [{num}]
            </button>
          );
        }
      }
      return part;
    });
  };

  // User Message
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end my-4 max-w-full">
        {/* Images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end max-w-[720px]">
            {message.images.map((img, idx) => (
              <img
                key={idx}
                src={`data:${img.mime};base64,${img.base64}`}
                alt="Uploaded attachment"
                className="max-h-48 rounded-lg border border-[var(--line)] object-contain bg-[var(--surface)]"
              />
            ))}
          </div>
        )}

        {/* Message bubble or edit form */}
        {isEditing ? (
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-[720px] bg-[var(--surface)] border border-[var(--accent)] rounded-xl p-3 space-y-2 shadow-sm"
          >
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-transparent text-sm text-[var(--ink)] resize-none focus:outline-none"
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 rounded border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--canvas)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[var(--accent)] text-white rounded font-medium hover:opacity-90 cursor-pointer"
              >
                Resend
              </button>
            </div>
          </form>
        ) : (
          <div className="relative group max-w-[720px]">
            <div className="px-4 py-2.5 rounded-2xl bg-[var(--accent-soft)] text-[var(--ink)] text-[15px] leading-relaxed break-words whitespace-pre-wrap">
              {message.text}
            </div>

            <div className="flex items-center justify-end gap-2 mt-1 px-1">
              {isLastUserMessage && onEditUserMessage && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 transition text-xs text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer"
                  title="Edit message"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
              <span className="text-[11px] text-[var(--muted)]">
                {formatTime(message.createdAt)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="flex flex-col my-6 max-w-[720px] w-full">
      {/* Model header info */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        {message.model && (
          <div className="flex items-center gap-1.5 font-medium text-[var(--muted)]">
            <span
              className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${getProviderBadgeClass(
                message.model.provider
              )}`}
            >
              {getProviderLetter(message.model.provider)}
            </span>
            <span className="text-[var(--ink)] font-semibold">
              {message.model.label || message.model.id}
            </span>
          </div>
        )}
        {message.status === 'stopped' && (
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-[var(--canvas)] border border-[var(--line)] text-[var(--muted)] font-medium">
            Stopped
          </span>
        )}
      </div>

      {/* Answer content (Source Serif 4 font) */}
      <div className="assistant-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
              >
                {children}
              </a>
            ),
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !String(children).includes('\n');
              const codeText = String(children).replace(/\n$/, '');

              if (isInline) {
                return <code {...props}>{children}</code>;
              }

              return (
                <div className="relative group/code my-3">
                  <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(codeText)}
                      className="px-2 py-1 bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] rounded text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                      title="Copy code"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre>
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            },
            p({ children }) {
              // Parse citation chips in paragraph text
              if (typeof children === 'string') {
                return <p>{renderTextWithCitations(children)}</p>;
              }
              if (Array.isArray(children)) {
                return (
                  <p>
                    {children.map((child, i) =>
                      typeof child === 'string' ? (
                        <React.Fragment key={i}>{renderTextWithCitations(child)}</React.Fragment>
                      ) : (
                        child
                      )
                    )}
                  </p>
                );
              }
              return <p>{children}</p>;
            },
          }}
        >
          {message.text}
        </ReactMarkdown>
      </div>

      {/* Streaming indicator */}
      {message.status === 'streaming' && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>Generating answer…</span>
        </div>
      )}

      {/* Error mid-stream or request error */}
      {message.status === 'error' && message.error && (
        <div className="mt-3 p-3 rounded-lg bg-[var(--canvas)] border border-[var(--danger)] text-xs text-[var(--ink)] space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{message.error}</div>
          </div>
          <div className="flex items-center gap-2 pl-6">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-2.5 py-1 bg-[var(--accent)] text-white font-medium rounded hover:opacity-90 cursor-pointer flex items-center gap-1"
              >
                <RotateCw className="w-3 h-3" /> Retry
              </button>
            )}
            {message.error.toLowerCase().includes('key') && onOpenKeys && (
              <button
                type="button"
                onClick={onOpenKeys}
                className="px-2.5 py-1 border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-medium rounded hover:bg-[var(--canvas)] cursor-pointer flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" /> Open Keys
              </button>
            )}
          </div>
        </div>
      )}

      {/* Citations / Sources Accordion */}
      {message.citations && message.citations.length > 0 && (
        <SourcesList citations={message.citations} messageId={message.id} />
      )}

      {/* Message action bar (Copy, Retry, Retry with…) */}
      {message.status !== 'streaming' && message.text && (
        <div className="flex items-center gap-3 mt-3 text-xs text-[var(--muted)]">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-[var(--ink)] transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {isLastAssistantMessage && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 hover:text-[var(--ink)] transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}

          {isLastAssistantMessage && onRetryWith && availableModels.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRetryWithMenu(!showRetryWithMenu)}
                className="flex items-center gap-1 hover:text-[var(--ink)] transition cursor-pointer"
              >
                <span>Retry with…</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showRetryWithMenu && (
                <div className="absolute left-0 mt-1 w-48 bg-[var(--surface)] border border-[var(--line)] rounded-md shadow-lg py-1 z-30 max-h-56 overflow-y-auto">
                  {availableModels.map((m) => (
                    <button
                      key={`${m.provider}:${m.id}`}
                      type="button"
                      onClick={() => {
                        setShowRetryWithMenu(false);
                        onRetryWith(m);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--canvas)] flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold ${getProviderBadgeClass(
                          m.provider
                        )}`}
                      >
                        {getProviderLetter(m.provider)}
                      </span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
