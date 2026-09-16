"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { SigilLockup } from "@/components/brand/SigilLogo";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ErrorNotice, Panel } from "@/components/ui/Primitives";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { validateKey } from "@/services/gemini/client";
import { GeminiError } from "@/services/gemini/errors";
import {
  KNOWN_IMAGE_MODELS,
  KNOWN_TEXT_MODELS,
  MODEL_NOTES,
} from "@/services/gemini/config";
import { estimateStorage } from "@/services/db/database";
import type { GeminiErrorCode } from "@/types";
import { formatBytes } from "@/utils/format";

export default function SettingsPage() {
  const { settings, update, reset, hasServerKey } = useSettings();
  const { push } = useToast();

  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    textModels: string[];
    imageModels: string[];
  } | null>(null);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void estimateStorage().then(setStorage);
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    setCheckResult(null);
    try {
      const result = await validateKey();
      setCheckResult(result);
      push({
        tone: "success",
        title: "Key is working",
        body: `${result.textModels.length} text models and ${result.imageModels.length} image models available.`,
      });
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-3">
            <ArrowLeft size={15} className="text-faint" />
            <SigilLockup size="sm" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-[30px] leading-tight text-ink">Settings</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Models, generation defaults, and where your data lives.
        </p>

        <div className="mt-8 space-y-6">
          {/* ------------------------- API key ------------------------- */}
          <Panel>
            <div className="mb-4 flex items-start gap-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <h2 className="text-[14px] text-ink">Gemini API key</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  SIGIL never calls Google from the browser. Requests go to this
                  application&apos;s own server routes, which hold the key.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className={
                  hasServerKey
                    ? "flex items-center gap-2.5 rounded-lg border border-success/25 bg-success/8 px-4 py-3"
                    : "flex items-center gap-2.5 rounded-lg border border-caution/25 bg-caution/8 px-4 py-3"
                }
              >
                {hasServerKey ? (
                  <Check size={14} className="text-success" />
                ) : (
                  <AlertTriangle size={14} className="text-caution" />
                )}
                <p className="text-[12px] text-muted">
                  {hasServerKey === null
                    ? "Checking for a server-side key…"
                    : hasServerKey
                      ? "A server-side key is configured in the environment. This is the recommended setup."
                      : "No server-side key found. Add GEMINI_API_KEY to .env.local and restart, or use a browser key below."}
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 p-3">
                <input
                  type="checkbox"
                  checked={!settings.useServerKey}
                  onChange={(e) => update({ useServerKey: !e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#ddb876]"
                />
                <span>
                  <span className="block text-[13px] text-ink">Use my own key instead</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                    Stored in this browser&apos;s local storage and sent to SIGIL&apos;s own
                    server on each request. Convenient for trying the app; a server-side
                    environment key is safer.
                  </span>
                </span>
              </label>

              {!settings.useServerKey ? (
                <Field label="Your Gemini API key" hint="Never logged, never put in a URL">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={settings.apiKeyOverride}
                        onChange={(e) => update({ apiKeyOverride: e.target.value })}
                        placeholder="AIza…"
                        autoComplete="off"
                        spellCheck={false}
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        aria-label={showKey ? "Hide key" : "Show key"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </Field>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" loading={checking} onClick={runCheck}>
                  Test connection
                </Button>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-[12px] text-faint underline underline-offset-4 hover:text-accent"
                >
                  Get a key from Google AI Studio
                </a>
              </div>

              {error ? (
                <ErrorNotice
                  message={error.message}
                  code={error.code}
                  onDismiss={() => setError(null)}
                />
              ) : null}

              {checkResult ? (
                <div className="rounded-lg border border-success/25 bg-success/8 p-3">
                  <p className="text-[12px] text-ink">Connection verified</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {checkResult.imageModels.length} image models reachable, including{" "}
                    {checkResult.imageModels.slice(0, 3).join(", ")}.
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          {/* -------------------------- Models -------------------------- */}
          <Panel>
            <div className="mb-4 flex items-start gap-3">
              <Zap size={16} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <h2 className="text-[14px] text-ink">Models</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Defaults come from environment variables. Anything set here overrides them
                  for this browser.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <ModelField
                label="Text model"
                hint="Interview and quick structured work"
                value={settings.textModel}
                options={KNOWN_TEXT_MODELS}
                onChange={(textModel) => update({ textModel })}
              />
              <ModelField
                label="Reasoning model"
                hint="Brief, directions, critique, iteration"
                value={settings.reasoningModel}
                options={KNOWN_TEXT_MODELS}
                onChange={(reasoningModel) => update({ reasoningModel })}
              />
              <ModelField
                label="Image model"
                hint="Exploration batches — speed matters here"
                value={settings.imageModel}
                options={KNOWN_IMAGE_MODELS}
                onChange={(imageModel) => update({ imageModel })}
              />
              <ModelField
                label="Finalist image model"
                hint="Lockups and delivery assets — fidelity matters here"
                value={settings.finalistImageModel}
                options={KNOWN_IMAGE_MODELS}
                onChange={(finalistImageModel) => update({ finalistImageModel })}
              />
            </div>
          </Panel>

          {/* ------------------------ Generation ------------------------ */}
          <Panel>
            <h2 className="text-[14px] text-ink">Generation defaults</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Starting values for new runs. Every stage lets you change them before generating.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Batch concurrency" hint="1–8 · lower this if rate limited">
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={settings.batchConcurrency}
                  onChange={(e) =>
                    update({
                      batchConcurrency: Math.max(1, Math.min(8, Number(e.target.value) || 3)),
                    })
                  }
                />
              </Field>
              <Field label="Automatic retries" hint="Per failed image, 0–5">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={settings.maxRetries}
                  onChange={(e) =>
                    update({ maxRetries: Math.max(0, Math.min(5, Number(e.target.value) || 2)) })
                  }
                />
              </Field>
              <Field label="Creative directions" hint="Default count">
                <Input
                  type="number"
                  min={2}
                  max={14}
                  value={settings.defaultDirectionCount}
                  onChange={(e) =>
                    update({
                      defaultDirectionCount: Math.max(
                        2,
                        Math.min(14, Number(e.target.value) || 8),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Concepts per direction" hint="Default count">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={settings.defaultConceptsPerDirection}
                  onChange={(e) =>
                    update({
                      defaultConceptsPerDirection: Math.max(
                        1,
                        Math.min(12, Number(e.target.value) || 6),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Variations per refinement" hint="Default count">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.defaultIterationCount}
                  onChange={(e) =>
                    update({
                      defaultIterationCount: Math.max(
                        1,
                        Math.min(10, Number(e.target.value) || 4),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Image aspect ratio">
                <Select
                  value={settings.aspectRatio}
                  onChange={(e) => update({ aspectRatio: e.target.value })}
                >
                  <option value="1:1">Square (1:1)</option>
                  <option value="4:3">Landscape (4:3)</option>
                  <option value="16:9">Wide (16:9)</option>
                </Select>
              </Field>
            </div>
          </Panel>

          {/* -------------------------- Storage ------------------------- */}
          <Panel>
            <div className="flex items-start gap-3">
              <Database size={16} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] text-ink">Local storage</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Projects and generated artwork live in this browser&apos;s IndexedDB. They
                  survive refreshes and restarts, and never leave your machine except as the
                  prompts sent to Gemini.
                </p>
                {storage ? (
                  <p className="mt-3 text-[12px] text-faint">
                    Using {formatBytes(storage.usage)}
                    {storage.quota ? ` of roughly ${formatBytes(storage.quota)} available` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* ------------------------- Security ------------------------- */}
          <Panel>
            <div className="flex items-start gap-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <h2 className="text-[14px] text-ink">Security model</h2>
                <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted">
                  <li>
                    · The API key is read server-side and travels to Google in a request
                    header — never in a URL, never in the client bundle.
                  </li>
                  <li>
                    · Error messages are scrubbed for key-shaped strings before they reach
                    logs or the browser.
                  </li>
                  <li>
                    · Client information is sent to Gemini only as part of the prompts needed
                    to do the design work.
                  </li>
                  <li>
                    · A browser-stored key, if you choose one, is held in local storage and is
                    readable by anything running on this origin. Prefer the environment key.
                  </li>
                </ul>
              </div>
            </div>
          </Panel>

          <div className="flex justify-between gap-3 pb-10">
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw size={13} />}
              onClick={() => {
                reset();
                push({ tone: "info", title: "Settings reset to defaults" });
              }}
            >
              Reset to defaults
            </Button>
            <Link href="/">
              <Button variant="secondary" size="sm">
                Done
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ModelField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const known = options.includes(value);

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        <Select value={known ? value : "__custom"} onChange={(e) => onChange(e.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </Select>
        {!known ? (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="model-name"
            className="font-mono"
          />
        ) : MODEL_NOTES[value] ? (
          <p className="text-[11px] text-faint">{MODEL_NOTES[value]}</p>
        ) : null}
      </div>
    </Field>
  );
}
