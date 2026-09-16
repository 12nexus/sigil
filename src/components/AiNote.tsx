"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * The "what the AI did / why / what you can do next" panel (spec §27).
 *
 * Every AI-produced stage opens with one of these. It explains the work in
 * plain language and hands the decision straight back to the designer — no
 * model names, no token counts, no prompt text.
 */
export function AiNote({
  did,
  why,
  next,
  action,
  tone = "violet",
  className,
}: {
  did: string;
  why?: string;
  next?: string;
  action?: React.ReactNode;
  tone?: "violet" | "accent";
  className?: string;
}) {
  const accentClass = tone === "accent" ? "text-accent" : "text-violet";
  const ringClass =
    tone === "accent"
      ? "border-accent/25 bg-accent/[0.04]"
      : "border-violet/25 bg-violet/[0.04]";

  return (
    <div className={cn("rounded-xl border px-5 py-4", ringClass, className)}>
      <div className="flex items-start gap-3.5">
        <Sparkles size={15} className={cn("mt-0.5 shrink-0", accentClass)} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[13px] leading-relaxed text-ink">{did}</p>
          {why ? <p className="text-[12px] leading-relaxed text-muted">{why}</p> : null}
          {next ? (
            <p className="pt-0.5 text-[12px] leading-relaxed text-faint">
              <span className="font-medium text-muted">Next:</span> {next}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 self-center">{action}</div> : null}
      </div>
    </div>
  );
}

/** A quieter inline variant used inside cards. */
export function AiHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-[11px] leading-relaxed text-faint", className)}>
      <Sparkles size={11} className="mt-0.5 shrink-0 text-violet/70" />
      <span>{children}</span>
    </p>
  );
}
