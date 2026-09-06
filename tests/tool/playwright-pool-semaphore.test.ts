import assert from "node:assert/strict";
import test from "node:test";

import {
  PlaywrightSemaphore,
} from "../../src/saas/document-export/playwrightPool.js";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("PlaywrightSemaphore defaults to one slot and caps configured concurrency at two", async () => {
  assert.equal(new PlaywrightSemaphore().stats.max, 1);

  const semaphore = new PlaywrightSemaphore(99);
  const gates = [deferred(), deferred(), deferred(), deferred()];
  const started: number[] = [];
  let active = 0;
  let maxActive = 0;
  const jobs = gates.map((gate, index) =>
    semaphore.run(async () => {
      started.push(index);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gate.promise;
      active -= 1;
      return index;
    })
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(semaphore.stats, { active: 2, queued: 2, max: 2 });

  gates[0]!.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2]);
  assert.equal(semaphore.stats.active, 2);

  gates[1]!.resolve();
  gates[2]!.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  gates[3]!.resolve();
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3]);
  assert.equal(maxActive, 2);
  assert.deepEqual(semaphore.stats, { active: 0, queued: 0, max: 2 });
});
