// PD-SAAS-FORK: bounded concurrency + per-task timeout for document import
type QueueItem<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class ImportWorkerPool {
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private active = 0;
  private queue: QueueItem<unknown>[] = [];

  constructor(concurrency: number, timeoutMs: number) {
    this.concurrency = Math.max(1, concurrency);
    this.timeoutMs = Math.max(1000, timeoutMs);
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve: resolve as (v: unknown) => void, reject });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;
      this.active += 1;
      void this.runWithTimeout(item)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }

  private async runWithTimeout<T>(item: QueueItem<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        item.fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error("document import timed out")), this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

let defaultPool: ImportWorkerPool | null = null;

export function getImportWorkerPool(concurrency: number, timeoutMs: number): ImportWorkerPool {
  if (!defaultPool) {
    defaultPool = new ImportWorkerPool(concurrency, timeoutMs);
  }
  return defaultPool;
}

export function resetImportWorkerPoolForTests(): void {
  defaultPool = null;
}
