import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Loader2, Plus, AlertCircle } from 'lucide-react';
import { Keys, ModelRef, ProviderId, getCachedModels, setCachedModels } from '../lib/storage';
import { getProvider } from '../providers';

interface Props {
  currentModel: ModelRef | null;
  keys: Keys;
  onSelectModel: (model: ModelRef) => void;
  onOpenKeys: () => void;
}

export const getProviderLetter = (p: ProviderId): string => {
  switch (p) {
    case 'openai':
      return 'O';
    case 'anthropic':
      return 'C';
    case 'gemini':
      return 'G';
    case 'xai':
      return 'X';
  }
};

export const getProviderBadgeClass = (p: ProviderId): string => {
  switch (p) {
    case 'openai':
      return 'bg-emerald-600 text-white';
    case 'anthropic':
      return 'bg-amber-700 text-white';
    case 'gemini':
      return 'bg-blue-600 text-white';
    case 'xai':
      return 'bg-stone-800 text-white';
  }
};

function getModelTags(id: string): string[] {
  const lower = id.toLowerCase();
  const tags: string[] = [];
  if (lower.startsWith('o1') || lower.startsWith('o3') || lower.includes('thinking') || lower.includes('reasoning')) {
    tags.push('reasoning');
  }
  if (
    lower.includes('4o') ||
    lower.includes('vision') ||
    lower.includes('sonnet') ||
    lower.includes('opus') ||
    lower.includes('haiku') ||
    lower.includes('gemini') ||
    lower.includes('flash') ||
    lower.includes('pro')
  ) {
    tags.push('vision');
  }
  return tags;
}

