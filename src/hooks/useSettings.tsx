"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_SETTINGS } from "@/services/gemini/config";
import { checkServerKey } from "@/services/gemini/client";
import { StorageError, api, json } from "@/services/db/api";
import type { AppSettings, GenerationSettings, Project } from "@/types";

/**
 * Settings are shared and live on the server, so every browser sees the same
 * models and defaults. The one exception is the optional personal API key (and
 * whether to use it): that is a credential, so it stays in this browser only.
 */
const LOCAL_KEY = "sigil.settings";

const DEFAULT_APP_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  apiKeyOverride: "",
  useServerKey: true,
  reduceMotion: false,
};

type LocalPart = Pick<AppSettings, "apiKeyOverride" | "useServerKey">;
type SharedPart = Omit<AppSettings, "apiKeyOverride" | "useServerKey">;

function split(settings: AppSettings): { local: LocalPart; shared: SharedPart } {
  const { apiKeyOverride, useServerKey, ...shared } = settings;
  return { local: { apiKeyOverride, useServerKey }, shared };
}

function readLocal(): Partial<AppSettings> {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(local: LocalPart): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  } catch {
    /* storage may be unavailable in private mode */
  }
}

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
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored = readLocal();
      const { local, shared: legacyShared } = split({ ...DEFAULT_APP_SETTINGS, ...stored });
      let shared: Partial<SharedPart> | null = null;
      // Client share links are public: no one is signed in, so there are no settings to load.
      if (!window.location.pathname.startsWith("/share/")) {
        try {
          ({ settings: shared } = await api<{ settings: Partial<SharedPart> | null }>("/api/settings"));
          // First run after the move to the server: carry this browser's settings over.
          if (!shared && Object.keys(stored).some((k) => k !== "apiKeyOverride" && k !== "useServerKey")) {
            shared = legacyShared;
            await api("/api/settings", { method: "PUT", body: json({ settings: shared }) });
          }
        } catch (err) {
          // The login page runs signed out, with the defaults.
          if (!(err instanceof StorageError && err.status === 401)) {
            console.error("[sigil] could not load settings", err);
          }
        }
      }
      if (!active) return;
      writeLocal(local);
      setSettings({ ...DEFAULT_APP_SETTINGS, ...(shared ?? {}), ...local });
      setLoaded(true);
      const present = await checkServerKey();
      if (active) setHasServerKey(present);
    })();

    return () => {
      active = false;
    };
  }, []);

  /** Shared settings are written shortly after the last change, not per keystroke. */
  const persist = useCallback((next: AppSettings) => {
    const { local, shared } = split(next);
    writeLocal(local);
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => {
      void api("/api/settings", { method: "PUT", body: json({ settings: shared }) }).catch((err) =>
        console.error("[sigil] could not save settings", err),
      );
    }, 400);
  }, []);

  const update = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
    persist(DEFAULT_APP_SETTINGS);
  }, [persist]);

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
