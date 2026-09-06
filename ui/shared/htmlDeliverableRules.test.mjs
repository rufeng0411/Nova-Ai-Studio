import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasBrokenChartHtml,
  hasIndefiniteLoadingHtml,
  isLikelyFormalHtml,
} from './htmlDeliverableRules.mjs';

const FORMAL =
  '<!doctype html><html><head><title>报告</title></head><body><main><section>雷蛇风格报告正文，含完整结论与图表说明文字。</section></main></body></html>';

test('isLikelyFormalHtml accepts a real document and rejects stubs/leaks', () => {
  assert.equal(isLikelyFormalHtml(FORMAL), true);
  assert.equal(isLikelyFormalHtml(''), false);
  assert.equal(isLikelyFormalHtml('<<<!doctype html><html><body>broken</body></html>'), false);
  assert.equal(isLikelyFormalHtml('<!doctype html><html><body>hello world test page</body></html>'), false);
  assert.equal(isLikelyFormalHtml('CONTINUE HERE <!doctype html><html><body>x</body></html>'), false);
});

test('hasBrokenChartHtml flags chart libs that ship no canvas or chart container', () => {
  const broken = `${FORMAL}<script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>new Chart(ctx,{});</script>`;
  assert.equal(hasBrokenChartHtml(broken), true);

  const withCanvas =
    '<!doctype html><html><body><canvas id="c"></canvas><script src="chart.js"></script><script>new Chart(document.getElementById("c"),{})</script></body></html>';
  assert.equal(hasBrokenChartHtml(withCanvas), false);

  const withContainer =
    '<!doctype html><html><body><div class="chart-wrap"></div><script>echarts.init(el)</script></body></html>';
  assert.equal(hasBrokenChartHtml(withContainer), false);

  // No charting library referenced at all → not a chart defect.
  assert.equal(hasBrokenChartHtml(FORMAL), false);
});

test('hasIndefiniteLoadingHtml flags CDN-gated spinners with no removal and no fallback', () => {
  const stuck =
    '<!doctype html><html><body><div class="loading">加载中</div><script src="https://unpkg.com/three"></script></body></html>';
  assert.equal(hasIndefiniteLoadingHtml(stuck), true);

  // Spinner is removed once ready → fine.
  const removed =
    '<!doctype html><html><body><div class="loader">Loading</div><script src="https://unpkg.com/three"></script><script>loader.style.display=\'none\';</script></body></html>';
  assert.equal(hasIndefiniteLoadingHtml(removed), false);

  // Provides a noscript fallback → fine.
  const fallback =
    '<!doctype html><html><body><div class="spinner">Loading</div><noscript>静态内容</noscript><script src="https://cdn.jsdelivr.net/npm/gsap"></script></body></html>';
  assert.equal(hasIndefiniteLoadingHtml(fallback), false);

  // Spinner but no external 3D/video CDN dependency → not our concern.
  const noCdn =
    '<!doctype html><html><body><div class="loading">加载中</div><script>init()</script></body></html>';
  assert.equal(hasIndefiniteLoadingHtml(noCdn), false);

  assert.equal(hasIndefiniteLoadingHtml(FORMAL), false);
});
