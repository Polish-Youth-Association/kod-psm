"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { IconAlert, IconCheck, IconX } from "./icons";

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; title: string; body?: string };

const ToastContext = createContext<(kind: ToastKind, title: string, body?: string) => void>(() => {});

/** `const toast = useToast(); toast("success", "Email sent", "to anna@example.com")` */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, body?: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, title, body }]);
      setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-3 sm:w-96">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-toast-in glass rounded-2xl shadow-lift p-4 flex items-start gap-3"
          >
            <div
              className={[
                "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white",
                t.kind === "success"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                  : "bg-gradient-to-br from-brand-red to-brand-rose",
              ].join(" ")}
            >
              {t.kind === "success" ? <IconCheck className="w-5 h-5" /> : <IconAlert className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-ink">{t.title}</p>
              {t.body && <p className="text-sm text-gray-600 mt-0.5 break-words">{t.body}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Dismiss"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
