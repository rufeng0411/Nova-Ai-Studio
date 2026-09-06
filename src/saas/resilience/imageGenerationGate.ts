// PD-SAAS-FORK: queue generate_image calls to reduce provider 429 bursts

type QueueEntry = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class ImageGenerationGate {
  private readonly maxConcurrent: number;
  private active = 0;
  private readonly queue: QueueEntry[] = [];

  constructor(maxConcurrent: number) {
    this.maxConcurrent = Math.max(0, Math.floor(maxConcurrent));
  }

  get enabled(): boolean {
    return this.maxConcurrent > 0;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.maxConcurrent <= 0) {
      return fn();
    }
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry = {
        run: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      };
      this.queue.push(entry);
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.active += 1;
      void entry
        .run()
        .then((value) => entry.resolve(value))
        .catch((error) => entry.reject(error))
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}

let sharedGate: ImageGenerationGate | null = null;
let sharedMax = 0;

export function getImageGenerationGate(maxConcurrent: number): ImageGenerationGate {
  const max = Math.max(0, Math.floor(maxConcurrent));
  if (!sharedGate || sharedMax !== max) {
    sharedGate = new ImageGenerationGate(max);
    sharedMax = max;
  }
  return sharedGate;
}
