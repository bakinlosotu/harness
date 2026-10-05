import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, X, Check, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import {
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
} from '../lib/storage';
import { getProvider } from '../providers';
import { smartFetch } from '../lib/smartFetch';
import { testGmailConnection } from '../lib/gmail';

export type KeyStatus = 'not_set' | 'testing' | 'valid' | 'invalid' | 'network_error';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeysChanged: (newKeys: Keys) => void;
  onOpenDiagnostics: () => void;
}

export const KeysModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onKeysChanged,
  onOpenDiagnostics,
}) => {
  const [keys, setKeys] = useState<Keys>({});
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

  useEffect(() => {
    if (isOpen) {
      const loaded = loadKeys();
      setKeys(loaded);
      setRemember(isRememberKeys());
      setConfirmForget(false);

      // Initialize status indicators
      setStatuses({
        openai: loaded.openai ? 'valid' : 'not_set',
        gemini: loaded.gemini ? 'valid' : 'not_set',
        anthropic: loaded.anthropic ? 'valid' : 'not_set',
        xai: loaded.xai ? 'valid' : 'not_set',
        tavily: loaded.tavily ? 'valid' : 'not_set',
        gmail: loaded.gmailUser && loaded.gmailAppPassword ? 'valid' : 'not_set',
      });
    }
  }, [isOpen]);

  const toggleShow = (id: string) => {
    setShowKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyChange = (field: keyof Keys, val: string) => {
    const updated = { ...keys, [field]: val };
    setKeys(updated);
  };

  const testProviderKey = async (providerId: ProviderId, rawKey?: string) => {
    const key = cleanKey(rawKey || keys[providerId]);
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
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('reach') || msg.includes('network') || msg.includes('connection')) {
        setStatuses((prev) => ({ ...prev, [providerId]: 'network_error' }));
      } else {
        setStatuses((prev) => ({ ...prev, [providerId]: 'invalid' }));
      }
    }
  };

  const testTavilyKey = async (rawKey?: string) => {
    const key = cleanKey(rawKey || keys.tavily);
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
      } else {
        setStatuses((prev) => ({ ...prev, tavily: 'invalid' }));
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('reach') || msg.includes('network')) {
        setStatuses((prev) => ({ ...prev, tavily: 'network_error' }));
      } else {
        setStatuses((prev) => ({ ...prev, tavily: 'invalid' }));
      }
    }
  };

  const testGmail = async () => {
    const user = cleanKey(keys.gmailUser);
    const pass = cleanAppPassword(keys.gmailAppPassword);

    if (!user || !pass) {
      setStatuses((prev) => ({ ...prev, gmail: 'not_set' }));
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user) || pass.length !== 16) {
      setStatuses((prev) => ({ ...prev, gmail: 'invalid' }));
      return;
    }

    setStatuses((prev) => ({ ...prev, gmail: 'testing' }));
    try {
      // Check health first to see if server is deployed
      const healthRes = await fetch('/api/health').catch(() => null);
      if (!healthRes || !healthRes.ok) {
        setStatuses((prev) => ({ ...prev, gmail: 'network_error' }));
        return;
      }

      const ok = await testGmailConnection({ user, pass });
      setStatuses((prev) => ({ ...prev, gmail: ok ? 'valid' : 'invalid' }));
    } catch {
      setStatuses((prev) => ({ ...prev, gmail: 'invalid' }));
    }
  };

  const handleSaveAndClose = () => {
    setRememberKeys(remember);
    saveKeys(keys);
    onKeysChanged(keys);
    onClose();
  };

  const handleForget = () => {
    forgetAllKeys();
    const emptyKeys: Keys = {};
    setKeys(emptyKeys);
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
  };

  if (!isOpen) return null;

  const renderStatusChip = (status: KeyStatus) => {
    switch (status) {
      case 'testing':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)] font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…
          </span>
        );
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--success)] font-medium">
            <Check className="w-3.5 h-3.5" /> Valid
          </span>
        );
      case 'invalid':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--danger)] font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Invalid key
          </span>
        );
      case 'network_error':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Couldn't connect
          </span>
        );
      default:
        return <span className="text-xs text-[var(--muted)]">Not set</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] rounded-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-base font-semibold">API keys & credentials</h2>
          </div>
          <button
            onClick={handleSaveAndClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-sm">
          <div className="text-xs text-[var(--muted)] bg-[var(--canvas)] p-3 rounded-lg border border-[var(--line)]">
            Your keys are stored only in this browser and sent only to the provider you choose.
          </div>

          {/* 1. OpenAI */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-xs">OpenAI</label>
              {renderStatusChip(statuses.openai)}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeyMap.openai ? 'text' : 'password'}
                  value={keys.openai || ''}
                  onChange={(e) => handleKeyChange('openai', e.target.value)}
                  onBlur={() => keys.openai && testProviderKey('openai')}
                  placeholder="sk-proj-..."
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('openai')}
                  className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Toggle show key"
                >
                  {showKeyMap.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => testProviderKey('openai')}
                className="px-3 py-1.5 border border-[var(--line)] rounded-md text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
              >
                Test
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
              Get key at{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                platform.openai.com/api-keys
              </a>{' '}
              (OpenAI needs prepaid credits)
            </div>
          </div>

          {/* 2. Google Gemini */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-xs">Google Gemini</label>
              {renderStatusChip(statuses.gemini)}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeyMap.gemini ? 'text' : 'password'}
                  value={keys.gemini || ''}
                  onChange={(e) => handleKeyChange('gemini', e.target.value)}
                  onBlur={() => keys.gemini && testProviderKey('gemini')}
                  placeholder="AIzaSy..."
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('gemini')}
                  className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Toggle show key"
                >
                  {showKeyMap.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => testProviderKey('gemini')}
                className="px-3 py-1.5 border border-[var(--line)] rounded-md text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
              >
                Test
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
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

          {/* 3. Anthropic */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-xs">Anthropic (optional)</label>
              {renderStatusChip(statuses.anthropic)}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeyMap.anthropic ? 'text' : 'password'}
                  value={keys.anthropic || ''}
                  onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                  onBlur={() => keys.anthropic && testProviderKey('anthropic')}
                  placeholder="sk-ant-..."
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('anthropic')}
                  className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Toggle show key"
                >
                  {showKeyMap.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => testProviderKey('anthropic')}
                className="px-3 py-1.5 border border-[var(--line)] rounded-md text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
              >
                Test
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
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

          {/* 4. xAI */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-xs">xAI (optional)</label>
              {renderStatusChip(statuses.xai)}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeyMap.xai ? 'text' : 'password'}
                  value={keys.xai || ''}
                  onChange={(e) => handleKeyChange('xai', e.target.value)}
                  onBlur={() => keys.xai && testProviderKey('xai')}
                  placeholder="xai-..."
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('xai')}
                  className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Toggle show key"
                >
                  {showKeyMap.xai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => testProviderKey('xai')}
                className="px-3 py-1.5 border border-[var(--line)] rounded-md text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
              >
                Test
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
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

          {/* 5. Tavily */}
          <div className="space-y-1.5 pt-1 border-t border-[var(--line)]">
            <div className="flex items-center justify-between">
              <label className="font-medium text-xs">Web search: Tavily (free, optional)</label>
              {renderStatusChip(statuses.tavily)}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeyMap.tavily ? 'text' : 'password'}
                  value={keys.tavily || ''}
                  onChange={(e) => handleKeyChange('tavily', e.target.value)}
                  onBlur={() => keys.tavily && testTavilyKey()}
                  placeholder="tvly-..."
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('tavily')}
                  className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Toggle show key"
                >
                  {showKeyMap.tavily ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => testTavilyKey()}
                className="px-3 py-1.5 border border-[var(--line)] rounded-md text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
              >
                Test
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
              Free: 1,000 searches a month, no card. Without it, web search uses Wikipedia.{' '}
              <a
                href="https://app.tavily.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                app.tavily.com
              </a>
            </div>
          </div>

          {/* 6. Gmail */}
          <div className="space-y-2 pt-1 border-t border-[var(--line)]">
            <div className="flex items-center justify-between">
              <label className="font-medium text-xs">Gmail (optional)</label>
              {renderStatusChip(statuses.gmail)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  type="email"
                  value={keys.gmailUser || ''}
                  onChange={(e) => handleKeyChange('gmailUser', e.target.value)}
                  placeholder="Gmail address"
                  className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeyMap.gmailAppPassword ? 'text' : 'password'}
                    value={keys.gmailAppPassword || ''}
                    onChange={(e) => handleKeyChange('gmailAppPassword', e.target.value)}
                    placeholder="App password (16 chars)"
                    maxLength={20}
                    className="w-full bg-[var(--canvas)] border border-[var(--line)] rounded-md px-3 py-1.5 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('gmailAppPassword')}
                    className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
                    aria-label="Toggle show app password"
                  >
                    {showKeyMap.gmailAppPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={testGmail}
                  className="px-3 py-1.5 border border-[var(--line)] rounded-md text-xs font-medium hover:bg-[var(--canvas)] cursor-pointer"
                >
                  Test
                </button>
              </div>
            </div>
            <div className="text-xs text-[var(--muted)] leading-relaxed">
              Create one at{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                myaccount.google.com/apppasswords
              </a>{' '}
              (needs 2-Step Verification). Use it here, not your normal password.
            </div>
            <div className="text-xs text-[var(--muted)] bg-[var(--canvas)] p-2.5 rounded border border-[var(--line)] leading-relaxed">
              An app password gives full access to your mailbox. It passes through this app's server only for each request and is never stored there. Revoke it any time at myaccount.google.com/apppasswords.
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
                  onClick={handleForget}
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--canvas)] flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
          >
            Run diagnostics
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-md hover:opacity-90 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
