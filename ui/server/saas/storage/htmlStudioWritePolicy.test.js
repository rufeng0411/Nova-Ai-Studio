import { describe, expect, it } from 'vitest';
import {
  isHtmlDeliverableWritePath,
  scriptsChanged,
  validateHtmlDeliverableWrite,
} from './htmlStudioWritePolicy.js';

describe('htmlStudioWritePolicy', () => {
  it('allows artifacts html paths', () => {
    expect(isHtmlDeliverableWritePath('artifacts/geo/report.html')).toBe(true);
    expect(isHtmlDeliverableWritePath('artifacts/geo/geo-report-theme.css')).toBe(true);
    expect(isHtmlDeliverableWritePath('artifacts/geo/.nova-edit-backups/x.html')).toBe(true);
  });

  it('blocks canvas board and non-artifacts', () => {
    expect(isHtmlDeliverableWritePath('artifacts/canvas-abc/canvas-manifest.json')).toBe(false);
    expect(isHtmlDeliverableWritePath('src/index.html')).toBe(false);
  });

  it('rejects script mutation', () => {
    const before = '<html><script>a()</script></html>';
    const after = '<html><script>b()</script></html>';
    expect(scriptsChanged(before, after)).toBe(true);
    const validation = validateHtmlDeliverableWrite(before, after);
    expect(validation.ok).toBe(false);
  });

  it('allows text-only html mutation', () => {
    const before = '<html><body><h1>A</h1><script>x()</script></body></html>';
    const after = '<html><body><h1>B</h1><script>x()</script></body></html>';
    const validation = validateHtmlDeliverableWrite(before, after);
    expect(validation.ok).toBe(true);
  });

  it('allows NGRS report-data JSON dual-write', () => {
    const before = `<html><body><h1 data-ngrs-title>Old</h1>
      <script id="report-data" type="application/json">{"title":"Old"}</script>
      <script src="geo-chart-theme.js"></script></body></html>`;
    const after = `<html><body><h1 data-ngrs-title>New</h1>
      <script id="report-data" type="application/json">{"title":"New"}</script>
      <script src="geo-chart-theme.js"></script></body></html>`;
    const validation = validateHtmlDeliverableWrite(before, after);
    expect(validation.ok).toBe(true);
  });
});