export const ModelPicker: React.FC<Props> = ({
  currentModel,
  keys,
  onSelectModel,
  onOpenKeys,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [modelsMap, setModelsMap] = useState<Record<string, { id: string; label: string }[]>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [manualInputMap, setManualInputMap] = useState<Record<string, string>>({});

  // Custom model form state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customProvider, setCustomProvider] = useState<ProviderId>('openai');
  const [customModelId, setCustomModelId] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const providerOrder: { id: ProviderId; name: string }[] = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'xai', name: 'xAI' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // Load models on open if keys exist
  useEffect(() => {
    if (!isOpen) return;

    for (const p of providerOrder) {
      const key = keys[p.id];
      if (!key) continue;

      const cached = getCachedModels(p.id);
      if (cached && cached.length > 0) {
        setModelsMap((prev) => ({ ...prev, [p.id]: cached }));
        continue;
      }

      setLoadingMap((prev) => ({ ...prev, [p.id]: true }));
      setErrorMap((prev) => ({ ...prev, [p.id]: '' }));

      const adapter = getProvider(p.id);
      adapter
        .listModels(key)
        .then((list) => {
          setModelsMap((prev) => ({ ...prev, [p.id]: list }));
          setCachedModels(p.id, list);
        })
        .catch((err) => {
          setErrorMap((prev) => ({ ...prev, [p.id]: err?.message || 'Failed to list models' }));
        })
        .finally(() => {
          setLoadingMap((prev) => ({ ...prev, [p.id]: false }));
        });
    }
  }, [isOpen, keys]);

  const handleSelect = (provider: ProviderId, id: string, label: string) => {
    onSelectModel({ provider, id, label });
    setIsOpen(false);
  };

  const handleManualAdd = (provider: ProviderId) => {
    const typed = (manualInputMap[provider] || '').trim();
    if (typed) {
      handleSelect(provider, typed, typed);
      setManualInputMap((prev) => ({ ...prev, [provider]: '' }));
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customModelId.trim();
    if (clean) {
      handleSelect(customProvider, clean, clean);
      setShowCustomForm(false);
      setCustomModelId('');
    }
  };

  // Check if current model's key is still available
  const hasCurrentModelKey = currentModel && !!keys[currentModel.provider];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--canvas)] text-xs font-medium cursor-pointer transition shadow-2xs max-w-[260px]"
        aria-label="Model picker"
      >
        {hasCurrentModelKey && currentModel ? (
          <>
            <span className="w-2 h-2 rounded-full bg-[var(--success)] shrink-0" />
            <span className="truncate text-[var(--ink)] font-medium">{currentModel.label || currentModel.id}</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-[var(--muted)]/50 shrink-0" />
            <span className="text-[var(--muted)] font-normal">Choose a model</span>
          </>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] shrink-0 ml-auto" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 max-h-[440px] rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xl z-40 flex flex-col text-sm overflow-hidden animate-in fade-in duration-100">
          {/* Search box */}
          <div className="p-2 border-b border-[var(--line)] bg-[var(--surface)]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter models…"
                className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md pl-8 pr-3 py-1 text-xs text-[var(--ink)] placeholder:text-[var(--muted)]"
                autoFocus
              />
            </div>
          </div>

          {/* Model list grouped by provider */}
          <div className="overflow-y-auto flex-1 p-2 space-y-3">
            {providerOrder.map((p) => {
              const hasKey = !!keys[p.id];
              const isLoading = loadingMap[p.id];
              const error = errorMap[p.id];
              const allModels = modelsMap[p.id] || [];

              const filtered = allModels.filter(
                (m) =>
                  m.id.toLowerCase().includes(search.toLowerCase()) ||
                  m.label.toLowerCase().includes(search.toLowerCase())
              );

              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                    <span>{p.name}</span>
                    {!hasKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenKeys();
                        }}
                        className="text-[var(--accent)] hover:underline font-normal text-[11px] cursor-pointer"
                      >
                        Add key
                      </button>
                    )}
                  </div>

                  {!hasKey ? (
                    <div className="px-2 py-1.5 text-xs text-[var(--muted)] italic">
                      Add a key to use these models
                    </div>
                  ) : isLoading ? (
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--muted)]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading models…
                    </div>
                  ) : error ? (
                    <div className="px-2 py-1.5 space-y-1.5">
                      <div className="text-xs text-[var(--danger)] flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={manualInputMap[p.id] || ''}
                          onChange={(e) =>
                            setManualInputMap((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="Type a model ID"
                          className="flex-1 bg-[var(--canvas)] border border-[var(--line)] rounded px-2 py-0.5 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleManualAdd(p.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleManualAdd(p.id)}
                          className="px-2 py-0.5 bg-[var(--accent)] text-white text-xs rounded cursor-pointer"
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-[var(--muted)] italic">
                      {search ? 'No matching models' : 'No models available'}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {filtered.slice(0, 30).map((m) => {
                        const isSelected =
                          currentModel?.provider === p.id && currentModel?.id === m.id;
                        const tags = getModelTags(m.id);

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelect(p.id, m.id, m.label)}
                            className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                                : 'text-[var(--ink)] hover:bg-[var(--canvas)]'
                            }`}
                          >
                            <span className="truncate pr-2">{m.label}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {tags.map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.2 text-[10px] rounded bg-[var(--canvas)] text-[var(--muted)] border border-[var(--line)]"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom model ID row / form */}
          <div className="p-2 border-t border-[var(--line)] bg-[var(--canvas)]">
            {!showCustomForm ? (
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="w-full text-left px-2 py-1 text-xs text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Custom model ID…
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="space-y-1.5">
                <div className="flex gap-1.5">
                  <select
                    value={customProvider}
                    onChange={(e) => setCustomProvider(e.target.value as ProviderId)}
                    className="bg-[var(--surface)] border border-[var(--line)] rounded px-1.5 py-1 text-xs text-[var(--ink)]"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="xai">xAI</option>
                  </select>
                  <input
                    type="text"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    placeholder="e.g. gpt-4.5-preview"
                    className="flex-1 bg-[var(--surface)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--ink)]"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(false)}
                    className="px-2 py-0.5 text-xs text-[var(--muted)] hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-0.5 bg-[var(--accent)] text-white text-xs rounded hover:opacity-90 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
