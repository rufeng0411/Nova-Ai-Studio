import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateShowcaseCardRecommendation } from './check-card-bindings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const goodPath = path.join(root, 'docs/showcase-card-recommendation-20260803.json');

describe('check-card-bindings', () => {
  it('passes production recommendation JSON', () => {
    const result = validateShowcaseCardRecommendation(goodPath);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.cardCount, 54);
  });

  it('fails unknown skill slug', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cards-'));
    const doc = JSON.parse(fs.readFileSync(goodPath, 'utf8'));
    doc.cards[0].hub_binding = 'not-a-real-skill-zzz';
    doc.cards[0].binding_kind = 'skill';
    const p = path.join(tmp, 'bad.json');
    fs.writeFileSync(p, JSON.stringify(doc), 'utf8');
    const result = validateShowcaseCardRecommendation(p);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('unknown_skill')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('fails hidden skill', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cards-'));
    const doc = JSON.parse(fs.readFileSync(goodPath, 'utf8'));
    const card = doc.cards.find((c) => c.binding_kind === 'skill');
    card.hub_binding = 'od-research-decision-room';
    card.binding_kind = 'skill';
    const p = path.join(tmp, 'hidden.json');
    fs.writeFileSync(p, JSON.stringify(doc), 'utf8');
    const result = validateShowcaseCardRecommendation(p);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('hidden_skill')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('fails forbidden phrase and missing compliance disclaimer', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cards-'));
    const doc = JSON.parse(fs.readFileSync(goodPath, 'utf8'));
    doc.cards[0].prompt_zh = '请直接开始做并存 artifacts';
    const compliance = doc.cards.find((c) => c.section_id === 'compliance');
    compliance.prompt_zh = '写一份合同审查，无免责。全部写入系统分配任务目录。';
    const p = path.join(tmp, 'forbid.json');
    fs.writeFileSync(p, JSON.stringify(doc), 'utf8');
    const result = validateShowcaseCardRecommendation(p);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('forbidden_phrase')));
    assert.ok(result.errors.some((e) => e.includes('compliance_disclaimer_missing')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('fails geo bar bound to geo-brand-full', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cards-'));
    const doc = JSON.parse(fs.readFileSync(goodPath, 'utf8'));
    const geo = doc.cards.find((c) => c.section_id === 'geo');
    geo.hub_binding = 'geo-brand-full';
    geo.binding_kind = 'template';
    const p = path.join(tmp, 'geo.json');
    fs.writeFileSync(p, JSON.stringify(doc), 'utf8');
    const result = validateShowcaseCardRecommendation(p);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('geo_blocked_fullcase_template')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
