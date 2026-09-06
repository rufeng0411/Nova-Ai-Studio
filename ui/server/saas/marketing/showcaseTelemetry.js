// PD-SAAS-FORK: Showcase admin telemetry (jsonl under DATA_ROOT)
import fs from 'node:fs';
import path from 'node:path';
import { getDataRoot } from '../tenant/paths.js';

const TELEMETRY_DIR = () => path.join(getDataRoot(), 'telemetry');
const EVENTS_FILE = () => path.join(TELEMETRY_DIR(), 'showcase-events.jsonl');

/**
 * @param {Record<string, unknown>} event
 */
export function recordShowcaseTelemetry(event) {
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
