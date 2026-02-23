/**
 * A small worker pool: N workers take jobs from a shared queue, run them,
 * wait a configurable delay, then take the next job. No job runs until the delay
 * after the previous one (per worker).
 *
 * Jobs that reject are counted as failures. After maxConsecutiveFailures or
 * maxFailures, the pool closes so workers drain and run() resolves.
 *
 * Use when you have async work that can be parallelised and you want to limit
 * concurrency, rate, and stop after repeated failures (e.g. rate limiting).
 */

export type Job = () => Promise<void>;

export interface WorkerPoolOptions {
  /** Number of workers. */
  workers: number;
  /** Delay in ms after each job completes, before the worker takes the next. */
  delayMs: number;
  /** Stop after this many consecutive job failures (rejections). Omit = no limit. */
  maxConsecutiveFailures?: number;
  /** Stop after this many total job failures. Omit = no limit. */
  maxFailures?: number;
}

/**
 * Worker pool. Push jobs with push(); use pushDelayed() to queue a job after a delay.
 * Call close() when no more jobs will be added so workers can exit.
 * run() returns a Promise that resolves when all workers have finished
 * (after close and queue is drained, or after failure limits are hit).
 */
export class WorkerPool {
  private queue: Job[] = [];
  private waiters: Array<(job: Job | null) => void> = [];
  private closed = false;
  private activeCount = 0;
  private workerCount = 0;
  private failureCount = 0;
  private consecutiveFailures = 0;
  private doneResolve: (() => void) | null = null;
  private readonly donePromise: Promise<void>;

  constructor(private readonly options: WorkerPoolOptions) {
    const { workers } = options;
    if (workers < 1) throw new Error("workers must be >= 1");
    this.donePromise = new Promise((resolve) => {
      this.doneResolve = resolve;
    });
  }

  on(event: "finished", callback: () => void): void {
    this.donePromise.then(callback);
  }

  push(job: Job): void {
    if (this.closed) return;
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve(job);
    } else {
      this.queue.push(job);
    }
  }

  /** Queue a job to run after `ms` milliseconds. No-op if pool already closed. */
  pushDelayed(job: Job, ms: number): void {
    if (this.closed) return;
    setTimeout(() => this.push(job), ms);
  }

  close(): void {
    this.closed = true;
    this.maybeWakeWaiters();
  }

  private maybeWakeWaiters(): void {
    if (!this.closed) return;
    if (this.queue.length > 0) return;
    while (this.waiters.length > 0) {
      this.waiters.shift()!(null);
    }
  }

  private shouldStop(): boolean {
    const { maxConsecutiveFailures, maxFailures } = this.options;
    if (maxConsecutiveFailures !== undefined && this.consecutiveFailures >= maxConsecutiveFailures) return true;
    if (maxFailures !== undefined && this.failureCount >= maxFailures) return true;
    return false;
  }

  private getNext(): Promise<Job | null> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    if (this.closed) return Promise.resolve(null);
    return new Promise<Job | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private runWorker(): void {
    const { delayMs } = this.options;
    this.workerCount++;

    const next = (): void => {
      this.getNext().then((job) => {
        if (job === null) {
          this.workerCount--;
          if (this.workerCount === 0) this.doneResolve?.();
          return;
        }
        this.activeCount++;
        job()
          .then(() => {
            this.consecutiveFailures = 0;
            this.activeCount--;
            if (this.queue.length === 0 && this.activeCount === 0) {
              this.closed = true;
              this.maybeWakeWaiters();
            }
          })
          .catch(() => {
            this.failureCount++;
            this.consecutiveFailures++;
            if (this.shouldStop()) this.close();
            this.activeCount--;
            if (this.queue.length === 0 && this.activeCount === 0) {
              this.closed = true;
              this.maybeWakeWaiters();
            }
          })
          .finally(() => {
            if (delayMs > 0) {
              setTimeout(() => next(), delayMs);
            } else {
              next();
            }
          });
      });
    };

    next();
  }

  run(): Promise<void> {
    const n = this.options.workers;
    for (let i = 0; i < n; i++) {
      this.runWorker();
    }
    return this.donePromise;
  }
}
