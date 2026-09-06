#!/usr/bin/env node
/**
 * PD-SAAS-FORK: browser-backed regression for dialogue stability deliverables.
 *
 * Covers the incident shape:
 * - three-step outline + animated HTML + rendered video task
 * - HTML/3D pages stuck on loading
 * - empty MP4 shells
 * - raw recovery/process key leaks
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { buildTaskGoalContract } from '../src/saas/taskState/taskGoalContract.ts';
import { runFinalAcceptance } from '../src/saas/final-acceptance/finalAcceptance.ts';
import { extractCandidateDeliverablePaths } from '../src/agent/deliverables/validateDeliverablesEngine.ts';
import {
  shouldAutoContinueAfterAssistantText,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  stripAgentRecoveryBoilerplateLines,
} from '../src/agent/errors/userFacingErrors.ts';

const OUT_DIR = path.resolve('artifacts', 'dialogue-stability-playwright');
const GOOD_HTML = path.join(OUT_DIR, 'norway-worldcup-2026-demo.html');
const BAD_HTML = path.join(OUT_DIR, 'worldcup-3d-loading-only.html');
const WEBM_VIDEO = path.join(OUT_DIR, 'norway-worldcup-2026-browser-render.webm');
const FAKE_MP4 = path.join(OUT_DIR, 'empty-shell.mp4');
const SCREENSHOT = path.join(OUT_DIR, 'norway-worldcup-2026-demo.png');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');

const THREE_STEP_GOAL = [
  '帮我把【世界杯2026挪威主题】做成一支能直接发的演示视频，三步连着做，每步把文件存到 artifacts/ 并告诉我路径：',
  '先查清楚这个主题的要点，写一份 8-12 节的结构化大纲。',
  '按大纲做一套深色现代风的动效网页演示，每节一屏。',
  '把演示页按每屏 4-6 秒渲染成横版 1080p 视频。',
].join('\n');

const AUDIENCE_GOAL = '用「audience-intelligence」帮我：【世界杯周边受众】，输出可打开的 Markdown 文件。';
const AUDIENCE_BAD_DELIVERY_TEXT = [
  '已完成，交付文件汇总：',
  '使用方法 Markdown /01-topic.md',
  '可重复使用 Markdown /02-topic-template.md',
].join('\n');

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildGoodHtml() {
  const sections = [
    ['资格赛信号', '挪威正在从黑马叙事转向强队叙事', ['锋线效率稳定', '年轻核心成熟', '关注度持续上升']],
    ['北欧战神', '用冰蓝与深红建立 Viking visual hook', ['峡湾、极光、金属纹理', '低饱和深色底', '强对比标题']],
    ['核心球星', '用 Haaland 作为第一视觉锚点，但避免单人依赖', ['锋线终结', '中场连接', '团队压迫']],
    ['战术画面', '以高压、纵深、反击三段构成动效节奏', ['压迫线推进', '长传冲刺', '禁区爆点']],
    ['球迷情绪', '把多年缺席世界杯的期待做成回归感', ['等待', '爆发', '登场']],
    ['全球对手', '与传统豪门同框，突出“北欧挑战者”', ['法国', '巴西', '英格兰']],
    ['发布结构', '每屏 4-6 秒，适合剪成 18-45 秒版本', ['首屏钩子', '中段数据', '末屏 CTA']],
    ['结尾号召', '让视频停在可传播口号上', ['NORWAY RISES', '2026', 'THE NORTH RETURNS']],
  ];
  const sectionHtml = sections.map(([title, point, bullets], index) => `
    <section class="screen" data-screen="${index + 1}">
      <div class="kicker">SCREEN ${String(index + 1).padStart(2, '0')}</div>
      <h2>${htmlEscape(title)}</h2>
      <p>${htmlEscape(point)}</p>
      <ul>${bullets.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
    </section>`).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>世界杯2026挪威主题 · 动效网页演示</title>
  <style>
    :root { color-scheme: dark; --ice:#8ed8ff; --red:#c51f3a; --gold:#e8c47a; }
    * { box-sizing: border-box; }
    body { margin:0; background:#04070d; color:#f7fbff; font-family: Inter, "Microsoft YaHei", sans-serif; overflow-x:hidden; }
    #loading { position:fixed; inset:0; z-index:10; display:grid; place-items:center; background:radial-gradient(circle at 50% 45%, #173154, #04070d 62%); letter-spacing:.24em; }
    #loading[hidden] { display:none; }
    .hero { min-height:100vh; display:grid; place-items:center; padding:8vw; position:relative; overflow:hidden; }
    .hero h1 { font-size:clamp(56px, 9vw, 132px); line-height:.88; max-width:1000px; margin:0; text-transform:uppercase; }
    .hero p { max-width:740px; font-size:22px; color:#b8d6e8; }
    canvas { position:absolute; inset:0; width:100%; height:100%; opacity:.72; }
    .hero-content { position:relative; z-index:1; }
    .screen { min-height:100vh; display:flex; flex-direction:column; justify-content:center; gap:20px; padding:9vw; border-top:1px solid rgba(142,216,255,.12); background:linear-gradient(120deg, rgba(7,15,28,.96), rgba(31,4,14,.88)); animation: rise .8s ease both; }
    .kicker { color:var(--gold); letter-spacing:.3em; font-size:13px; }
    h2 { margin:0; font-size:clamp(44px, 7vw, 92px); }
    p { max-width:860px; font-size:clamp(20px, 2.5vw, 34px); color:#d7ecff; }
    ul { display:flex; flex-wrap:wrap; gap:12px; padding:0; margin:0; list-style:none; }
    li { border:1px solid rgba(142,216,255,.24); border-radius:999px; padding:10px 16px; color:#b8d6e8; background:rgba(255,255,255,.04); }
    @keyframes rise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  </style>
</head>
<body>
  <div id="loading">LOADING NORDIC SCENE</div>
  <main>
    <section class="hero" data-screen="0">
      <canvas id="scene" width="1920" height="1080"></canvas>
      <div class="hero-content">
        <div class="kicker">WORLD CUP 2026 / NORWAY</div>
        <h1>THE NORTH RETURNS</h1>
        <p>深色现代风、每节一屏、可录制为横版演示视频的网页演示。</p>
      </div>
    </section>
    ${sectionHtml}
  </main>
  <script>
    const canvas = document.getElementById('scene');
    const ctx = canvas.getContext('2d');
    let t = 0;
    function draw() {
      t += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const g = ctx.createRadialGradient(960, 520, 20, 960, 520, 900);
      g.addColorStop(0, 'rgba(142,216,255,.34)');
      g.addColorStop(.45, 'rgba(197,31,58,.18)');
      g.addColorStop(1, 'rgba(4,7,13,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 96; i++) {
        const x = (Math.sin(i * 17.13 + t) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(i * 9.7 + t * 0.8) * 0.5 + 0.5) * canvas.height;
        ctx.fillStyle = i % 7 === 0 ? 'rgba(232,196,122,.95)' : 'rgba(142,216,255,.7)';
        ctx.beginPath();
        ctx.arc(x, y, i % 7 === 0 ? 3.2 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    requestAnimationFrame(() => {
      document.getElementById('loading').hidden = true;
      window.__sceneReady = true;
    });
  </script>
</body>
</html>`;
}

function buildBadHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>世界杯 3D Loading Broken</title></head>
<body>
  <div id="loading">Loading 3D scene...</div>
  <script src="https://unpkg.com/three@0.160.0/build/three.module.js"></script>
  <script type="module">
    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
    initExternalOnlyScene();
  </script>
</body>
</html>`;
}

async function writeFixtures() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(GOOD_HTML, buildGoodHtml(), 'utf8');
  await fs.writeFile(BAD_HTML, buildBadHtml(), 'utf8');
  const fake = Buffer.alloc(1024);
  fake.writeUInt32BE(24, 0);
  fake.write('ftypisom', 4, 'latin1');
  await fs.writeFile(FAKE_MP4, fake);
}

async function readHeader(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.subarray(0, 12).toString('latin1');
}

async function recordPlayableWebm(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.start();
    const start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const p = Math.min(1, (now - start) / 1300);
        ctx.fillStyle = '#04070d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#8ed8ff';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('NORWAY 2026', 46, 86);
        ctx.fillStyle = '#c51f3a';
        ctx.fillRect(46, 130, 548 * p, 34);
        ctx.fillStyle = '#e8c47a';
        ctx.beginPath();
        ctx.arc(320 + Math.sin(p * Math.PI * 4) * 120, 240, 36, 0, Math.PI * 2);
        ctx.fill();
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    recorder.stop();
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    const buffer = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  });
  await fs.writeFile(WEBM_VIDEO, Buffer.from(bytes));
}

async function probeVideoPlayback(page, filePath) {
  const src = pathToFileURL(filePath).href;
  return page.evaluate(async (videoSrc) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    document.body.appendChild(video);
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, timeout: true }), 5000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve({
          ok: Number.isFinite(video.duration) && video.duration > 0,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
      video.onerror = () => {
        clearTimeout(timer);
        resolve({ ok: false, errorCode: video.error?.code ?? null });
      };
      video.src = videoSrc;
      video.load();
    });
  }, src);
}

async function main() {
  await writeFixtures();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const report = {
    startedAt: new Date().toISOString(),
    outDir: OUT_DIR,
    checks: {},
  };
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  try {
    const contract = buildTaskGoalContract({
      userGoal: THREE_STEP_GOAL,
      capabilitySlug: 'html-video',
      majorCategory: 'creative',
    });
    report.checks.contract = {
      expectedKinds: contract.expectedKinds,
      minCount: contract.minCount,
      ok: JSON.stringify(contract.expectedKinds) === JSON.stringify(['markdown', 'video', 'html'])
        && contract.minCount === 8,
    };
    assert.equal(report.checks.contract.ok, true, 'contract must require markdown + video + html with minCount 8');

    await page.goto(pathToFileURL(GOOD_HTML).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 5000 });
    const goodState = await page.evaluate(() => {
      const loading = document.querySelector('#loading');
      return {
        loadingHidden: loading?.hidden === true || getComputedStyle(loading).display === 'none',
        sections: document.querySelectorAll('section[data-screen]').length,
        hasCanvas: Boolean(document.querySelector('canvas#scene')),
        text: document.body.innerText,
      };
    });
    await page.screenshot({ path: SCREENSHOT, fullPage: true });
    const goodConsoleErrors = [...consoleErrors];
    report.checks.goodHtmlBrowser = {
      ...goodState,
      consoleErrors: goodConsoleErrors,
      ok: goodState.loadingHidden === true
        && goodState.sections >= 9
        && goodState.hasCanvas === true
        && !/session_prepare|memory_retrieve|router_judge|Repeated invalid tool input/i.test(goodState.text)
        && goodConsoleErrors.length === 0,
    };
    assert.equal(report.checks.goodHtmlBrowser.ok, true, 'good HTML must render without loading/raw leaks');
    consoleErrors.length = 0;

    const badHtmlAcceptance = await runFinalAcceptance({
      userGoal: '用 3D网页创作做世界杯2026巨星集锦展示网页',
      candidates: [{
        path: 'artifacts/3d/world-cup-2026-stars/index.html',
        kind: 'html',
        exists: true,
        sizeBytes: (await fs.stat(BAD_HTML)).size,
        textPreview: await fs.readFile(BAD_HTML, 'utf8'),
      }],
    });
    report.checks.badHtmlAcceptance = {
      status: badHtmlAcceptance.status,
      failures: badHtmlAcceptance.failures.map((failure) => failure.reason),
      ok: badHtmlAcceptance.status === 'needs_repair'
        && badHtmlAcceptance.failures.some((failure) => failure.reason === 'invalid_html'),
    };
    assert.equal(report.checks.badHtmlAcceptance.ok, true, 'loading-only HTML must fail acceptance');

    await page.goto(pathToFileURL(BAD_HTML).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const badState = await page.evaluate(() => ({
      loadingVisible: getComputedStyle(document.querySelector('#loading')).display !== 'none',
      sceneReady: window.__sceneReady === true,
      text: document.body.innerText,
    }));
    report.checks.badHtmlBrowser = {
      ...badState,
      ok: badState.loadingVisible === true && badState.sceneReady === false,
    };
    assert.equal(report.checks.badHtmlBrowser.ok, true, 'bad HTML fixture should reproduce stuck loading');

    const cleaned = stripAgentRecoveryBoilerplateLines([
      '网页已生成：artifacts/3d/world-cup-2026-stars/index.html',
      'Repeated invalid tool input after recovery attempts.',
      'session_prepare',
    ].join('\n'));
    await page.setContent(`<main><p id="assistant">${htmlEscape(cleaned)}</p><ol><li><span>使用工具：正在准备对话</span></li></ol></main>`);
    const visibleText = await page.locator('body').innerText();
    report.checks.copySanitizeBrowser = {
      visibleText,
      ok: !/Repeated invalid tool input/i.test(visibleText)
        && !/session_prepare/i.test(visibleText),
    };
    assert.equal(report.checks.copySanitizeBrowser.ok, true, 'browser-visible copy must not leak raw recovery/process keys');

    const audienceContract = buildTaskGoalContract({
      userGoal: AUDIENCE_GOAL,
      capabilitySlug: 'audience-intelligence',
      majorCategory: 'marketing',
    });
    const audienceCandidates = extractCandidateDeliverablePaths([{
      role: 'assistant',
      content: [{ type: 'text', text: AUDIENCE_BAD_DELIVERY_TEXT }],
    }]);
    const audienceIncomplete = shouldAutoContinueAfterIncompleteDeliverableStop(AUDIENCE_BAD_DELIVERY_TEXT, {
      userGoalText: AUDIENCE_GOAL,
    });
    const audienceOpenFailAutoContinue = shouldAutoContinueAfterAssistantText(
      '请问您遇到的具体问题是怎样的呢？什么类型的文件？在哪种设备上打开？用哪个软件打开？',
      {
        latestUserText: '你给的交付物打不开',
        userGoalText: AUDIENCE_GOAL,
      },
    );
    await page.setContent([
      '<main>',
      '<section id="deliverables">',
      '<a href="artifacts/audience/worldcup-20260625/01-topic.md">01-topic.md</a>',
      '<a href="artifacts/audience/worldcup-20260625/02-topic-template.md">02-topic-template.md</a>',
      '</section>',
      '</main>',
    ].join(''));
    const audienceVisibleText = await page.locator('body').innerText();
    report.checks.audienceOpenFailure = {
      expectedKinds: audienceContract.expectedKinds,
      candidates: audienceCandidates,
      audienceIncomplete,
      audienceOpenFailAutoContinue,
      visibleText: audienceVisibleText,
      ok: audienceContract.expectedKinds.includes('markdown')
        && !audienceCandidates.some((candidate) => candidate === '/01-topic.md' || candidate === '01-topic.md' || candidate === '02-topic-template.md')
        && audienceIncomplete === true
        && audienceOpenFailAutoContinue === true
        && !/\/01-topic\.md|\/02-topic-template\.md|什么类型的文件|在哪种设备|用哪个软件/.test(audienceVisibleText),
    };
    assert.equal(report.checks.audienceOpenFailure.ok, true, 'audience deliverable open-failure must self-repair instead of asking generic diagnostics');

    await page.setContent('<body></body>');
    await recordPlayableWebm(page);
    const playableVideo = await probeVideoPlayback(page, WEBM_VIDEO);
    report.checks.playableVideoBrowser = {
      ...playableVideo,
      bytes: (await fs.stat(WEBM_VIDEO)).size,
      ok: playableVideo.ok === true && (await fs.stat(WEBM_VIDEO)).size >= 16 * 1024,
    };
    assert.equal(report.checks.playableVideoBrowser.ok, true, 'browser-rendered video must be playable and non-empty');

    await page.setContent('<body></body>');
    const fakeMp4Playback = await probeVideoPlayback(page, FAKE_MP4);
    const fakeMp4Acceptance = await runFinalAcceptance({
      userGoal: '用 HTML 代码做视频，导出一支 18 秒 MP4 视频',
      goalContract: buildTaskGoalContract({ userGoal: '用 HTML 代码做视频，导出一支 18 秒 MP4 视频' }),
      candidates: [{
        path: 'artifacts/norway-viking-worldcup-2026/output.mp4',
        kind: 'video',
        exists: true,
        sizeBytes: (await fs.stat(FAKE_MP4)).size,
        binaryHeader: await readHeader(FAKE_MP4),
      }],
    });
    report.checks.fakeMp4 = {
      playback: fakeMp4Playback,
      acceptanceStatus: fakeMp4Acceptance.status,
      brokenPaths: fakeMp4Acceptance.brokenPaths,
      ok: fakeMp4Playback.ok === false
        && fakeMp4Acceptance.status === 'needs_repair'
        && fakeMp4Acceptance.brokenPaths.length > 0,
    };
    assert.equal(report.checks.fakeMp4.ok, true, 'fake MP4 shell must fail browser playback and acceptance');

    const videoComplaintAutoContinue = shouldAutoContinueAfterAssistantText(
      'HTML 演示页和 outline.md 已完成。视频需本地执行 render_html_video 生成。',
      {
        latestUserText: '视频无法播放，网页也无法使用',
        userGoalText: THREE_STEP_GOAL,
      },
    );
    await page.setContent([
      '<main>',
      '<table>',
      '<tr><td>视频</td><td>MP4</td><td>未完成</td><td></td></tr>',
      '</table>',
      '</main>',
    ].join(''));
    const videoComplaintVisibleText = await page.locator('body').innerText();
    report.checks.videoPlaybackComplaint = {
      videoComplaintAutoContinue,
      visibleText: videoComplaintVisibleText,
      ok: videoComplaintAutoContinue === true
        && /未完成/.test(videoComplaintVisibleText)
        && !/已交付\s*—/.test(videoComplaintVisibleText),
    };
    assert.equal(report.checks.videoPlaybackComplaint.ok, true, 'video playback/open complaints must trigger repair and not show delivered dash');

    const completeAcceptance = await runFinalAcceptance({
      userGoal: THREE_STEP_GOAL,
      goalContract: contract,
      candidates: [
        {
          path: 'artifacts/dialogue-stability-playwright/outline.md',
          kind: 'markdown',
          exists: true,
          sizeBytes: 2048,
          textPreview: '# 结构化大纲\n1. 资格赛信号\n2. 北欧战神\n3. 核心球星\n4. 战术画面\n5. 球迷情绪\n6. 全球对手\n7. 发布结构\n8. 结尾号召',
        },
        {
          path: 'artifacts/dialogue-stability-playwright/norway-worldcup-2026-demo.html',
          kind: 'html',
          exists: true,
          sizeBytes: (await fs.stat(GOOD_HTML)).size,
          textPreview: await fs.readFile(GOOD_HTML, 'utf8'),
        },
        {
          path: 'artifacts/dialogue-stability-playwright/norway-worldcup-2026-browser-render.webm',
          kind: 'video',
          exists: true,
          sizeBytes: (await fs.stat(WEBM_VIDEO)).size,
          binaryHeader: await readHeader(WEBM_VIDEO),
        },
      ],
    });
    report.checks.completeAcceptance = {
      status: completeAcceptance.status,
      verifiedPaths: completeAcceptance.verifiedPaths,
      ok: completeAcceptance.status === 'passed',
    };
    assert.equal(report.checks.completeAcceptance.ok, true, 'complete three-step deliverables must pass');
  } finally {
    await browser.close();
  }

  report.endedAt = new Date().toISOString();
  report.passed = Object.values(report.checks).every((check) => check?.ok === true);
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

main().catch(async (error) => {
  await fs.mkdir(OUT_DIR, { recursive: true }).catch(() => {});
  const report = {
    endedAt: new Date().toISOString(),
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  };
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8').catch(() => {});
  console.error('[playwright-dialogue-stability-regression]', report.error);
  process.exit(1);
});
