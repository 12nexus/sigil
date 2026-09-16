"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

export type ToastTone = "info" | "success" | "error";

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /** Optional recovery action, e.g. "Retry". */
  action?: { label: string; run: () => void };
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      if (toast.tone !== "error") {
        setTimeout(() => dismiss(id), 5000);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto animate-rise rounded-xl border p-4 shadow-lift backdrop-blur",
              toast.tone === "error"
                ? "border-danger/40 bg-danger/10"
                : toast.tone === "success"
                  ? "border-accent/40 bg-accent/10"
                  : "border-line bg-surface-2/95",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                {toast.tone === "error" ? (
                  <AlertTriangle size={16} className="text-danger" />
                ) : toast.tone === "success" ? (
                  <CheckCircle2 size={16} className="text-accent" />
                ) : (
                  <Info size={16} className="text-muted" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{toast.title}</p>
                {toast.body ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted">{toast.body}</p>
                ) : null}
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action!.run();
                      dismiss(toast.id);
                    }}
                    className="mt-2 text-xs font-medium text-accent underline underline-offset-4 hover:text-accent-bright"
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-1 text-muted transition hover:bg-white/5 hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
