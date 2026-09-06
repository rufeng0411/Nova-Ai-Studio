/**
 * PD-SAAS-FORK: Keep Bridge load latency memory and argument counts bounded.
 * Totals, average, and max remain exact; percentile samples use Algorithm R.
 */
export const DEFAULT_LATENCY_SAMPLE_CAPACITY = 50_000;

function percentile(samples, value) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((value / 100) * sorted.length),
  );
  return Math.round(sorted[index]);
}

function nextReservoirRandom(accumulator) {
  let state = accumulator.randomState >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  accumulator.randomState = state >>> 0;
  return accumulator.randomState / 0x1_0000_0000;
}

export function createLatencyAccumulator(
  sampleCapacity = DEFAULT_LATENCY_SAMPLE_CAPACITY,
) {
  if (!Number.isInteger(sampleCapacity) || sampleCapacity <= 0) {
    throw new Error('延迟样本容量必须为正整数');
  }
  return {
    samples: [],
    sampleCapacity,
    sampleCount: 0,
    sumMs: 0,
    maxMs: 0,
    droppedSampleCount: 0,
    randomState: 0x6d2b79f5,
  };
}

export function recordLatency(accumulator, rawMs) {
  const ms = Number(rawMs);
  if (!Number.isFinite(ms)) return;

  accumulator.sampleCount += 1;
  accumulator.sumMs += ms;
  accumulator.maxMs = accumulator.sampleCount === 1
    ? ms
    : Math.max(accumulator.maxMs, ms);

  if (accumulator.samples.length < accumulator.sampleCapacity) {
    accumulator.samples.push(ms);
    return;
  }

  accumulator.droppedSampleCount += 1;
  const replacementIndex = Math.floor(
    nextReservoirRandom(accumulator) * accumulator.sampleCount,
  );
  if (replacementIndex < accumulator.sampleCapacity) {
    accumulator.samples[replacementIndex] = ms;
  }
}

export function summarizeLatency(accumulator) {
  const sampleCount = accumulator.sampleCount;
  return {
    avg: sampleCount ? Math.round(accumulator.sumMs / sampleCount) : 0,
    p50: percentile(accumulator.samples, 50),
    p95: percentile(accumulator.samples, 95),
    p99: percentile(accumulator.samples, 99),
    max: sampleCount ? Math.round(accumulator.maxMs) : 0,
    sampleCount,
    retainedSampleCount: accumulator.samples.length,
    droppedSampleCount: accumulator.droppedSampleCount,
  };
}
