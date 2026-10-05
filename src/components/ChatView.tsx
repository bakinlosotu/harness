import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowDown, Sparkles, CheckCircle2 } from 'lucide-react';
import { Conversation, Keys, ModelRef, MessageImage } from '../lib/storage';
import { MessageItem } from './Message';
import { Composer } from './Composer';

interface Props {
  conversation: Conversation | null;
  keys: Keys;
  onSendMessage: (text: string, images: MessageImage[]) => void;
  isStreaming: boolean;
  onStop: () => void;
  currentModel: ModelRef | null;
  onOpenSettings: () => void;
  onRetry: () => void;
  onRetryWith: (model: ModelRef) => void;
  onEditUserMessage: (newText: string) => void;
  selectedDocCount: number;
  onOpenDocumentsTab: () => void;
  onOpenEmailTab: () => void;
  availableModels: ModelRef[];
  onUploadDroppedFiles?: (files: FileList) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  onOpenSystemPrompt: () => void;
  onJudge?: (messageId: string, model?: ModelRef) => void;
  onSendCouncil?: (topic: string, images: MessageImage[]) => void;
  autoJudge: boolean;
  onToggleAutoJudge: () => void;
}

export const ChatView: React.FC<Props> = ({
  conversation,
  keys,
  onSendMessage,
  isStreaming,
  onStop,
  currentModel,
  onOpenSettings,
  onRetry,
  onRetryWith,
  onEditUserMessage,
  selectedDocCount,
  onOpenDocumentsTab,
  onOpenEmailTab,
  availableModels,
  onUploadDroppedFiles,
  webSearch,
  onToggleWebSearch,
  onOpenSystemPrompt,
  onJudge,
  onSendCouncil,
  autoJudge,
  onToggleAutoJudge,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Check if any provider key is configured
  const hasAnyKey = !!(keys.openai || keys.gemini || keys.anthropic || keys.xai);

  const messages = conversation?.messages || [];

  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setUserHasScrolledUp(false);
    setShowJumpToBottom(false);
  }, []);

  // Handle scroll events
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distFromBottom > 150) {
      setUserHasScrolledUp(true);
      setShowJumpToBottom(true);
    } else {
      setUserHasScrolledUp(false);
      setShowJumpToBottom(false);
    }
  };

  // Auto-scroll when messages change or streaming updates unless scrolled up
  useEffect(() => {
    if (!userHasScrolledUp) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, userHasScrolledUp, scrollToBottom]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUploadDroppedFiles) {
      onUploadDroppedFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--canvas)] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-[var(--accent)]/10 border-2 border-dashed border-[var(--accent)] flex items-center justify-center backdrop-blur-xs pointer-events-none">
          <div className="bg-[var(--surface)] text-[var(--ink)] px-6 py-3 rounded-xl shadow-lg border border-[var(--line)] font-medium text-sm">
            Drop files to attach or index
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="max-w-[720px] mx-auto min-h-full flex flex-col justify-end">
          {/* Empty State / Welcome Screen matching Screenshot */}
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center my-auto">
              {/* Sparkle Icon */}
              <div className="w-12 h-12 rounded-2xl bg-[#EEF0FF] dark:bg-[#2A2A55] text-[#5B50EC] dark:text-[#8C8AF5] flex items-center justify-center mx-auto shadow-2xs">
                <Sparkles className="w-6 h-6" />
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl font-bold text-[var(--ink)] mt-3.5 tracking-tight">
                Welcome to Harness
              </h1>
              <p className="text-xs text-[var(--muted)] mt-1.5 max-w-md text-center leading-relaxed">
                A private AI workspace connecting directly to your favorite models. Your keys stay in your browser.
              </p>

              {/* Get Started in 3 Steps Card */}
              <div className="border border-[var(--line)] bg-[var(--surface)] rounded-2xl p-6 max-w-lg w-full mt-6 shadow-xs text-left">
                <div className="text-[11px] font-semibold text-[var(--muted)] tracking-wider uppercase mb-5">
                  GET STARTED IN 3 STEPS
                </div>

                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {hasAnyKey ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-[var(--line)]" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[var(--ink)]">1. Add an API key</div>
                        <div className="text-[11px] text-[var(--muted)]">OpenAI or free Google Gemini key</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="px-3.5 py-1.5 bg-[#5B50EC] hover:bg-[#4E43DC] text-white text-xs font-medium rounded-lg cursor-pointer transition shadow-2xs"
                    >
                      Open Settings
                    </button>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {currentModel ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--line)]" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--ink)]">2. Pick a model</div>
                      <div className="text-[11px] text-[var(--muted)]">Select from available chat models</div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--line)]" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--ink)]">3. Ask your first question</div>
                      <div className="text-[11px] text-[var(--muted)]">Attach documents, search the web, or draft emails</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((m, idx) => {
                const isLastUser =
                  m.role === 'user' && idx === messages.map((x) => x.role).lastIndexOf('user');
                const isLastAssistant =
                  m.role === 'assistant' && idx === messages.length - 1;

                return (
                  <MessageItem
                    key={m.id}
                    message={m}
                    isLastUserMessage={isLastUser}
                    isLastAssistantMessage={isLastAssistant}
                    onRetry={onRetry}
                    onRetryWith={onRetryWith}
                    onEditUserMessage={onEditUserMessage}
                    onOpenKeys={onOpenSettings}
                    onJudge={onJudge}
                    availableModels={availableModels}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Jump to bottom button */}
      {showJumpToBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-8 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-medium text-[var(--ink)] shadow-md hover:bg-[var(--canvas)] transition cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Jump to latest</span>
        </button>
      )}

      {/* Composer at Bottom */}
      <Composer
        onSendMessage={onSendMessage}
        onSendCouncil={onSendCouncil}
        isStreaming={isStreaming}
        onStop={onStop}
        currentModel={currentModel}
        keys={keys}
        onOpenSettings={onOpenSettings}
        selectedDocCount={selectedDocCount}
        onOpenDocumentsTab={onOpenDocumentsTab}
        onOpenEmailTab={onOpenEmailTab}
        webSearch={webSearch}
        onToggleWebSearch={onToggleWebSearch}
        onOpenSystemPrompt={onOpenSystemPrompt}
        autoJudge={autoJudge}
        onToggleAutoJudge={onToggleAutoJudge}
      />
    </div>
  );
};
