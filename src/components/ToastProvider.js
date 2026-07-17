'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

const TONE_CLASSES = {
  error: 'bg-white/95 border-rose-200 border-l-4 border-l-rose-500 text-rose-700',
  success: 'bg-white/95 border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-700',
  info: 'bg-white/95 border-slate-200 border-l-4 border-l-indigo-500 text-slate-700',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto max-w-sm w-full sm:w-auto cursor-pointer font-mono text-xs px-4 py-3 rounded-xl border shadow-xl shadow-slate-300/40 backdrop-blur-xl transition-all hover:-translate-y-0.5 ${TONE_CLASSES[t.type] || TONE_CLASSES.info}`}
            style={{ animation: 'slideIn 0.25s ease-out' }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
