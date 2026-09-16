import { GeminiError } from "@/services/gemini/errors";
import type { GenerationJob, JobItem, JobStatus } from "@/types";

/**
 * Autonomous batch generation.
 *
 * One click generates the whole batch. The runner enforces a concurrency limit,
 * retries transient failures with exponential backoff, honours the retry delay
 * Gemini sends back on a 429, and — critically — never discards a completed
 * item because a sibling failed. A job that ends with failures finishes as
 * `completed_with_errors` with the successful work intact and the failed items
 * individually retryable.
 */

export interface RunnerCallbacks {
  /** Called whenever any item changes state, with a fresh job snapshot. */
  onProgress: (job: GenerationJob) => void;
  /** Persist the job so a refresh can resume it. */
  onPersist?: (job: GenerationJob) => void | Promise<void>;
}

export type ItemExecutor = (
  item: JobItem,
  signal: AbortSignal,
) => Promise<{ conceptId?: string }>;

export class BatchRunner {
  private job: GenerationJob;
  private readonly executor: ItemExecutor;
  private readonly callbacks: RunnerCallbacks;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private controller = new AbortController();
  private paused = false;
  private running = false;

  constructor(
    job: GenerationJob,
    executor: ItemExecutor,
    callbacks: RunnerCallbacks,
    options: { concurrency: number; maxRetries: number },
  ) {
    this.job = job;
    this.executor = executor;
    this.callbacks = callbacks;
    this.concurrency = Math.max(1, Math.min(8, options.concurrency));
    this.maxRetries = Math.max(0, options.maxRetries);
  }

  get snapshot(): GenerationJob {
    return this.job;
  }

  get isRunning(): boolean {
    return this.running;
  }

  cancel(): void {
    this.paused = true;
    this.controller.abort();
    this.patch((job) => ({
      ...job,
      status: "cancelled",
      items: job.items.map((i) =>
        i.status === "pending" || i.status === "running"
          ? { ...i, status: "cancelled" as const }
          : i,
      ),
      finishedAt: new Date().toISOString(),
    }));
  }

  pause(): void {
    this.paused = true;
    this.controller.abort();
    this.patch((job) => ({
      ...job,
      status: "paused",
      items: job.items.map((i) =>
        i.status === "running" ? { ...i, status: "pending" as const } : i,
      ),
    }));
  }

  /** Run every pending item. Safe to call again to resume a paused job. */
  async run(): Promise<GenerationJob> {
    if (this.running) return this.job;
    this.running = true;
    this.paused = false;
    this.controller = new AbortController();

    this.patch((job) => ({ ...job, status: "running" as JobStatus }));

    const queue = this.job.items
      .filter((i) => i.status === "pending" || i.status === "failed")
      .map((i) => i.id);

    // Reset previously-failed items so a resume genuinely retries them.
    this.patch((job) => ({
      ...job,
      items: job.items.map((i) =>
        queue.includes(i.id) ? { ...i, status: "pending" as const, error: undefined } : i,
      ),
    }));

    let cursor = 0;
    const takeNext = (): string | undefined =>
      cursor < queue.length ? queue[cursor++] : undefined;

    const workers = Array.from({ length: Math.min(this.concurrency, queue.length) }, () =>
      this.worker(takeNext),
    );

    await Promise.all(workers);

    this.running = false;

    if (this.paused) {
      await this.persist();
      return this.job;
    }

    const failed = this.job.items.filter((i) => i.status === "failed").length;
    this.patch((job) => ({
      ...job,
      status: failed > 0 ? "completed_with_errors" : "completed",
      finishedAt: new Date().toISOString(),
    }));
    await this.persist();
    return this.job;
  }

  /** Retry a single failed item without re-running the whole batch. */
  async retryItem(itemId: string): Promise<GenerationJob> {
    const item = this.job.items.find((i) => i.id === itemId);
    if (!item) return this.job;

    this.controller = new AbortController();
    this.paused = false;
    this.setItem(itemId, { status: "pending", error: undefined, attempts: 0 });
    this.patch((job) => ({ ...job, status: "running" }));

    await this.executeItem(itemId);

    const stillFailing = this.job.items.some((i) => i.status === "failed");
    const anyPending = this.job.items.some(
      (i) => i.status === "pending" || i.status === "running",
    );
    this.patch((job) => ({
      ...job,
      status: anyPending
        ? "paused"
        : stillFailing
          ? "completed_with_errors"
          : "completed",
    }));
    await this.persist();
    return this.job;
  }

  /* ---------------------------------------------------------------- */

  private async worker(takeNext: () => string | undefined): Promise<void> {
    for (;;) {
      if (this.paused) return;
      const id = takeNext();
      if (!id) return;
      await this.executeItem(id);
    }
  }

  private async executeItem(itemId: string): Promise<void> {
    const current = () => this.job.items.find((i) => i.id === itemId)!;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (this.paused) {
        this.setItem(itemId, { status: "pending" });
        return;
      }

      this.setItem(itemId, { status: "running", attempts: attempt + 1 });

      try {
        const result = await this.executor(current(), this.controller.signal);
        this.setItem(itemId, {
          status: "done",
          conceptId: result.conceptId,
          error: undefined,
        });
        await this.persist();
        return;
      } catch (rawError) {
        const error = GeminiError.from(rawError);

        if (error.code === "CANCELLED" || this.paused) {
          this.setItem(itemId, { status: this.paused ? "pending" : "cancelled" });
          return;
        }

        const isLastAttempt = attempt >= this.maxRetries;
        if (!error.retryable || isLastAttempt) {
          this.setItem(itemId, { status: "failed", error: error.message });
          await this.persist();
          return;
        }

        // Back off: honour the server's retry hint when it gives one.
        const base = error.retryAfterMs ?? 1200 * Math.pow(2, attempt);
        const jitter = Math.random() * 400;
        await this.sleep(Math.min(base + jitter, 30_000));
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }

  private setItem(itemId: string, patch: Partial<JobItem>): void {
    this.patch((job) => ({
      ...job,
      items: job.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    }));
  }

  private patch(fn: (job: GenerationJob) => GenerationJob): void {
    this.job = { ...fn(this.job), updatedAt: new Date().toISOString() };
    this.callbacks.onProgress(this.job);
  }

  private async persist(): Promise<void> {
    await this.callbacks.onPersist?.(this.job);
  }
}

/* ------------------------------------------------------------------ */
/* Progress helpers                                                    */
/* ------------------------------------------------------------------ */

export interface JobProgress {
  total: number;
  done: number;
  failed: number;
  running: number;
  pending: number;
  cancelled: number;
  /** 0..1 over items that reached a terminal state. */
  ratio: number;
  label: string;
}

export function jobProgress(job: GenerationJob): JobProgress {
  const count = (status: JobItem["status"]) =>
    job.items.filter((i) => i.status === status).length;

  const total = job.items.length;
  const done = count("done");
  const failed = count("failed");
  const running = count("running");
  const pending = count("pending");
  const cancelled = count("cancelled");
  const settled = done + failed + cancelled;

  return {
    total,
    done,
    failed,
    running,
    pending,
    cancelled,
    ratio: total === 0 ? 0 : settled / total,
    label:
      job.status === "running"
        ? `Generating ${Math.min(done + running + 1, total)}/${total}`
        : job.status === "completed"
          ? `${done} of ${total} generated`
          : job.status === "completed_with_errors"
            ? `${done} of ${total} generated · ${failed} failed`
            : job.status === "paused"
              ? `Paused · ${done}/${total} done`
              : job.status === "cancelled"
                ? `Cancelled · ${done}/${total} kept`
                : `${total} queued`,
  };
}
