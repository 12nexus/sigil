import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Vector tracing with VectorCraft's command-line tool (github.com/storytold/vectorcraft).
 *
 * The approved logo, as a transparent PNG, is traced in Flat Logo mode: flat colours found
 * automatically, edges placed to a fraction of a pixel, corners restored, lines and circles
 * snapped. With Ignore White, white areas inside the mark become holes, so the result sits on any
 * background. The trace is exported as SVG, PDF and EPS, then recoloured to one-colour white and
 * black versions and converted again. Each run is a short-lived process in its own temporary
 * folder; only PNG bytes go in, never a file the caller names.
 *
 * Runs on the CPU (about a second per logo, under 200 MB). At most two run at once so a large
 * package cannot starve the other apps on the host.
 */

const CLI = process.env.VECTORCRAFT_CLI || "vectorcraft-cli";
const TIMEOUT_MS = 60_000;
const MAX_RUNNING = 2;

export type VectorVariant = "colour" | "white" | "black";

export interface VectorFiles {
  svg: string;
  pdf: Buffer;
  eps: Buffer;
}

export interface TraceOutcome {
  variants: Partial<Record<VectorVariant, VectorFiles>>;
  paths: number;
  anchors: number;
  colors: number;
}

export class VectorUnavailableError extends Error {
  constructor() {
    super("Vector tracing is not installed on this server.");
    this.name = "VectorUnavailableError";
  }
}

export class TraceFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceFailedError";
  }
}

/* ------------------------------------------------------------------ */
/* Process plumbing                                                    */
/* ------------------------------------------------------------------ */

let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await work();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function cli(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      CLI,
      args,
      {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: 8 << 20,
        // A bare environment: the API key and database URL stay out of the child process.
        env: { PATH: process.env.PATH ?? "", HOME: cwd, NODE_ENV: process.env.NODE_ENV },
      },
      (err, stdout, stderr) => {
        if (err && (err as NodeJS.ErrnoException).code === "ENOENT") return reject(new VectorUnavailableError());
        if (err) return reject(new TraceFailedError(lastError(stdout, stderr) ?? err.message));
        resolve(stdout);
      },
    );
  });
}

/** The CLI prints one JSON object per step; a failing step carries an error message. */
function lastError(stdout: string, stderr: string): string | null {
  for (const line of `${stdout}\n${stderr}`.split("\n").reverse()) {
    const text = line.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as { error?: string | { message?: string } };
      if (parsed.error) return typeof parsed.error === "string" ? parsed.error : (parsed.error.message ?? null);
    } catch {
      return text.slice(0, 500);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Trace                                                               */
/* ------------------------------------------------------------------ */

/** Every fill and stroke colour in the traced SVG set to one colour. */
export function recolourSvg(svg: string, hex: string): string {
  return svg.replace(/\b(fill|stroke)="#[0-9a-fA-F]{3,8}"/g, `$1="${hex}"`);
}

export async function traceLogo(
  png: Buffer,
  options: { ignoreWhite: boolean; variants: VectorVariant[] },
): Promise<TraceOutcome> {
  return withSlot(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sigil-trace-"));
    try {
      const input = path.join(dir, "logo.png");
      await writeFile(input, png);

      const params = JSON.stringify({ preset: "Flat Logo", params: { ignoreWhite: options.ignoreWhite } });
      const stdout = await cli(
        [
          "run",
          "--in", input,
          "--cmd", "select.all",
          "--cmd", "imageTrace.makeAndExpand",
          "--params", params,
          "--export", path.join(dir, "colour.svg"),
          "--export", path.join(dir, "colour.pdf"),
          "--export", path.join(dir, "colour.eps"),
        ],
        dir,
      );
      const stats = parseTraceStats(stdout);
      if (!stats || stats.paths === 0) throw new TraceFailedError("The trace found no shapes in this image.");

      const colourSvg = await readFile(path.join(dir, "colour.svg"), "utf8");
      const variants: TraceOutcome["variants"] = {};
      if (options.variants.includes("colour")) {
        variants.colour = {
          svg: colourSvg,
          pdf: await readFile(path.join(dir, "colour.pdf")),
          eps: await readFile(path.join(dir, "colour.eps")),
        };
      }
      for (const [variant, hex] of [
        ["white", "#ffffff"],
        ["black", "#000000"],
      ] as const) {
        if (!options.variants.includes(variant)) continue;
        const svg = recolourSvg(colourSvg, hex);
        const file = path.join(dir, `${variant}.svg`);
        await writeFile(file, svg);
        await cli(["convert", file, path.join(dir, `${variant}.pdf`)], dir);
        await cli(["convert", file, path.join(dir, `${variant}.eps`)], dir);
        variants[variant] = {
          svg,
          pdf: await readFile(path.join(dir, `${variant}.pdf`)),
          eps: await readFile(path.join(dir, `${variant}.eps`)),
        };
      }
      return { variants, ...stats };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

function parseTraceStats(stdout: string): { paths: number; anchors: number; colors: number } | null {
  for (const line of stdout.split("\n")) {
    try {
      const step = JSON.parse(line) as { command?: string; result?: { paths?: number; anchors?: number; colors?: number } };
      if (step.command === "imageTrace.makeAndExpand" && step.result) {
        return {
          paths: step.result.paths ?? 0,
          anchors: step.result.anchors ?? 0,
          colors: step.result.colors ?? 0,
        };
      }
    } catch {
      // Not a JSON line.
    }
  }
  return null;
}
