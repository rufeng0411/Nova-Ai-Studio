/**
 * PD-SAAS-FORK: conversation_catalog telemetry (jsonl under DATA_ROOT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDataRoot } from '../tenant/paths.js';

const TELEMETRY_DIR = () => path.join(getDataRoot(), 'telemetry');
const EVENTS_FILE = () => path.join(TELEMETRY_DIR(), 'conversation-catalog-events.jsonl');

/**
 * @param {Record<string, unknown>} event
 */
export function recordCatalogTelemetry(event) {
  try {
    fs.mkdirSync(TELEMETRY_DIR(), { recursive: true });
    fs.appendFileSync(
      EVENTS_FILE(),
      `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`,
      'utf8',
    );
  } catch {
    // telemetry must not break requests
  }
}

/**
 * @param {{ lagSeconds?: number, backlog?: number, missingTranscript?: number }} metrics
 */
export function recordCatalogLagMetrics(metrics) {
  recordCatalogTelemetry({ event: 'catalog_metrics', ...metrics });
}
