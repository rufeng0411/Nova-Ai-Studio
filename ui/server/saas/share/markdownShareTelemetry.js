// PD-SAAS-FORK: Markdown public share telemetry (jsonl)
import fs from 'node:fs';
import path from 'node:path';
import { getDataRoot } from '../tenant/paths.js';

function resolveEventsFile() {
  const dataRoot = getDataRoot();
  if (dataRoot) {
    return path.join(dataRoot, 'telemetry', 'markdown-share-events.jsonl');
  }
  return path.join(process.cwd(), '.saas-dev-data', 'telemetry', 'markdown-share-events.jsonl');
}

/**
 * @param {Record<string, unknown>} event
 */
export function recordMarkdownShareTelemetry(event) {
  try {
    const filePath = resolveEventsFile();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(
      filePath,
      `${JSON.stringify({
        ...event,
        urlHasJwt: false,
        at: event.at ?? new Date().toISOString(),
      })}\n`,
      'utf8',
    );
  } catch {
    // telemetry must not break requests
  }
}

export function resolveMarkdownShareTelemetryPath() {
  return resolveEventsFile();
}
