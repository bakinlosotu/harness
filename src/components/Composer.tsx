import React, { useRef, useEffect, useState } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  Mail,
  Globe,
  X,
  FileText,
  Sliders,
  Check,
} from 'lucide-react';
import { MessageImage, ModelRef, Keys } from '../lib/storage';
import { MAX_IMAGES_PER_MESSAGE, processImageFile, isSupportedImageType } from '../lib/images';
import { useToast } from './Toasts';

interface Props {
  onSendMessage: (text: string, images: MessageImage[]) => void;
  isStreaming: boolean;
  onStop: () => void;
  currentModel: ModelRef | null;
  keys: Keys;
  onOpenSettings: () => void;
  selectedDocCount: number;
  onOpenDocumentsTab: () => void;
  onOpenEmailTab: () => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  onOpenSystemPrompt: () => void;
}

export const Composer: React.FC<Props> = ({
  onSendMessage,
  isStreaming,
  onStop,
  currentModel,
  keys,
  onOpenSettings,
  selectedDocCount,
  onOpenDocumentsTab,
  onOpenEmailTab,
  webSearch,
  onToggleWebSearch,
  onOpenSystemPrompt,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<MessageImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const hasAnyKey = !!(keys.openai || keys.gemini || keys.anthropic || keys.xai);

  // Auto-grow textarea to max 8 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 8 * 24);
    el.style.height = `${newHeight}px`;
  }, [text]);

  // Handle ESC to stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        onStop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, onStop]);

  // Handle Image Paste from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await addImageFile(file);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images]);

  const addImageFile = async (file: File) => {
    if (images.length >= MAX_IMAGES_PER_MESSAGE) {
      toast(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`, 'error');
      return;
    }

    if (!isSupportedImageType(file)) {
      toast(`${file.name} isn't supported. Use PNG, JPEG, WEBP or GIF.`, 'error');
      return;
    }

    try {
      const processed = await processImageFile(file);
      setImages((prev) => [...prev, processed].slice(0, MAX_IMAGES_PER_MESSAGE));
    } catch (err: any) {
      toast(err?.message || 'Failed to attach image', 'error');
    }
  };

  const handleImageInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const list = Array.from(files);
    for (let i = 0; i < list.length; i++) {
      if (images.length + i >= MAX_IMAGES_PER_MESSAGE) {
        toast(`Only first ${MAX_IMAGES_PER_MESSAGE} images kept.`, 'info');
        break;
      }
      await addImageFile(list[i]);
    }
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    if (isStreaming) {
      onStop();
      return;
    }

    let trimmed = text.trim();
    if (!trimmed && images.length === 0) return;

    if (!hasAnyKey) {
      toast('Add an API key in Settings to start.', 'info');
      onOpenSettings();
      return;
    }

    if (!currentModel) {
      toast('Choose a model first.', 'info');
      return;
    }

    if (!keys[currentModel.provider]) {
      toast(`Add a ${currentModel.provider} key in Settings to send messages.`, 'error');
      onOpenSettings();
      return;
    }

    // Context budget check: truncate if single message > 60k chars
    if (trimmed.length > 60000) {
      trimmed = trimmed.slice(0, 60000);
      toast('Message was truncated to 60,000 characters to fit model context.', 'info');
    }

    onSendMessage(trimmed, images);
    setText('');
    setImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasKey = currentModel && !!keys[currentModel.provider];
  const canSend = (text.trim().length > 0 || images.length > 0) && currentModel && hasKey;

  const placeholderText = !hasAnyKey
    ? 'Add an API key in Settings to start...'
    : !currentModel
    ? 'Choose a model above to start...'
    : webSearch
    ? 'Ask anything (web search enabled)...'
    : 'Ask anything, attach documents, or search the web...';

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 pb-4">
      {/* Pill buttons above composer: System prompt & Document chip */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onOpenSystemPrompt}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--canvas)] text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition shadow-2xs font-medium"
          title="Customize system prompt"
        >
          <Sliders className="w-3 h-3 text-[var(--muted)]" />
          <span>System prompt</span>
        </button>

        {selectedDocCount > 0 && (
          <button
            type="button"
            onClick={onOpenDocumentsTab}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <FileText className="w-3 h-3" />
            <span>Using {selectedDocCount} document{selectedDocCount > 1 ? 's' : ''}</span>
          </button>
        )}
      </div>

      {/* Main Composer Box */}
      <div className="relative bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-sm focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 transition-all overflow-hidden">
        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={`data:${img.mime};base64,${img.base64}`}
                  alt="Attachment"
                  className="w-16 h-16 object-cover rounded-lg border border-[var(--line)]"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--danger)] flex items-center justify-center cursor-pointer shadow-sm"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="w-full bg-transparent px-4 py-3.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] resize-none focus:outline-none min-h-[52px]"
          rows={1}
        />

        {/* Bottom Toolbar inside Composer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--line)]/40 bg-[var(--surface)]">
          <div className="flex items-center gap-1">
            {/* Attach Document icon */}
            <button
              type="button"
              onClick={onOpenDocumentsTab}
              className="p-1.5 rounded-md hover:bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition"
              title="Attach documents"
              aria-label="Attach documents"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Email Icon */}
            <button
              type="button"
              onClick={onOpenEmailTab}
              className="p-1.5 rounded-md hover:bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition"
              title="Open email assistant"
              aria-label="Open email assistant"
            >
              <Mail className="w-4 h-4" />
            </button>

            {/* Web Search Toggle Icon (Below the chat window) */}
            <button
              type="button"
              onClick={onToggleWebSearch}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
                webSearch
                  ? 'bg-[#EEF0FF] dark:bg-[#2A2A55] text-[#5B50EC] dark:text-[#8C8AF5] border border-[#5B50EC]/30 font-semibold shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--canvas)] border border-[var(--line)]/50'
              }`}
              title={webSearch ? 'Web search is active (click to turn off)' : 'Web search is off (click to turn on)'}
              aria-label="Toggle web search"
            >
              <Globe className={`w-3.5 h-3.5 ${webSearch ? 'text-[#5B50EC] dark:text-[#8C8AF5]' : 'text-[var(--muted)]'}`} />
              <span className="flex items-center gap-1 text-[11px]">
                <span>Web search:</span>
                <span className={webSearch ? 'font-bold' : 'font-normal text-[var(--muted)]'}>
                  {webSearch ? 'ON' : 'OFF'}
                </span>
                {webSearch && <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />}
              </span>
            </button>

            {/* Hidden file input for images */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleImageInputChange}
            />
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--danger)] text-white hover:opacity-90 transition cursor-pointer shadow-sm"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#5B50EC] hover:bg-[#4E43DC] text-white disabled:opacity-35 disabled:hover:opacity-35 transition cursor-pointer disabled:cursor-not-allowed shadow-xs"
                title={
                  !hasAnyKey
                    ? 'Add an API key in Settings'
                    : !currentModel
                    ? 'Choose a model'
                    : 'Send message'
                }
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
