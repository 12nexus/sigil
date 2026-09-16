"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_SETTINGS } from "@/services/gemini/config";
import { checkServerKey } from "@/services/gemini/client";
import type { AppSettings, GenerationSettings, Project } from "@/types";

const STORAGE_KEY = "sigil.settings";

const DEFAULT_APP_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  apiKeyOverride: "",
  useServerKey: true,
  reduceMotion: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  hasServerKey: boolean | null;
  keyConfigured: boolean;
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    /* Deferred to a microtask so the stored settings and the server-key probe
       land together, in one render, rather than synchronously during mount. */
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) setSettings({ ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) });
        } catch {
          /* corrupt settings fall back to defaults */
        }
        setLoaded(true);
      })
      .then(() => checkServerKey())
      .then((present) => {
        if (active) setHasServerKey(present);
      });

    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable in private mode */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
    } catch {
      /* ignore */
    }
  }, []);

  const keyConfigured =
    settings.useServerKey ? hasServerKey !== false : settings.apiKeyOverride.trim().length > 0;

  const value = useMemo(
    () => ({ settings, update, reset, hasServerKey, keyConfigured, loaded }),
    [settings, update, reset, hasServerKey, keyConfigured, loaded],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

/** Global settings with any per-project overrides applied. */
export function resolveGenerationSettings(
  settings: AppSettings,
  project?: Project | null,
): GenerationSettings {
  const base: GenerationSettings = {
    textModel: settings.textModel,
    reasoningModel: settings.reasoningModel,
    imageModel: settings.imageModel,
    finalistImageModel: settings.finalistImageModel,
    batchConcurrency: settings.batchConcurrency,
    maxRetries: settings.maxRetries,
    defaultDirectionCount: settings.defaultDirectionCount,
    defaultConceptsPerDirection: settings.defaultConceptsPerDirection,
    defaultIterationCount: settings.defaultIterationCount,
    aspectRatio: settings.aspectRatio,
  };
  return { ...base, ...(project?.generationSettings ?? {}) };
}
