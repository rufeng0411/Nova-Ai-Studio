// PD-SAAS-FORK: global semaphore for outbound web tools

export class OutboundGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error(`OutboundGate maxConcurrent must be >= 1, got ${maxConcurrent}`);
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get stats(): { active: number; queued: number; max: number } {
    return { active: this.active, queued: this.queue.length, max: this.maxConcurrent };
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

let sharedOutboundGate: OutboundGate | null = null;

export function getSharedOutboundGate(maxConcurrent = 2): OutboundGate {
  if (!sharedOutboundGate || sharedOutboundGate.stats.max !== maxConcurrent) {
    sharedOutboundGate = new OutboundGate(maxConcurrent);
  }
  return sharedOutboundGate;
}

export function resetSharedOutboundGateForTests(): void {
  sharedOutboundGate = null;
}
