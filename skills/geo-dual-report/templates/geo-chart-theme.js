/**
 * Nova GEO Report System (NGRS) v1 — ChartCatalog + animation presets
 * PD-SAAS-FORK
 */
(function (global) {
  'use strict';

  var PALETTE = ['#0F766E', '#4F46E5', '#0E7490', '#6366F1', '#647084'];
  var ACCENT = '#0F766E';
  var ACCENT_SOFT = 'rgba(15,118,110,0.12)';
  var MUTED = '#647084';
  var GRID = '#EEF0F3';
  var HIT = '#0F766E';
  var MISS = '#D1D5DB';
  var P0 = '#B91C1C';
  var P1 = '#B45309';
  var P2 = '#647084';

  var ALIASES = {
    'score-bar': 'scoreGauge',
    'ernie': 'baidu',
    'wenxin': 'baidu',
    'chatgpt': 'openai',
    'gpt': 'openai',
    'dimension-radar': 'dimensionRadar',
    'keyword-bar': 'keywordHorizontalBar',
    'topic-distribution': 'topicPolarArea',
    'competitor-bar': 'competitorGroupedBar',
    'sov-doughnut': 'sovDoughnut',
    'citability-radar': 'sectionRadar',
    'section-scores': 'paragraphHorizontalBar',
    'checklist-bar': 'checklistProgressBar',
    'severity-donut': 'severityDonut',
    'engine-sov': 'engineSovBar',
    'llm-indexing': 'llmIndexingBar',
    radar: 'dimensionRadar',
    competitor: 'competitorBar',
    'query-hit': 'queryHitDonut',
    'trend-line': 'trendLineArea',
    'kpi-grid': 'kpiSparkGrid',
    'summary-bar': 'summaryBar',
    bar: 'summaryBar',
    line: 'trendLineArea',
    doughnut: 'distributionDoughnut',
  };

  var reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cssVar(name, fallback) {
    if (typeof document === 'undefined') return fallback;
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function resolveKind(kindOrType) {
    if (!kindOrType) return 'summaryBar';
    if (ALIASES[kindOrType]) return ALIASES[kindOrType];
    return kindOrType;
  }

  function chartAnimationPreset(idx, fast) {
    if (reducedMotion) {
      return { duration: 0, delay: 0 };
    }
    return {
      duration: fast ? 500 : 900,
      easing: 'easeOutQuart',
      delay: fast ? 0 : (idx || 0) * 90,
      animateRotate: true,
      animateScale: true,
    };
  }

  function baseFont() {
    return {
      family: cssVar('--ngrs-font', '"Segoe UI", system-ui, sans-serif'),
      size: 12,
    };
  }

  function scaleOptions(type, cfg) {
    if (type === 'radar') {
      return {
        r: {
          min: 0,
          max: cfg.max || 100,
          ticks: { stepSize: 20, display: false },
          grid: { color: GRID },
          pointLabels: { font: { size: 11 }, color: MUTED },
        },
      };
    }
    if (type === 'polarArea') {
      return {
        r: {
          grid: { color: GRID },
          ticks: { display: false },
        },
      };
    }
    var horizontal = cfg.indexAxis === 'y';
    var scaleKey = horizontal ? 'x' : 'y';
    var catKey = horizontal ? 'y' : 'x';
    return {
      [catKey]: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: MUTED },
      },
      [scaleKey]: {
        beginAtZero: true,
        grid: { color: GRID, drawBorder: false },
        ticks: { font: { size: 11 }, color: MUTED },
      },
    };
  }

  function defaultOptions(type, cfg, idx) {
    var anim = chartAnimationPreset(idx, type === 'sparkline');
    var opts = {
      responsive: true,
      maintainAspectRatio: true,
      animation: anim,
      plugins: {
        legend: {
          display: cfg.showLegend !== false && (cfg.datasets || cfg.series),
          position: cfg.legendPosition || 'bottom',
          labels: { boxWidth: 6, padding: 16, font: { size: 11 }, color: MUTED },
        },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#1A1F26',
          bodyColor: '#647084',
          borderColor: '#E2E5EB',
          borderWidth: 1,
          cornerRadius: 8,
          boxPadding: 6,
          padding: 10,
        },
      },
      interaction: { mode: 'index', intersect: false },
    };
    if (type !== 'doughnut' && type !== 'polarArea') {
      opts.scales = scaleOptions(type, cfg);
    }
    return opts;
  }

  function colorsFor(n, alpha) {
    return Array.from({ length: n }, function (_, i) {
      var c = PALETTE[i % PALETTE.length];
      if (!alpha) return c;
      return c.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
    });
  }

  function buildRadarDataset(cfg) {
    var values = cfg.values || cfg.data || [];
    return {
      label: cfg.datasetLabel || '得分',
      data: values,
      borderColor: ACCENT,
      backgroundColor: ACCENT_SOFT,
      borderWidth: 2,
      pointRadius: 3,
    };
  }

  function buildBarDataset(cfg, kind) {
    var labels = cfg.labels || [];
    var values = cfg.values || cfg.data || [];
    var horizontal = kind.indexOf('Horizontal') >= 0 || cfg.indexAxis === 'y';
    var grouped = kind.indexOf('Grouped') >= 0 || kind === 'beforeAfterBar' || kind === 'competitorGroupedBar';
    var stacked = kind === 'severityStackedBar' || cfg.stacked;

    if (grouped && cfg.series && cfg.series.length) {
      return cfg.series.map(function (s, si) {
        return {
          label: s.label || '系列' + (si + 1),
          data: s.values || s.data || [],
          backgroundColor: PALETTE[si % PALETTE.length],
          borderRadius: 6,
          borderWidth: 0,
        };
      });
    }

    if (kind === 'beforeAfterBar') {
      var before = cfg.before || values;
      var after = cfg.after || cfg.values2 || [];
      return [
        { label: '优化前', data: before, backgroundColor: P2, borderRadius: 6 },
        { label: '优化后', data: after, backgroundColor: ACCENT, borderRadius: 6 },
      ];
    }

    if (kind === 'severityStackedBar') {
      var p0 = cfg.p0 || cfg.severity?.p0 || [];
      var p1 = cfg.p1 || cfg.severity?.p1 || [];
      var p2 = cfg.p2 || cfg.severity?.p2 || [];
      return [
        { label: 'P0', data: p0, backgroundColor: P0, borderRadius: 6, stack: 's' },
        { label: 'P1', data: p1, backgroundColor: P1, borderRadius: 6, stack: 's' },
        { label: 'P2', data: p2, backgroundColor: P2, borderRadius: 6, stack: 's' },
      ];
    }

    if (kind === 'gapWaterfallBar') {
      return [
        {
          label: cfg.datasetLabel || '差距',
          data: values,
          backgroundColor: values.map(function (v) {
            return v >= 0 ? ACCENT : P2;
          }),
          borderRadius: 6,
        },
      ];
    }

    var bg = colorsFor(values.length);
    if (kind === 'engineSovBar' || kind === 'competitorBar' || kind === 'summaryBar' || kind === 'llmIndexingBar') {
      bg = values.map(function (_, i) {
        return i === 0 ? ACCENT : PALETTE[(i + 1) % PALETTE.length];
      });
    }

    return [
      {
        label: cfg.datasetLabel || '数值',
        data: values,
        backgroundColor: bg,
        borderColor: bg,
        borderWidth: horizontal ? 0 : 1,
        borderRadius: 6,
      },
    ];
  }

  function buildLineDataset(cfg) {
    var values = cfg.values || cfg.data || [];
    return [
      {
        label: cfg.datasetLabel || '趋势',
        data: values,
        borderColor: ACCENT,
        backgroundColor: 'rgba(15,118,110,0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
    ];
  }

  function buildDoughnutDataset(cfg, kind) {
    var values = cfg.values || cfg.data || [];
    var labels = cfg.labels || [];
    var bg;
    if (kind === 'queryHitDonut') {
      bg = [HIT, MISS];
    } else if (kind === 'severityDonut') {
      bg = [P0, P1, P2].slice(0, values.length);
    } else {
      bg = colorsFor(values.length);
    }
    return [
      {
        data: values,
        backgroundColor: bg,
        borderWidth: 0,
      },
    ];
  }

  function chartConfigForKind(kind, cfg, idx) {
    var resolved = resolveKind(kind);
    var labels = cfg.labels || [];

    if (resolved === 'dimensionRadar' || resolved === 'sectionRadar') {
      return {
        type: 'radar',
        data: { labels: labels, datasets: [buildRadarDataset(cfg)] },
        options: defaultOptions('radar', cfg, idx),
      };
    }

    if (resolved === 'topicPolarArea') {
      return {
        type: 'polarArea',
        data: {
          labels: labels,
          datasets: [
            {
              data: cfg.values || cfg.data || [],
              backgroundColor: colorsFor(labels.length, 0.65),
            },
          ],
        },
        options: defaultOptions('polarArea', cfg, idx),
      };
    }

    if (
      resolved === 'keywordHorizontalBar' ||
      resolved === 'paragraphHorizontalBar'
    ) {
      var hOpts = defaultOptions('bar', { indexAxis: 'y' }, idx);
      hOpts.indexAxis = 'y';
      if (hOpts.scales) {
        hOpts.scales.x.grid = { color: GRID };
        hOpts.scales.y.grid = { display: false };
      }
      return {
        type: 'bar',
        data: { labels: labels, datasets: buildBarDataset(cfg, resolved) },
        options: hOpts,
      };
    }

    if (
      resolved === 'summaryBar' ||
      resolved === 'engineSovBar' ||
      resolved === 'llmIndexingBar' ||
      resolved === 'competitorBar' ||
      resolved === 'competitorGroupedBar' ||
      resolved === 'beforeAfterBar' ||
      resolved === 'severityStackedBar' ||
      resolved === 'gapWaterfallBar' ||
      resolved === 'channelGroupedBar'
    ) {
      var bOpts = defaultOptions('bar', cfg, idx);
      if (resolved === 'severityStackedBar') {
        bOpts.scales = bOpts.scales || {};
        bOpts.scales.x = bOpts.scales.x || {};
        bOpts.scales.x.stacked = true;
        bOpts.scales.y = bOpts.scales.y || {};
        bOpts.scales.y.stacked = true;
      }
      if (resolved === 'competitorGroupedBar' || resolved === 'channelGroupedBar') {
        bOpts.plugins.legend.display = true;
        bOpts.plugins.legend.position = 'top';
      }
      return {
        type: 'bar',
        data: { labels: labels, datasets: buildBarDataset(cfg, resolved) },
        options: bOpts,
      };
    }

    if (resolved === 'trendLineArea') {
      return {
        type: 'line',
        data: { labels: labels, datasets: buildLineDataset(cfg) },
        options: defaultOptions('line', cfg, idx),
      };
    }

    if (
      resolved === 'sovDoughnut' ||
      resolved === 'queryHitDonut' ||
      resolved === 'severityDonut' ||
      resolved === 'distributionDoughnut' ||
      resolved === 'intentDoughnut'
    ) {
      var dOpts = defaultOptions('doughnut', cfg, idx);
      dOpts.cutout = cfg.cutout || '62%';
      return {
        type: 'doughnut',
        data: { labels: labels, datasets: buildDoughnutDataset(cfg, resolved) },
        options: dOpts,
      };
    }

    return {
      type: 'bar',
      data: { labels: labels, datasets: buildBarDataset(cfg, 'summaryBar') },
      options: defaultOptions('bar', cfg, idx),
    };
  }

  function renderChecklistProgress(container, cfg) {
    var pass = cfg.pass ?? cfg.meta?.pass ?? 70;
    var warn = cfg.warn ?? cfg.meta?.warn ?? 20;
    var fail = cfg.fail ?? cfg.meta?.fail ?? 10;
    var total = pass + warn + fail || 100;
    container.innerHTML =
      '<div class="ngrs-progress">' +
      '<div class="ngrs-progress-seg ngrs-progress-pass" style="width:' +
      (pass / total) * 100 +
      '%"></div>' +
      '<div class="ngrs-progress-seg ngrs-progress-warn" style="width:' +
      (warn / total) * 100 +
      '%"></div>' +
      '<div class="ngrs-progress-seg ngrs-progress-fail" style="width:' +
      (fail / total) * 100 +
      '%"></div>' +
      '</div>' +
      '<div class="ngrs-progress-legend">' +
      '<span class="pass">通过 ' +
      pass +
      '%</span>' +
      '<span class="warn">警告 ' +
      warn +
      '%</span>' +
      '<span class="fail">失败 ' +
      fail +
      '%</span>' +
      '</div>';
  }

  function renderScoreGauge(container, score, max) {
    max = max || 100;
    var pct = Math.min(100, Math.max(0, (score / max) * 100));
    var circumference = 251.2;
    var offset = circumference - (pct / 100) * circumference;
    var warn = score < 60;
    container.innerHTML =
      '<div class="ngrs-gauge-wrap">' +
      '<div class="ngrs-gauge">' +
      '<svg viewBox="0 0 100 100"><circle class="ngrs-gauge-track" cx="50" cy="50" r="40"/>' +
      '<circle class="ngrs-gauge-fill' +
      (warn ? ' ngrs-gauge-warn' : '') +
      ' ngrs-animate" cx="50" cy="50" r="40" style="--ngrs-gauge-offset:' +
      offset +
      '"/></svg>' +
      '</div>' +
      '<div class="ngrs-gauge-center">' +
      '<span class="ngrs-gauge-num" data-countup="' +
      score +
      '">0</span>' +
      '<span class="ngrs-gauge-max">/' +
      max +
      '</span>' +
      '</div></div>';
    var numEl = container.querySelector('.ngrs-gauge-num');
    if (numEl) countUpKpi(numEl, score, 600);
  }

  function countUpKpi(el, target, durationMs) {
    if (!el || reducedMotion) {
      if (el) el.textContent = String(target);
      return;
    }
    durationMs = durationMs || 600;
    var start = 0;
    var t0 = null;
    var isFloat = String(target).indexOf('.') >= 0;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / durationMs);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = start + (Number(target) - start) * eased;
      el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = String(target);
    }
    requestAnimationFrame(step);
  }

  function createSparkline(canvas, values, idx) {
    if (!canvas || !values || !values.length) return null;
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: values.map(function (_, i) {
          return i;
        }),
        datasets: [
          {
            data: values,
            borderColor: ACCENT,
            borderWidth: 1.5,
            fill: false,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationPreset(idx, true),
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });
  }

  function createChart(kind, canvas, cfg, idx) {
    if (!canvas) return null;
    cfg = cfg || {};
    var resolved = resolveKind(kind || cfg.kind || cfg.type);
    return new Chart(canvas, chartConfigForKind(resolved, cfg, idx || 0));
  }

  function renderChartCard(container, cfg, idx, observer) {
    var kind = resolveKind(cfg.kind || cfg.type);
    var card = document.createElement('div');
    card.className = 'ngrs-chart-card';
    card.style.animationDelay = 0.06 * (idx + 1) + 's';

    var title = cfg.title || '图表';
    card.innerHTML = '<h3>' + title + '</h3><div class="ngrs-chart-body"></div>';
    var body = card.querySelector('.ngrs-chart-body');

    if (kind === 'checklistProgressBar') {
      renderChecklistProgress(body, cfg);
      container.appendChild(card);
      return { card: card, chart: null };
    }

    if (kind === 'scoreGauge') {
      var score = cfg.value ?? cfg.values?.[0] ?? cfg.score ?? 0;
      renderScoreGauge(body, score, cfg.max || 100);
      container.appendChild(card);
      return { card: card, chart: null };
    }

    var cid = cfg.id || 'ngrs-chart-' + idx;
    body.innerHTML = '<canvas id="' + cid + '"></canvas>';
    container.appendChild(card);

    var canvas = document.getElementById(cid);
    var init = function () {
      return createChart(kind, canvas, cfg, idx);
    };

    if (observer && canvas) {
      observer.observe(card);
      card._ngrsInit = init;
      return { card: card, chart: null, pending: true };
    }

    return { card: card, chart: init() };
  }

  function renderKpis(container, kpis, options) {
    options = options || {};
    kpis.forEach(function (k, i) {
      var d = document.createElement('div');
      d.className = 'ngrs-kpi';
      d.style.animationDelay = i * 0.06 + 's';
      var val = k.value ?? '';
      d.innerHTML =
        '<div class="ngrs-kpi-label">' +
        (k.label || '') +
        '</div>' +
        '<div class="ngrs-kpi-value" data-countup="' +
        val +
        '">' +
        (reducedMotion ? val : '0') +
        '</div>';
      if (k.sparkline && k.sparkline.length) {
        var sparkWrap = document.createElement('div');
        sparkWrap.className = 'ngrs-kpi-spark';
        var sparkCanvas = document.createElement('canvas');
        sparkWrap.appendChild(sparkCanvas);
        d.appendChild(sparkWrap);
        if (options.deferSpark) {
          d._sparkInit = function () {
            createSparkline(sparkCanvas, k.sparkline, i);
          };
        } else {
          createSparkline(sparkCanvas, k.sparkline, i);
        }
      }
      container.appendChild(d);
      var valEl = d.querySelector('.ngrs-kpi-value');
      if (valEl && !reducedMotion && String(val).match(/^[\d.]+/)) {
        countUpKpi(valEl, parseFloat(String(val)), 600);
      } else if (valEl) {
        valEl.textContent = val;
      }
    });
  }

  function renderActions(container, actions) {
    actions.forEach(function (a) {
      var li = document.createElement('li');
      var p = (a.priority || 'P1').toUpperCase();
      var cls =
        p === 'P0' ? 'ngrs-priority-p0' : p === 'P2' ? 'ngrs-priority-p2' : 'ngrs-priority-p1';
      li.innerHTML =
        '<span class="ngrs-priority ' +
        cls +
        '">' +
        p +
        '</span>' +
        (a.text || a);
      container.appendChild(li);
    });
  }

  function applyThemeOverride(override) {
    if (!override || typeof document === 'undefined') return;
    var root = document.documentElement;
    if (override.accent) {
      root.style.setProperty('--ngrs-accent', override.accent);
      ACCENT = override.accent;
    }
    if (override.mode === 'dark') {
      root.style.setProperty('--ngrs-bg', '#12151A');
      root.style.setProperty('--ngrs-card', '#1C2128');
      root.style.setProperty('--ngrs-text', '#E8EAED');
    } else if (override.mode === 'light') {
      root.style.setProperty('--ngrs-bg', '#F0F1F4');
      root.style.setProperty('--ngrs-card', '#FFFFFF');
      root.style.setProperty('--ngrs-text', '#1A1F26');
    }
  }

  function createLazyChartObserver(callback) {
    if (typeof IntersectionObserver === 'undefined') return null;
    return new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (el._ngrsInit && !el._ngrsDone) {
            el._ngrsDone = true;
            var chart = el._ngrsInit();
            if (callback) callback(el, chart);
          }
          if (el._sparkInit && !el._sparkDone) {
            el._sparkDone = true;
            el._sparkInit();
          }
        });
      },
      { rootMargin: '40px', threshold: 0.1 },
    );
  }

  function monitorDataToCharts(data) {
    var charts = [];
    var llm = data.llm_coverage;
    var models = (llm && llm.models) || [];

    if (models.length) {
      charts.push({
        kind: 'llmIndexingBar',
        id: 'chart-llm-indexing',
        title: '主流大模型收录',
        labels: models.map(function (m) {
          return m.name || m.id;
        }),
        values: models.map(function (m) {
          return m.indexing_score ?? m.score ?? 0;
        }),
        meta: {
          statuses: models.map(function (m) {
            return m.indexing_status || 'unknown';
          }),
        },
      });
    } else {
      var engines = data.engines || [];
      charts.push({
        kind: 'engineSovBar',
        id: 'chart-sov',
        title: '引擎 SOV',
        labels: engines.map(function (e) {
          return e.name || e.id;
        }),
        values: engines.map(function (e) {
          return e.sov ?? e.score ?? 0;
        }),
      });
    }

    var dims = data.dimensions || { technical: 0, citability: 0, schema: 0, entity: 0 };
    charts.push({
      kind: 'dimensionRadar',
      id: 'chart-radar',
      title: '四维雷达',
      labels: ['Technical', 'Citability', 'Schema', 'Entity'],
      values: [dims.technical, dims.citability, dims.schema, dims.entity],
    });

    var comps = data.competitors || [];
    charts.push({
      kind: 'competitorBar',
      id: 'chart-competitors',
      title: '竞品对比',
      labels: comps.map(function (c) {
        return c.name;
      }),
      values: comps.map(function (c) {
        return c.score ?? 0;
      }),
    });

    var queries = data.queries || [];
    var hit = queries.filter(function (q) {
      return q.mentioned;
    }).length;
    var miss = queries.length - hit;
    charts.push({
      kind: 'queryHitDonut',
      id: 'chart-queries',
      title: '问句命中',
      labels: ['命中', '未命中'],
      values: [hit, miss],
    });

    return charts;
  }

  function renderReport(data, options) {
    options = options || {};
    var root = options.root || document;

    if (data.themeOverride) applyThemeOverride(data.themeOverride);

    var titleEl = root.querySelector('[data-ngrs-title]');
    var subEl = root.querySelector('[data-ngrs-subtitle]');
    var badgeEl = root.querySelector('[data-ngrs-badge]');
    if (titleEl && data.title) titleEl.textContent = data.title;
    if (subEl && data.subtitle) subEl.textContent = data.subtitle;
    if (badgeEl && data.reportType) badgeEl.textContent = data.reportType;

    var gaugeEl = root.querySelector('[data-ngrs-header-gauge]');
    if (gaugeEl && data.score != null) {
      renderScoreGauge(gaugeEl, data.score, 100);
    }

    var kpiGrid = root.querySelector('[data-ngrs-kpi-grid]');
    if (kpiGrid) {
      var kpis = data.kpis || [];
      if (data.score != null && !kpis.length) {
        kpis = [{ label: '综合分', value: data.score }];
      }
      kpiGrid.innerHTML = '';
      renderKpis(kpiGrid, kpis, { deferSpark: false });
    }

    var chartGrid = root.querySelector('[data-ngrs-chart-grid]');
    if (chartGrid) {
      chartGrid.innerHTML = '';
      var charts = data.charts || [];
      var observer = options.lazyCharts ? createLazyChartObserver() : null;
      charts.forEach(function (cfg, idx) {
        renderChartCard(chartGrid, cfg, idx, observer);
      });
    }

    var secRoot = root.querySelector('[data-ngrs-sections]');
    if (secRoot && data.sections) {
      secRoot.innerHTML = '';
      data.sections.forEach(function (sec, i) {
        var block = document.createElement('div');
        block.className = 'ngrs-section';
        block.style.animationDelay = 0.08 * (i + 1) + 's';
        block.innerHTML =
          '<h2>' + (sec.heading || '') + '</h2>' + (sec.html || sec.body || '');
        secRoot.appendChild(block);
      });
    }

    var actionList = root.querySelector('[data-ngrs-action-list]');
    if (actionList && data.actions) {
      actionList.innerHTML = '';
      renderActions(actionList, data.actions);
    }

    var footerEl = root.querySelector('[data-ngrs-footer-time]');
    if (footerEl) {
      footerEl.textContent = data.generatedAt || new Date().toISOString().slice(0, 10);
    }
  }

  var NGRS = {
    version: 1,
    palette: PALETTE,
    aliases: ALIASES,
    resolveKind: resolveKind,
    chartAnimationPreset: chartAnimationPreset,
    countUpKpi: countUpKpi,
    renderScoreGauge: renderScoreGauge,
    renderChecklistProgress: renderChecklistProgress,
    createChart: createChart,
    createSparkline: createSparkline,
    renderChartCard: renderChartCard,
    renderKpis: renderKpis,
    renderActions: renderActions,
    renderReport: renderReport,
    monitorDataToCharts: monitorDataToCharts,
    createLazyChartObserver: createLazyChartObserver,
    applyThemeOverride: applyThemeOverride,
  };

  global.NGRS = NGRS;
})(typeof window !== 'undefined' ? window : globalThis);
