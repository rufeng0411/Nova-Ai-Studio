import { describe, expect, it } from 'vitest';
import {
  isNonDeliverableBasename,
  isNonUserDeliverablePath,
} from './nonDeliverablePaths';

describe('nonDeliverablePaths', () => {
  it('blocks skill pack paths', () => {
    expect(isNonUserDeliverablePath('skills/last30days/SKILL.md')).toBe(true);
    expect(isNonUserDeliverablePath('vendor/foo/skills/bar/SKILL.md')).toBe(true);
  });

  it('blocks bare SKILL.md outside artifacts', () => {
    expect(isNonUserDeliverablePath('SKILL.md')).toBe(true);
    expect(isNonDeliverableBasename('SKILL.md')).toBe(true);
  });

  it('allows artifacts deliverables including markdown reports', () => {
    expect(isNonUserDeliverablePath('artifacts/worldcup-2026/world-cup-report.md')).toBe(false);
    expect(isNonUserDeliverablePath('.pilotdeck/artifacts/worldcup-2026-report.md')).toBe(false);
  });

  it('allows SKILL.md only under user artifacts folder', () => {
    expect(isNonUserDeliverablePath('artifacts/my-skill-pack/SKILL.md')).toBe(false);
  });

  it('blocks process scripts and failed artifacts', () => {
    expect(isNonUserDeliverablePath('artifacts/campaign/create_brief.py')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/campaign/render.mjs')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/campaign/.failed.brief.docx')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/campaign/brief.failed.docx')).toBe(true);
  });

  it('blocks slide outline metadata from final deliverables', () => {
    expect(isNonUserDeliverablePath('artifacts/slides-demo/outline.json')).toBe(true);
    expect(isNonDeliverableBasename('outline.json')).toBe(true);
  });
});
