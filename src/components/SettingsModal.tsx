import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  Activity,
  Sliders,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Scale,
  Users,
} from 'lucide-react';
import {
  Theme,
  Conversation,
  Keys,
  ProviderId,
  cleanKey,
  cleanAppPassword,
  saveKeys,
  loadKeys,
  forgetAllKeys,
  isRememberKeys,
  setRememberKeys,
  setCachedModels,
  exportAllData,
  importData,
  deleteAllData,
} from '../lib/storage';
import { DEFAULT_SYSTEM_PROMPT } from '../lib/rag';
import { getProvider } from '../providers';
import { smartFetch } from '../lib/smartFetch';
import { testGmailConnection } from '../lib/gmail';
import { useToast } from './Toasts';
import { KeyStatus } from './KeysModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'keys' | 'chat' | 'data';
  keys: Keys;
  onKeysChanged: (newKeys: Keys) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  currentConversation: Conversation | null;
  onUpdateConversationSettings: (settings: { systemPrompt: string; temperature: number | null }) => void;
  onOpenDiagnostics: () => void;
  onDataReset: () => void;
  autoJudge: boolean;
  onToggleAutoJudge: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialTab = 'keys',
  keys: propKeys,
  onKeysChanged,
  theme,
  onThemeChange,
  currentConversation,
  onUpdateConversationSettings,
  onOpenDiagnostics,
  onDataReset,
  autoJudge,
  onToggleAutoJudge,
}) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'chat' | 'data'>(initialTab);
  const { toast } = useToast();

  // Keys state
  const [localKeys, setLocalKeys] = useState<Keys>({});
  const [remember, setRemember] = useState(false);
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({
    openai: 'not_set',
    gemini: 'not_set',
    anthropic: 'not_set',
    xai: 'not_set',
    tavily: 'not_set',
    gmail: 'not_set',
  });
  const [confirmForget, setConfirmForget] = useState(false);

  // Chat settings state
  const [sysPrompt, setSysPrompt] = useState(
    currentConversation?.settings.systemPrompt || DEFAULT_SYSTEM_PROMPT
  );
  const [temperature, setTemperature] = useState<number | null>(
    currentConversation?.settings.temperature ?? null
  );

  // Data backup state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const loaded = loadKeys();
      setLocalKeys(loaded);
      setRemember(isRememberKeys());
      setConfirmForget(false);

      setStatuses({
        openai: loaded.openai ? 'valid' : 'not_set',
        gemini: loaded.gemini ? 'valid' : 'not_set',
        anthropic: loaded.anthropic ? 'valid' : 'not_set',
        xai: loaded.xai ? 'valid' : 'not_set',
        tavily: loaded.tavily ? 'valid' : 'not_set',
        gmail: loaded.gmailUser && loaded.gmailAppPassword ? 'valid' : 'not_set',
      });

      if (currentConversation) {
        setSysPrompt(currentConversation.settings.systemPrompt || DEFAULT_SYSTEM_PROMPT);
        setTemperature(currentConversation.settings.temperature ?? null);
      }
    }
  }, [isOpen, initialTab, currentConversation]);

  if (!isOpen) return null;

  const toggleShow = (id: string) => {
    setShowKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyChange = (field: keyof Keys, val: string) => {
    const updated = { ...localKeys, [field]: val };
    setLocalKeys(updated);
  };

  const testProviderKey = async (providerId: ProviderId) => {
    const key = cleanKey(localKeys[providerId]);
    if (!key) {
      setStatuses((prev) => ({ ...prev, [providerId]: 'not_set' }));
      return;
    }

    setStatuses((prev) => ({ ...prev, [providerId]: 'testing' }));
    try {
      const adapter = getProvider(providerId);
      const models = await adapter.listModels(key);
      if (models.length > 0) {
        setCachedModels(providerId, models);
      }
      setStatuses((prev) => ({ ...prev, [providerId]: 'valid' }));
    } catch {
      setStatuses((prev) => ({ ...prev, [providerId]: 'invalid' }));
    }
  };

  const testTavilyKey = async () => {
    const key = cleanKey(localKeys.tavily);
    if (!key) {
      setStatuses((prev) => ({ ...prev, tavily: 'not_set' }));
      return;
    }

    setStatuses((prev) => ({ ...prev, tavily: 'testing' }));
    try {
      const res = await smartFetch(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            api_key: key,
            query: 'test',
            max_results: 1,
            search_depth: 'basic',
          }),
        },
        'Tavily'
      );
      if (res.ok) {
        setStatuses((prev) => ({ ...prev, tavily: 'valid' }));
        // Auto-save verified key
        const updated = { ...localKeys, tavily: key };
        saveKeys(updated);
        onKeysChanged(updated);
        toast('Tavily API key is valid and saved! Web search is ready.', 'success');
      } else {
        const errText = await res.text();
        setStatuses((prev) => ({ ...prev, tavily: 'invalid' }));
        toast(`Tavily key test failed: ${errText.slice(0, 120)}`, 'error');
      }
    } catch (err: any) {
      setStatuses((prev) => ({ ...prev, tavily: 'invalid' }));
      toast(`Tavily test error: ${err?.message || 'could not reach Tavily'}`, 'error');
    }
  };

  const testGmail = async () => {
    const user = cleanKey(localKeys.gmailUser);
    const pass = cleanAppPassword(localKeys.gmailAppPassword);

    if (!user || !pass || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user) || pass.length !== 16) {
      setStatuses((prev) => ({ ...prev, gmail: 'invalid' }));
      return;
    }

    setStatuses((prev) => ({ ...prev, gmail: 'testing' }));
    try {
      const ok = await testGmailConnection({ user, pass });
      setStatuses((prev) => ({ ...prev, gmail: ok ? 'valid' : 'invalid' }));
    } catch {
      setStatuses((prev) => ({ ...prev, gmail: 'invalid' }));
    }
  };

  const handleSaveAndClose = () => {
    setRememberKeys(remember);
    saveKeys(localKeys);
    onKeysChanged(localKeys);
    if (currentConversation) {
      onUpdateConversationSettings({
        systemPrompt: sysPrompt,
        temperature,
      });
    }
    onClose();
  };

  const handleForgetKeys = () => {
    forgetAllKeys();
    const emptyKeys: Keys = {};
    setLocalKeys(emptyKeys);
    setStatuses({
      openai: 'not_set',
      gemini: 'not_set',
      anthropic: 'not_set',
      xai: 'not_set',
      tavily: 'not_set',
      gmail: 'not_set',
    });
    setConfirmForget(false);
    onKeysChanged(emptyKeys);
    toast('All keys forgotten.', 'info');
  };

  const handleExportThisChat = () => {
    if (!currentConversation || currentConversation.messages.length === 0) {
      toast('No messages to export.', 'info');
      return;
    }

    let md = `# ${currentConversation.title}\n\n`;
    for (const m of currentConversation.messages) {
      const sender = m.role === 'user' ? 'User' : `Assistant (${m.model?.label || m.model?.id || 'Model'})`;
      md += `### ${sender}\n\n${m.text}\n\n`;
      if (m.citations && m.citations.length > 0) {
        md += `*Sources:*\n`;
        for (const c of m.citations) {
          md += `- [${c.n}] ${c.title}${c.page ? ` (page ${c.page})` : ''}${c.url ? ` (${c.url})` : ''}\n`;
        }
        md += '\n';
      }
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentConversation.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Chat exported as Markdown.', 'success');
  };

  const handleExportAll = async () => {
    try {
      const jsonStr = await exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `harness_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('All data exported.', 'success');
    } catch {
      toast('Export failed.', 'error');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importData(text);
      toast(
        `Imported ${result.importedConvs} chats and ${result.importedDocs} documents.`,
        'success'
      );
      onDataReset();
    } catch (err: any) {
      toast(err?.message || 'Failed to import data', 'error');
    }
    e.target.value = '';
  };

  const handleDeleteAll = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      toast('Type "delete" to confirm.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAllData();
      toast('All conversations and documents deleted.', 'success');
      onDataReset();
      onClose();
    } catch {
      toast('Failed to delete data.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusChip = (status: KeyStatus) => {
    switch (status) {
      case 'testing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] font-medium">
            <Loader2 className="w-3 h-3 animate-spin" /> Testing…
          </span>
        );
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--success)] font-medium">
            <Check className="w-3 h-3" /> Valid
          </span>
        );
      case 'invalid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--danger)] font-medium">
            <AlertCircle className="w-3 h-3" /> Invalid key
          </span>
        );
      case 'network_error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
            <AlertCircle className="w-3 h-3" /> Couldn't connect
          </span>
        );
      default:
        return <span className="text-[11px] text-[var(--muted)]">Not set</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh] shadow-2xl animate-in fade-in duration-100">
        {/* Header & Tabs */}
        <div className="px-5 pt-4 pb-2 border-b border-[var(--line)] bg-[var(--surface)] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold tracking-tight">Settings</h2>
            <button
              onClick={handleSaveAndClose}
              className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-1 border-b border-transparent">
            <button
              type="button"
              onClick={() => setActiveTab('keys')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                activeTab === 'keys'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>API keys</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                activeTab === 'chat'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Chat & prompt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                activeTab === 'data'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Data & backup</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
          {/* TAB 1: API KEYS */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <div className="text-[11px] text-[var(--muted)] bg-[var(--canvas)] p-3 rounded-lg border border-[var(--line)]">
                Your keys are stored only in this browser and sent directly to the provider.
              </div>

              {/* OpenAI */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs">OpenAI</label>
                  {renderStatusChip(statuses.openai)}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeyMap.openai ? 'text' : 'password'}
                      value={localKeys.openai || ''}
                      onChange={(e) => handleKeyChange('openai', e.target.value)}
                      onBlur={() => localKeys.openai && testProviderKey('openai')}
                      placeholder="sk-proj-..."
                      className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-lg px-3 py-1.5 pr-8 text-xs text-[var(--ink)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow('openai')}
                      className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {showKeyMap.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => testProviderKey('openai')}
                    className="px-3 py-1.5 border border-[var(--line)] rounded-lg text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
                  >
                    Test
                  </button>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Get key at{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    platform.openai.com/api-keys
                  </a>
                </div>
              </div>

              {/* Gemini */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs">Google Gemini</label>
                  {renderStatusChip(statuses.gemini)}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeyMap.gemini ? 'text' : 'password'}
                      value={localKeys.gemini || ''}
                      onChange={(e) => handleKeyChange('gemini', e.target.value)}
                      onBlur={() => localKeys.gemini && testProviderKey('gemini')}
                      placeholder="AIzaSy..."
                      className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-lg px-3 py-1.5 pr-8 text-xs text-[var(--ink)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow('gemini')}
                      className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {showKeyMap.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => testProviderKey('gemini')}
                    className="px-3 py-1.5 border border-[var(--line)] rounded-lg text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
                  >
                    Test
                  </button>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Free key available at{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    aistudio.google.com/apikey
                  </a>
                </div>
              </div>

              {/* Anthropic */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs">Anthropic (optional)</label>
                  {renderStatusChip(statuses.anthropic)}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeyMap.anthropic ? 'text' : 'password'}
                      value={localKeys.anthropic || ''}
                      onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                      onBlur={() => localKeys.anthropic && testProviderKey('anthropic')}
                      placeholder="sk-ant-..."
                      className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-lg px-3 py-1.5 pr-8 text-xs text-[var(--ink)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow('anthropic')}
                      className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {showKeyMap.anthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => testProviderKey('anthropic')}
                    className="px-3 py-1.5 border border-[var(--line)] rounded-lg text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
                  >
                    Test
                  </button>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Get key at{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    console.anthropic.com/settings/keys
                  </a>
                </div>
              </div>

              {/* xAI */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs">xAI (optional)</label>
                  {renderStatusChip(statuses.xai)}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeyMap.xai ? 'text' : 'password'}
                      value={localKeys.xai || ''}
                      onChange={(e) => handleKeyChange('xai', e.target.value)}
                      onBlur={() => localKeys.xai && testProviderKey('xai')}
                      placeholder="xai-..."
                      className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-lg px-3 py-1.5 pr-8 text-xs text-[var(--ink)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow('xai')}
                      className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {showKeyMap.xai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => testProviderKey('xai')}
                    className="px-3 py-1.5 border border-[var(--line)] rounded-lg text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
                  >
                    Test
                  </button>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Get key at{' '}
                  <a
                    href="https://console.x.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    console.x.ai
                  </a>
                </div>
              </div>

              {/* Tavily */}
              <div className="space-y-1 pt-2 border-t border-[var(--line)]">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs">Web search: Tavily (free, optional)</label>
                  {renderStatusChip(statuses.tavily)}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeyMap.tavily ? 'text' : 'password'}
                      value={localKeys.tavily || ''}
                      onChange={(e) => handleKeyChange('tavily', e.target.value)}
                      placeholder="tvly-..."
                      className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-lg px-3 py-1.5 pr-8 text-xs text-[var(--ink)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow('tavily')}
                      className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {showKeyMap.tavily ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={testTavilyKey}
                    className="px-3 py-1.5 border border-[var(--line)] rounded-lg text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
                  >
                    Test
                  </button>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Free: 1,000 searches/month at{' '}
                  <a
                    href="https://app.tavily.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    app.tavily.com
                  </a>
                  . Without it, web search uses Wikipedia.
                </div>
              </div>

              {/* Options */}
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-[var(--line)] accent-[var(--accent)]"
                  />
                  Remember keys on this device
                </label>

                {!confirmForget ? (
                  <button
                    type="button"
                    onClick={() => setConfirmForget(true)}
                    className="text-xs text-[var(--danger)] hover:underline cursor-pointer"
                  >
                    Forget all keys
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--danger)]">Clear all keys?</span>
                    <button
                      type="button"
                      onClick={handleForgetKeys}
                      className="px-2 py-0.5 bg-[var(--danger)] text-white text-xs rounded hover:opacity-90 cursor-pointer"
                    >
                      Yes, forget
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmForget(false)}
                      className="text-xs text-[var(--muted)] hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CHAT & PROMPT */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  System prompt
                </label>
                <p className="text-[11px] text-[var(--muted)] mb-2">
                  Instructions for the AI model in this conversation.
                </p>
                <textarea
                  value={sysPrompt}
                  onChange={(e) => setSysPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-lg p-2.5 text-xs text-[var(--ink)] focus:outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">
                    Temperature:{' '}
                    <span className="font-semibold text-[var(--ink)]">
                      {temperature !== null ? temperature.toFixed(2) : 'Default (empty)'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setTemperature(null)}
                    className="text-[var(--accent)] hover:underline text-[11px] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature ?? 0.7}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>

              {/* LLM as a Judge Section */}
              <div className="space-y-2 pt-3 border-t border-[var(--line)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--ink)]">
                    <Scale className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>LLM as a Judge (Accuracy Evaluator)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoJudge}
                      onChange={onToggleAutoJudge}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--line)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent)]" />
                  </label>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  When enabled, every assistant answer is automatically submitted to an independent evaluator model from another AI lab to grade its accuracy (0–100), completeness, and flag hallucination risks.
                </p>
              </div>

              {/* AI Council Information */}
              <div className="space-y-2 pt-3 border-t border-[var(--line)]">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--ink)]">
                  <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>AI Council (Multi-Model Debate)</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Convene 2–3 models across Google, OpenAI, Anthropic, and xAI. Council models present initial positions, cross-examine peer arguments, and synthesize a definitive consensus verdict.
                </p>
              </div>

              {/* Appearance / Theme */}
              <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                <label className="font-semibold text-xs text-[var(--ink)]">Appearance</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onThemeChange('system')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition ${
                      theme === 'system'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                        : 'border-[var(--line)] bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>System</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onThemeChange('light')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition ${
                      theme === 'light'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                        : 'border-[var(--line)] bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onThemeChange('dark')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition ${
                      theme === 'dark'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                        : 'border-[var(--line)] bg-[var(--canvas)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA & BACKUP */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportThisChat}
                  className="flex items-center gap-1.5 p-2.5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface)] text-[var(--ink)] font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span>Export this chat (MD)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAll}
                  className="flex items-center gap-1.5 p-2.5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface)] text-[var(--ink)] font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span>Export all data (JSON)</span>
                </button>

                <input
                  type="file"
                  ref={importFileRef}
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="flex items-center gap-1.5 p-2.5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface)] text-[var(--ink)] font-medium cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span>Import data (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDiagnostics();
                  }}
                  className="flex items-center gap-1.5 p-2.5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface)] text-[var(--ink)] font-medium cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span>Run diagnostics</span>
                </button>
              </div>

              {/* Danger zone */}
              <div className="space-y-2 pt-3 border-t border-[var(--line)]">
                <label className="font-semibold text-xs text-[var(--danger)]">Danger zone</label>
                <p className="text-[11px] text-[var(--muted)]">
                  Permanently delete all chats and documents stored in this browser.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder='Type "delete" to confirm'
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="flex-1 bg-[var(--canvas)] border border-[var(--line)] rounded-lg px-3 py-1.5 text-xs text-[var(--ink)]"
                  />
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isDeleting}
                    className="px-3 py-1.5 bg-[var(--danger)] text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete all</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--canvas)] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
          >
            Run diagnostics
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-4 py-1.5 bg-[#5B50EC] hover:bg-[#4E43DC] text-white text-xs font-medium rounded-lg cursor-pointer transition shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
