import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  removeToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// Global fallback handler for storage quota
let globalToastHandler: ((msg: string, type?: ToastType) => void) | null = null;
export function emitToast(msg: string, type: ToastType = 'info') {
  if (globalToastHandler) {
    globalToastHandler(msg, type);
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (type !== 'error') {
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    }
  }, [removeToast]);

  useEffect(() => {
    globalToastHandler = toast;
    return () => {
      globalToastHandler = null;
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div className="fixed z-50 pointer-events-none flex flex-col gap-2 p-4 top-4 sm:top-auto sm:bottom-4 right-4 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border shadow-sm transition-all text-sm ${
              t.type === 'error'
                ? 'bg-[var(--surface)] border-[var(--danger)] text-[var(--ink)]'
                : t.type === 'success'
                ? 'bg-[var(--surface)] border-[var(--success)] text-[var(--ink)]'
                : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
            }`}
          >
            {t.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
            )}
            {t.type === 'success' && (
              <CheckCircle className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5" />
            )}
            {t.type === 'info' && (
              <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium leading-snug">{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[var(--muted)] hover:text-[var(--ink)] p-0.5 rounded cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
