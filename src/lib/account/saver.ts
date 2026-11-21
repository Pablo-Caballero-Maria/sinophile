/**
 * Batches local changes and uploads them in the background.
 *
 * - `push()` queues a change; changes are combined and sent at most every
 *   `delayMs` (so a burst of answers becomes one request).
 * - A failed upload is put back in the queue and retried after `retryMs`
 *   when `shouldRetry` allows it.
 * - `flushOnExit()` sends everything with `keepalive` when the page is hidden.
 *
 * The server merges what it receives (max / last-writer-wins), so sending the
 * same change twice or two requests at once is harmless.
 */
export type SaveStatus = "idle" | "pending" | "saving" | "error";

export interface SaverOptions<T> {
  send(value: T, keepalive: boolean): Promise<unknown>;
  /** Combines two queued values (older first). */
  combine(older: T, newer: T): T;
  delayMs?: number;
  retryMs?: number;
  shouldRetry?(error: unknown): boolean;
  onStatus?(status: SaveStatus, error?: unknown): void;
}

export class Saver<T> {
  private pending: T | null = null;
  private readonly inFlight = new Set<T>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failed = false;
  private readonly options: Required<Omit<SaverOptions<T>, "onStatus">> & Pick<SaverOptions<T>, "onStatus">;

  constructor(options: SaverOptions<T>) {
    this.options = { delayMs: 2000, retryMs: 20_000, shouldRetry: () => true, ...options };
  }

  get status(): SaveStatus {
    if (this.inFlight.size) return "saving";
    if (this.failed) return "error";
    return this.pending === null ? "idle" : "pending";
  }

  /** True while something is queued or uploading. */
  get busy(): boolean {
    return this.pending !== null || this.inFlight.size > 0;
  }

  push(value: T): void {
    this.enqueue(value);
    this.schedule(this.options.delayMs);
    this.report();
  }

  /** Uploads the queue now. Resolves when that upload finished (successfully or not). */
  async flush(keepalive = false): Promise<void> {
    this.cancelTimer();
    const value = this.pending;
    if (value === null) return;
    this.pending = null;
    this.inFlight.add(value);
    this.report();
    try {
      await this.options.send(value, keepalive);
      this.failed = false;
    } catch (error) {
      this.failed = true;
      if (this.options.shouldRetry(error)) {
        this.enqueue(value, true);
        this.schedule(this.options.retryMs);
      }
      this.inFlight.delete(value);
      this.report(error);
      return;
    }
    this.inFlight.delete(value);
    this.report();
  }

  /** The page is being hidden/closed: send the queue and re-send running uploads, which the browser may cancel. */
  flushOnExit(): void {
    for (const value of this.inFlight) void this.options.send(value, true).catch(() => {});
    void this.flush(true);
  }

  /** Drops everything queued (sign-out, reset). Running uploads still finish. */
  clear(): void {
    this.cancelTimer();
    this.pending = null;
    this.failed = false;
    this.report();
  }

  private enqueue(value: T, older = false): void {
    if (this.pending === null) this.pending = value;
    else
      this.pending = older
        ? this.options.combine(value, this.pending)
        : this.options.combine(this.pending, value);
  }

  private schedule(ms: number): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private report(error?: unknown): void {
    this.options.onStatus?.(this.status, error);
  }
}
