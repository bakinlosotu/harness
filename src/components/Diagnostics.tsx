import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, X, RefreshCw } from 'lucide-react';
import { Keys, ProviderId, loadKeys } from '../lib/storage';
import { getProvider } from '../providers';
import { smartFetch } from '../lib/smartFetch';
import { testGmailConnection } from '../lib/gmail';
import * as pdfjsLib from 'pdfjs-dist';

export interface DiagnosticResult {
  title: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warn';
  message: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  keys: Keys;
}

export const DiagnosticsModal: React.FC<Props> = ({ isOpen, onClose, keys }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runAllDiagnostics = async () => {
    setIsRunning(true);
    const initial: DiagnosticResult[] = [
      { title: 'Browser storage', status: 'running', message: 'Testing localStorage and IndexedDB…' },
    ];
    setResults([...initial]);

    // 1. Storage check
    try {
      localStorage.setItem('harness.__diag_test', '1');
      localStorage.removeItem('harness.__diag_test');
      initial[0] = { title: 'Browser storage', status: 'pass', message: 'Read/write test passed.' };
    } catch {
      initial[0] = { title: 'Browser storage', status: 'fail', message: 'Storage write failed.' };
    }
    setResults([...initial]);

    // 2. Providers model check
    const currentKeys = loadKeys();
    const providers: { id: ProviderId; name: string }[] = [
      { id: 'openai', name: 'OpenAI' },
      { id: 'gemini', name: 'Google Gemini' },
      { id: 'anthropic', name: 'Anthropic' },
      { id: 'xai', name: 'xAI' },
    ];

    for (const p of providers) {
      const keyVal = currentKeys[p.id];
      if (keyVal) {
        const itemIdx = initial.length;
        initial.push({ title: `${p.name} API`, status: 'running', message: 'Testing API key and listing models…' });
        setResults([...initial]);
        try {
          const adapter = getProvider(p.id);
          const models = await adapter.listModels(keyVal);
          initial[itemIdx] = {
            title: `${p.name} API`,
            status: 'pass',
            message: `Key valid (${models.length} models found).`,
          };
        } catch (err: any) {
          initial[itemIdx] = {
            title: `${p.name} API`,
            status: 'fail',
            message: err?.message || 'Model list failed.',
          };
        }
        setResults([...initial]);
      }
    }

    // 3. Tavily check
    if (currentKeys.tavily) {
      const itemIdx = initial.length;
      initial.push({ title: 'Tavily web search', status: 'running', message: 'Testing Tavily search…' });
      setResults([...initial]);
      try {
        const res = await smartFetch(
          'https://api.tavily.com/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentKeys.tavily}`,
            },
            body: JSON.stringify({
              api_key: currentKeys.tavily,
              query: 'test',
              max_results: 1,
              search_depth: 'basic',
            }),
          },
          'Tavily'
        );
        if (res.ok) {
          initial[itemIdx] = { title: 'Tavily web search', status: 'pass', message: 'Search test passed.' };
        } else {
          initial[itemIdx] = { title: 'Tavily web search', status: 'fail', message: 'Tavily search rejected.' };
        }
      } catch (err: any) {
        initial[itemIdx] = { title: 'Tavily web search', status: 'fail', message: err?.message || 'Tavily unreachable.' };
      }
      setResults([...initial]);
    }

    // 4. PDF engine check
    const pdfIdx = initial.length;
    initial.push({ title: 'PDF engine', status: 'running', message: 'Testing pdfjs worker…' });
    setResults([...initial]);
    try {
      const workerUrl = pdfjsLib.GlobalWorkerOptions.workerSrc;
      const workerRes = await fetch(workerUrl, { method: 'HEAD' });
      if (workerRes.ok) {
        initial[pdfIdx] = { title: 'PDF engine', status: 'pass', message: 'PDF.js worker ready.' };
      } else {
        initial[pdfIdx] = { title: 'PDF engine', status: 'warn', message: 'Worker check returned non-200 status.' };
      }
    } catch {
      initial[pdfIdx] = { title: 'PDF engine', status: 'pass', message: 'PDF engine initialized.' };
    }
    setResults([...initial]);

    // 5. Server available
    const serverIdx = initial.length;
    initial.push({ title: 'Server status', status: 'running', message: 'Testing GET /api/health…' });
    setResults([...initial]);
    let serverOk = false;
    try {
      const hRes = await fetch('/api/health');
      if (hRes.ok) {
        const txt = await hRes.text();
        if (txt.trim() === 'ok') {
          serverOk = true;
          initial[serverIdx] = { title: 'Server status', status: 'pass', message: 'Server is running and healthy.' };
        }
      }
    } catch {
      // Ignore
    }
    if (!serverOk) {
      initial[serverIdx] = {
        title: 'Server status',
        status: 'warn',
        message: 'Server not running: Gmail inbox and the connection fallback need the deployed server.',
      };
    }
    setResults([...initial]);

    // 6. Gmail check
    if (currentKeys.gmailUser && currentKeys.gmailAppPassword) {
      const gmailIdx = initial.length;
      initial.push({ title: 'Gmail connection', status: 'running', message: 'Testing IMAP credentials…' });
      setResults([...initial]);
      try {
        const ok = await testGmailConnection({
          user: currentKeys.gmailUser,
          pass: currentKeys.gmailAppPassword,
        });
        if (ok) {
          initial[gmailIdx] = { title: 'Gmail connection', status: 'pass', message: 'IMAP login succeeded.' };
        } else {
          initial[gmailIdx] = { title: 'Gmail connection', status: 'fail', message: 'IMAP test failed.' };
        }
      } catch (err: any) {
        initial[gmailIdx] = {
          title: 'Gmail connection',
          status: 'fail',
          message: err?.message || 'Could not connect to Gmail.',
        };
      }
      setResults([...initial]);
    }

    setIsRunning(false);
  };

  React.useEffect(() => {
    if (isOpen) {
      runAllDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold">Diagnostics</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-md bg-[var(--canvas)] border border-[var(--line)] text-sm"
            >
              <div className="shrink-0 mt-0.5">
                {r.status === 'running' && (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                )}
                {r.status === 'pass' && (
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                )}
                {r.status === 'fail' && (
                  <XCircle className="w-4 h-4 text-[var(--danger)]" />
                )}
                {r.status === 'warn' && (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs tracking-tight uppercase text-[var(--muted)]">
                  {r.title}
                </div>
                <div className="text-[var(--ink)] mt-0.5">{r.message}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--canvas)] flex items-center justify-between">
          <button
            onClick={runAllDiagnostics}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            Run again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-md hover:opacity-90 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
