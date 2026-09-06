import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_LATENCY_SAMPLE_CAPACITY,
  createLatencyAccumulator,
  recordLatency,
  summarizeLatency,
} from '../../scripts/lib/bridgeStabilityLatency.mjs';

test('大样本延迟统计保持有界并以流式最大值避免参数栈溢出', () => {
  const accumulator = createLatencyAccumulator();
  const sampleCount = 250_000;

  for (let index = 0; index < sampleCount; index += 1) {
    recordLatency(accumulator, index);
  }

  const summary = summarizeLatency(accumulator);
  assert.equal(summary.sampleCount, sampleCount);
  assert.equal(summary.max, sampleCount - 1);
  assert.equal(summary.avg, Math.round((sampleCount - 1) / 2));
  assert.ok(
    accumulator.samples.length <= DEFAULT_LATENCY_SAMPLE_CAPACITY,
    `保留样本 ${accumulator.samples.length} 超过容量 ${DEFAULT_LATENCY_SAMPLE_CAPACITY}`,
  );
  assert.equal(
    summary.retainedSampleCount,
    DEFAULT_LATENCY_SAMPLE_CAPACITY,
  );
  assert.equal(
    summary.droppedSampleCount,
    sampleCount - DEFAULT_LATENCY_SAMPLE_CAPACITY,
  );
});

test('延迟摘要保留现有 p50/p95/p99 与最大值字段', () => {
  const accumulator = createLatencyAccumulator(16);
  for (const latency of [10, 20, 30, 40, 50]) {
    recordLatency(accumulator, latency);
  }

  assert.deepEqual(summarizeLatency(accumulator), {
    avg: 30,
    p50: 30,
    p95: 50,
    p99: 50,
    max: 50,
    sampleCount: 5,
    retainedSampleCount: 5,
    droppedSampleCount: 0,
  });
});

test('Bridge load 门禁使用有界延迟累加器且不再展开长数组', () => {
  const source = fs.readFileSync(
    new URL('../../scripts/load/bridge-stability-load.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /createLatencyAccumulator/);
  assert.match(source, /recordLatency/);
  assert.match(source, /summarizeLatency/);
  assert.doesNotMatch(source, /Math\.max\(\.\.\.lats\)/);
  assert.doesNotMatch(source, /\.latencies\.push\(/);
});
