// PD-SAAS-FORK: serialize canvas renders that share one viewer/processor
export class DocumentRenderQueue {
  private active = 0;

  private pending: Array<() => void> = [];

  constructor(private readonly maxConcurrent = 1) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const exec = () => {
        this.active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            const next = this.pending.shift();
            if (next) next();
          });
      };
      if (this.active < this.maxConcurrent) exec();
      else this.pending.push(exec);
    });
  }
}
