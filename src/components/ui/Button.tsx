"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-void hover:bg-white disabled:hover:bg-ink font-medium",
  accent:
    "bg-accent text-void hover:bg-accent-bright disabled:hover:bg-accent font-medium",
  secondary:
    "bg-surface-3 text-ink border border-line-strong hover:bg-surface-4 hover:border-white/20",
  ghost:
    "text-muted hover:text-ink hover:bg-white/5 border border-transparent",
  danger:
    "bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9.5 px-4 text-[13px] rounded-lg gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    active?: boolean;
    tone?: "default" | "accent" | "danger" | "success";
  }
>(function IconButton({ label, active, tone = "default", className, children, ...props }, ref) {
  const tones = {
    default: active ? "bg-white/10 text-ink" : "text-muted hover:text-ink hover:bg-white/8",
    accent: active
      ? "bg-accent/18 text-accent-bright"
      : "text-muted hover:text-accent hover:bg-accent/10",
    danger: active
      ? "bg-danger/18 text-danger"
      : "text-muted hover:text-danger hover:bg-danger/10",
    success: active
      ? "bg-success/18 text-success"
      : "text-muted hover:text-success hover:bg-success/10",
  };
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 active:scale-95",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
