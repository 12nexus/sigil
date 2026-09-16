"use client";

import { cloneElement, forwardRef, isValidElement, useId } from "react";
import { cn } from "@/utils/cn";

const BASE =
  "w-full bg-surface-2 border border-line rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder:text-faint " +
  "transition-colors duration-150 hover:border-line-strong focus:border-accent/60 focus:outline-none " +
  "focus:ring-2 focus:ring-accent/15 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(BASE, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(BASE, "leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(BASE, "cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink">
          {label}
          {required ? <span className="ml-1 text-accent">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
      </label>
      <div>
        {/* The generated id is forwarded to the control so the label binds. */}
        {isValidElement<{ id?: string }>(children)
          ? cloneElement(children, { id })
          : children}
      </div>
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#ddb876]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
