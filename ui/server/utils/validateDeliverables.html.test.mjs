import assert from 'node:assert/strict';
import test from 'node:test';

import { isLikelyRenderableHtmlDeliverable } from './htmlDeliverableValidation.js';
import { shouldRejectUnhintedDeliverablePath } from './validateDeliverables.js';

test('accepts a normal html document', () => {
  assert.equal(
    isLikelyRenderableHtmlDeliverable('<!doctype html><html><head><title>OK</title></head><body><main>OK</main></body></html>'),
    true,
  );
});

test('rejects corrupted html with leaked leading fragments', () => {
  assert.equal(
    isLikelyRenderableHtmlDeliverable('<<<!DOCTYPE html><html><body>broken</body></html>'),
    false,
  );
});

test('rejects placeholder hello-world html as a failed deliverable', () => {
  assert.equal(
    isLikelyRenderableHtmlDeliverable('<!doctype html><html><head><title>Hello World Test Page Final</title></head><body>This is a test page.</body></html>'),
    false,
  );
});

test('accepts a modern landing page with official images and placeholder attributes', () => {
  const html = `<!doctype html>
<html lang="zh-CN">
<head><title>RAZER 2026</title><style>.screen{min-height:100vh}</style></head>
<body>
  <main>
    <div class="screen hero"><h1>FOR GAMERS. FOR THE FUTURE.</h1></div>
    <div class="screen product"><img src="https://medias-p1.phoenix.razer.com/blade.png" alt="Razer Blade" placeholder="blur"></div>
    <div class="screen panel"><h2>Huntsman</h2></div>
    <div class="screen panel"><h2>Viper</h2></div>
    <div class="screen panel"><h2>HyperCloud</h2></div>
  </main>
  <script>new IntersectionObserver(() => {});</script>
</body>`;
  assert.equal(isLikelyRenderableHtmlDeliverable(html), true);
});

test('rejects root slash and bare deliverable paths unless a hintDir anchors them', () => {
  assert.equal(shouldRejectUnhintedDeliverablePath('/01-topic.md'), true);
  assert.equal(shouldRejectUnhintedDeliverablePath('01-topic.md'), true);
  assert.equal(shouldRejectUnhintedDeliverablePath('01-topic.md', 'artifacts/audience/worldcup-20260625'), false);
  assert.equal(shouldRejectUnhintedDeliverablePath('artifacts/audience/worldcup-20260625/01-topic.md'), false);
});
