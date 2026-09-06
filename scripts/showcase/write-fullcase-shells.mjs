#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ARTIFACTS = path.join(ROOT, 'artifacts/saas-design/demos-showcase');
const DEPLOY = path.join(ROOT, 'deploy/marketing/showcase');
const ASSET_V = '15';

const CASES = [
  { file: 'fullcase-campaign.html', fcCase: 'full-campaign', titleSuffix: 'Campaign' },
  { file: 'fullcase-flywheel.html', fcCase: 'full-flywheel', titleSuffix: 'Flywheel' },
  { file: 'fullcase-geo.html', fcCase: 'full-geo', titleSuffix: 'GEO' },
];

function shellHtml({ fcCase, titleSuffix }) {
  return `<!DOCTYPE html>
<html lang="en" class="fc-html">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0a0a0a" />
  <title>Full case ${titleSuffix} · Nova Studio N2</title>
  <link rel="icon" href="/showcase/assets/nova-logo-mark.png" />
  <link rel="stylesheet" href="/shared/tokens.css?v=${ASSET_V}" />
  <link rel="stylesheet" href="shared/fullcase.css?v=${ASSET_V}" />
  <script>window.FC_CASE = '${fcCase}';</script>
</head>
<body class="fc-body">
  <div class="fc-shell">
    <header class="fc-top">
      <a class="fc-back" href="/showcase/#fullcase" id="fc-back" data-i18n="back">Back</a>
      <div class="fc-top__main">
        <h1 class="fc-title"><span class="fc-star" aria-hidden="true">*</span><span id="fc-title"></span></h1>
        <span class="fc-template__hint" data-i18n="templateHint">Template</span>
        <span class="fc-template-name" id="fc-template"></span>
      </div>
      <button type="button" class="fc-copy" id="fc-copy" data-i18n="copy">Copy</button>
    </header>
    <details class="fc-prompt-bar" id="fc-prompt-bar">
      <summary>
        <span class="fc-prompt-label" data-i18n="promptLabel">Prompt</span>
        <span class="fc-prompt-preview" id="fc-prompt-preview"></span>
        <span class="fc-prompt-chevron" aria-hidden="true">&gt;</span>
      </summary>
      <p class="fc-prompt-full" id="fc-prompt"></p>
    </details>
    <div class="fc-main">
      <aside class="fc-tree" aria-label="Deliverables tree">
        <div class="fc-tree__head" data-i18n="treeHead">Deliverables</div>
        <ul class="fc-tree__list" id="fc-tree"></ul>
      </aside>
      <section class="fc-preview" aria-label="Preview">
        <div class="fc-preview__bar"><span class="fc-preview__path" id="fc-path" data-i18n="pathHint">Select a file</span></div>
        <div class="fc-preview__stage" id="fc-stage">
          <div class="fc-empty" id="fc-empty" data-i18n="empty">Select a file on the left</div>
          <div class="fc-error fc-hidden" id="fc-error" data-i18n="error">Could not load this file</div>
          <div class="fc-frame-host fc-hidden" id="fc-frame-host"><iframe class="fc-frame" id="fc-frame" title="Preview"></iframe></div>
          <article class="fc-md fc-hidden" id="fc-md"></article>
          <div class="fc-img-wrap fc-hidden" id="fc-img-wrap"><img id="fc-img" alt="" /></div>
          <div class="fc-video-wrap fc-hidden" id="fc-video-wrap"><video id="fc-video" controls playsinline></video></div>
        </div>
      </section>
    </div>
  </div>
  <script src="shared/fullcases.js?v=${ASSET_V}"></script>
  <script src="shared/fullcase-viewer.js?v=${ASSET_V}"></script>
</body>
</html>
`;
}

fs.mkdirSync(DEPLOY, { recursive: true });
for (const spec of CASES) {
  const html = shellHtml(spec);
  for (const dest of [path.join(ARTIFACTS, spec.file), path.join(DEPLOY, spec.file)]) {
    fs.writeFileSync(dest, html, 'utf8');
    console.log('[write-fullcase-shells]', dest);
  }
}