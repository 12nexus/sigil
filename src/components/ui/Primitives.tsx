"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { ERROR_GUIDANCE } from "@/services/gemini/errors";
import type { GeminiErrorCode } from "@/types";
import { Button } from "./Button";

/* ------------------------------- Badge ----------------------------- */

type BadgeTone = "neutral" | "accent" | "violet" | "success" | "danger" | "caution";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-white/6 text-muted border-line",
  accent: "bg-accent/12 text-accent border-accent/25",
  violet: "bg-violet/12 text-violet border-violet/25",
  success: "bg-success/12 text-success border-success/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  caution: "bg-caution/12 text-caution border-caution/25",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------ Panel ------------------------------ */

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("panel", padded && "p-5", className)}>{children}</section>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------------------------- Progress ----------------------------- */

export function ProgressBar({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "violet" | "success";
  className?: string;
}) {
  const tones = { accent: "bg-accent", violet: "bg-violet", success: "bg-success" };
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tones[tone])}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

/* ---------------------------- Spinner ------------------------------ */

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-muted", className)} />;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}

/* --------------------------- Empty state --------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-faint">{icon}</div> : null}
      <h3 className="text-base text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* --------------------------- Error notice -------------------------- */

export function ErrorNotice({
  title,
  message,
  code,
  onRetry,
  onDismiss,
  className,
}: {
  title?: string;
  message: string;
  code?: GeminiErrorCode;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-danger/30 bg-danger/8 p-4", className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">{title ?? "Something went wrong"}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{message}</p>
          {code ? (
            <p className="mt-2 text-[12px] leading-relaxed text-faint">{ERROR_GUIDANCE[code]}</p>
          ) : null}
          {onRetry || onDismiss ? (
            <div className="mt-3 flex gap-2">
              {onRetry ? (
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
              {onDismiss ? (
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  Dismiss
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    full: "max-w-[min(1400px,95vw)]",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/80 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cn(
          "my-auto w-full animate-rise rounded-2xl border border-line-strong bg-surface shadow-panel",
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-white/6 hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------- Confirm ----------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "danger",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">{body}</p>
    </Modal>
  );
}

/* ------------------------------ Tabs ------------------------------- */

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-surface-4 text-ink"
              : "text-muted hover:text-ink",
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="ml-1.5 text-faint">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
