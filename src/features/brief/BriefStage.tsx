"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, RefreshCw, Sparkles } from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { Button } from "@/components/ui/Button";
import {
  ConfirmDialog,
  EmptyState,
  ErrorNotice,
  Panel,
} from "@/components/ui/Primitives";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { createBrandBrief } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { BrandBrief, GeminiErrorCode } from "@/types";
import { timelineEvent } from "@/workflows/projectFactory";
import { EditableList, EditableText } from "./EditableValue";

export function BriefStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings, keyConfigured } = useSettings();
  const { push } = useToast();

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const generationSettings = resolveGenerationSettings(settings, project);
  const brief = project.brief;
  const approved = Boolean(project.briefApprovedAt);

  const generate = async () => {
    if (!keyConfigured) {
      setError({ message: "No Gemini API key is configured.", code: "MISSING_KEY" });
      return;
    }
    setGenerating(true);
    setError(null);
    setConfirmRegenerate(false);
    try {
      const generated = await createBrandBrief(project, generationSettings);
      await update(
        (p) => ({
          ...p,
          brief: generated,
          briefEditedByUser: false,
          // Regenerating retracts approval — the approved document changed.
          briefApprovedAt: undefined,
        }),
        timelineEvent(
          "ai",
          brief ? "Brand brief regenerated" : "Brand brief generated",
          "Synthesised from the discovery interview.",
          "brief",
        ),
      );
      push({ tone: "success", title: "Brief ready for review" });
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setGenerating(false);
    }
  };

  const patch = (mutator: (brief: BrandBrief) => BrandBrief) =>
    update((p) => (p.brief ? { ...p, brief: mutator(p.brief), briefEditedByUser: true } : p));

  const approve = async () => {
    await update(
      (p) => ({ ...p, briefApprovedAt: new Date().toISOString(), stage: "directions" }),
      timelineEvent("decision", "Brand brief approved", undefined, "brief"),
    );
    push({ tone: "success", title: "Brief approved" });
    router.push(`/projects/${project.id}/directions`);
  };

  const retractApproval = async () => {
    await update(
      (p) => ({ ...p, briefApprovedAt: undefined }),
      timelineEvent("decision", "Brief approval withdrawn", "Reopened for editing.", "brief"),
    );
  };

  /* ------------------------------ empty ------------------------------ */

  if (!brief) {
    return (
      <>
        <StageHeader stage="brief" />
        {error ? (
          <ErrorNotice
            className="mb-6"
            title="Could not write the brief"
            message={error.message}
            code={error.code}
            onRetry={generate}
            onDismiss={() => setError(null)}
          />
        ) : null}
        <EmptyState
          icon={<FileText size={26} />}
          title="No brief yet"
          description="Gemini will synthesise the discovery interview into a structured brand brief. You can rewrite any part of it before approving — and nothing downstream runs until you do."
          action={
            <Button
              variant="accent"
              onClick={generate}
              loading={generating}
              icon={<Sparkles size={14} />}
            >
              {generating ? "Writing the brief" : "Write the brand brief"}
            </Button>
          }
        />
      </>
    );
  }

  /* ------------------------------ brief ------------------------------ */

  return (
    <>
      <StageHeader
        stage="brief"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={13} />}
              onClick={() => setConfirmRegenerate(true)}
              loading={generating}
            >
              Rewrite
            </Button>
            {approved ? (
              <Button variant="secondary" size="sm" onClick={retractApproval}>
                Reopen for editing
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                icon={<CheckCircle2 size={14} />}
                onClick={approve}
              >
                Approve brief
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-5">
        {error ? (
          <ErrorNotice
            title="Could not rewrite the brief"
            message={error.message}
            code={error.code}
            onRetry={generate}
            onDismiss={() => setError(null)}
          />
        ) : null}

        <AiNote
          did={
            approved
              ? "This brief is approved. Every creative direction, concept, and critique from here on is designed and judged against it."
              : "Gemini synthesised your discovery answers into a strategic brief. Click any field to rewrite it."
          }
          why={
            approved
              ? undefined
              : "The Avoid section matters most — it is what keeps generation out of the category's visual defaults."
          }
          next={
            approved
              ? "Move to creative directions."
              : "Edit anything that does not read true, then approve to unlock creative directions."
          }
          tone={approved ? "accent" : "violet"}
        />

        {approved ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-success/25 bg-success/8 px-4 py-2.5">
            <CheckCircle2 size={14} className="text-success" />
            <p className="text-[12px] text-muted">
              Approved {new Date(project.briefApprovedAt!).toLocaleString()}
              {project.briefEditedByUser ? " · edited by you before approval" : ""}
            </p>
          </div>
        ) : null}

        {/* --------------------------- Company --------------------------- */}
        <BriefSection title="Company">
          <FieldRow label="Name">
            <EditableText
              value={brief.company.name}
              onSave={(v) => patch((b) => ({ ...b, company: { ...b.company, name: v } }))}
            />
          </FieldRow>
          <FieldRow label="Industry">
            <EditableText
              value={brief.company.industry}
              onSave={(v) => patch((b) => ({ ...b, company: { ...b.company, industry: v } }))}
            />
          </FieldRow>
          <FieldRow label="Description">
            <EditableText
              multiline
              value={brief.company.description}
              onSave={(v) => patch((b) => ({ ...b, company: { ...b.company, description: v } }))}
            />
          </FieldRow>
          <FieldRow label="Tagline">
            <EditableText
              value={brief.company.tagline ?? ""}
              placeholder="No tagline"
              onSave={(v) => patch((b) => ({ ...b, company: { ...b.company, tagline: v } }))}
            />
          </FieldRow>
        </BriefSection>

        {/* --------------------------- Audience -------------------------- */}
        <BriefSection title="Audience">
          <FieldRow label="Primary">
            <EditableText
              multiline
              value={brief.audience.primary}
              onSave={(v) => patch((b) => ({ ...b, audience: { ...b.audience, primary: v } }))}
            />
          </FieldRow>
          <FieldRow label="Secondary">
            <EditableText
              multiline
              value={brief.audience.secondary}
              onSave={(v) => patch((b) => ({ ...b, audience: { ...b.audience, secondary: v } }))}
            />
          </FieldRow>
          <FieldRow label="Where they meet the brand">
            <EditableText
              multiline
              value={brief.audience.context}
              onSave={(v) => patch((b) => ({ ...b, audience: { ...b.audience, context: v } }))}
            />
          </FieldRow>
        </BriefSection>

        {/* -------------------------- Positioning ------------------------ */}
        <BriefSection title="Positioning">
          <FieldRow label="What it represents">
            <EditableText
              multiline
              value={brief.positioning.represents}
              onSave={(v) =>
                patch((b) => ({ ...b, positioning: { ...b.positioning, represents: v } }))
              }
            />
          </FieldRow>
          <FieldRow label="What differentiates it">
            <EditableText
              multiline
              value={brief.positioning.differentiates}
              onSave={(v) =>
                patch((b) => ({ ...b, positioning: { ...b.positioning, differentiates: v } }))
              }
            />
          </FieldRow>
          <FieldRow label="Competitors">
            <EditableList
              items={brief.positioning.competitors}
              onSave={(items) =>
                patch((b) => ({ ...b, positioning: { ...b.positioning, competitors: items } }))
              }
            />
          </FieldRow>
          <FieldRow label="Competitive visual landscape">
            <EditableText
              multiline
              value={brief.positioning.competitiveLandscape}
              onSave={(v) =>
                patch((b) => ({
                  ...b,
                  positioning: { ...b.positioning, competitiveLandscape: v },
                }))
              }
            />
          </FieldRow>
        </BriefSection>

        {/* -------------------------- Personality ------------------------ */}
        <BriefSection title="Brand personality">
          <EditableList
            tone="accent"
            items={brief.personality}
            onSave={(items) => patch((b) => ({ ...b, personality: items }))}
          />
        </BriefSection>

        {/* ------------------------ Desired perception ------------------- */}
        <BriefSection title="Desired perception">
          <FieldRow label="How it should feel">
            <EditableText
              multiline
              value={brief.desiredPerception.feel}
              onSave={(v) =>
                patch((b) => ({ ...b, desiredPerception: { ...b.desiredPerception, feel: v } }))
              }
            />
          </FieldRow>
          <FieldRow label="Attributes">
            <EditableList
              items={brief.desiredPerception.attributes}
              onSave={(items) =>
                patch((b) => ({
                  ...b,
                  desiredPerception: { ...b.desiredPerception, attributes: items },
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Must not feel">
            <EditableList
              tone="danger"
              items={brief.desiredPerception.avoidFeeling}
              onSave={(items) =>
                patch((b) => ({
                  ...b,
                  desiredPerception: { ...b.desiredPerception, avoidFeeling: items },
                }))
              }
            />
          </FieldRow>
        </BriefSection>

        {/* ------------------------ Visual language ---------------------- */}
        <BriefSection title="Visual language">
          <FieldRow label="Characteristics">
            <EditableList
              items={brief.visualLanguage.characteristics}
              onSave={(items) =>
                patch((b) => ({
                  ...b,
                  visualLanguage: { ...b.visualLanguage, characteristics: items },
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Form language">
            <EditableText
              multiline
              value={brief.visualLanguage.formLanguage}
              onSave={(v) =>
                patch((b) => ({ ...b, visualLanguage: { ...b.visualLanguage, formLanguage: v } }))
              }
            />
          </FieldRow>
          <FieldRow label="Colour direction">
            <EditableText
              multiline
              value={brief.visualLanguage.colorDirection}
              onSave={(v) =>
                patch((b) => ({
                  ...b,
                  visualLanguage: { ...b.visualLanguage, colorDirection: v },
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Typography direction">
            <EditableText
              multiline
              value={brief.visualLanguage.typographyDirection}
              onSave={(v) =>
                patch((b) => ({
                  ...b,
                  visualLanguage: { ...b.visualLanguage, typographyDirection: v },
                }))
              }
            />
          </FieldRow>
        </BriefSection>

        {/* ------------------------- Requirements ------------------------ */}
        <BriefSection title="Logo requirements">
          <FieldRow label="Practical">
            <EditableList
              items={brief.requirements.practical}
              onSave={(items) =>
                patch((b) => ({ ...b, requirements: { ...b.requirements, practical: items } }))
              }
            />
          </FieldRow>
          <FieldRow label="Must retain">
            <EditableList
              items={brief.requirements.mustRetain}
              onSave={(items) =>
                patch((b) => ({ ...b, requirements: { ...b.requirements, mustRetain: items } }))
              }
            />
          </FieldRow>
          <FieldRow label="Lockups needed">
            <EditableList
              items={brief.requirements.lockupNeeds}
              onSave={(items) =>
                patch((b) => ({ ...b, requirements: { ...b.requirements, lockupNeeds: items } }))
              }
            />
          </FieldRow>
        </BriefSection>

        {/* ---------------------------- Avoid ---------------------------- */}
        <BriefSection
          title="Avoid"
          description="Hard constraints. These are injected into every image prompt the studio generates."
        >
          <FieldRow label="Visual cliches">
            <EditableList
              tone="danger"
              items={brief.avoid.cliches}
              onSave={(items) => patch((b) => ({ ...b, avoid: { ...b.avoid, cliches: items } }))}
            />
          </FieldRow>
          <FieldRow label="Competitor similarity">
            <EditableList
              tone="danger"
              items={brief.avoid.competitorSimilarities}
              onSave={(items) =>
                patch((b) => ({
                  ...b,
                  avoid: { ...b.avoid, competitorSimilarities: items },
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Unwanted styles">
            <EditableList
              tone="danger"
              items={brief.avoid.styles}
              onSave={(items) => patch((b) => ({ ...b, avoid: { ...b.avoid, styles: items } }))}
            />
          </FieldRow>
        </BriefSection>

        {/* ---------------------------- Usage ---------------------------- */}
        <BriefSection title="Logo usage">
          <EditableList
            items={brief.usage}
            onSave={(items) => patch((b) => ({ ...b, usage: items }))}
          />
        </BriefSection>

        {/* ----------------------- Strategic summary --------------------- */}
        <BriefSection title="Strategic summary">
          <EditableText
            multiline
            rows={5}
            value={brief.strategicSummary}
            onSave={(v) => patch((b) => ({ ...b, strategicSummary: v }))}
          />
        </BriefSection>

        {/* ---------------------------- Approve -------------------------- */}
        <Panel className="flex flex-wrap items-center justify-between gap-4 border-accent/20">
          <div className="min-w-0">
            <h3 className="text-[14px] text-ink">
              {approved ? "Brief approved" : "Ready to approve?"}
            </h3>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
              {approved
                ? "Creative directions are unlocked. You can reopen and edit this brief at any time — nothing generated so far will be lost."
                : "Nothing downstream generates until you approve. Once approved, every direction and concept is designed against this document."}
            </p>
          </div>
          <div className="flex gap-2">
            {approved ? (
              <>
                <Button variant="secondary" size="sm" onClick={retractApproval}>
                  Reopen
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => router.push(`/projects/${project.id}/directions`)}
                >
                  Creative directions
                </Button>
              </>
            ) : (
              <Button variant="accent" icon={<CheckCircle2 size={14} />} onClick={approve}>
                Approve brief
              </Button>
            )}
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        onConfirm={generate}
        tone="primary"
        confirmLabel="Rewrite the brief"
        title="Rewrite this brief?"
        body="Gemini will write a fresh brief from the discovery interview, replacing your edits to this document. Concepts and directions already generated are not affected, and approval will be withdrawn so you can review the new version."
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function BriefSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="-mt-2 mb-4 text-[12px] leading-relaxed text-faint">{description}</p>
      ) : null}
      <div className="space-y-4">{children}</div>
    </Panel>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:gap-5">
      <p className="pt-1 text-[12px] text-muted">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
