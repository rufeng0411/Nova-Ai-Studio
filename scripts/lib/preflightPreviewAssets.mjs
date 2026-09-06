/** PD-SAAS-FORK: Preflight preview URLs — rich OD / PPT canvas / style HTML + ppt-master PNGs */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OD_PREVIEW_DIR = path.join(REPO_ROOT, 'ui/public/vendor/preflight/od');
const PPT_CANVAS_PREVIEW_DIR = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/canvas');
const PPT_STYLE_PREVIEW_DIR = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/styles');
const PPT_MASTER_ROOT = path.join(REPO_ROOT, 'skills/vendor/ppt-master');

export const OD_PREVIEW_STATIC_PREFIX = '/api/launch/static/open-design';
export const PPT_PREVIEW_STATIC_PREFIX = '/api/launch/static/ppt-master';
export const PPT_CANVAS_STATIC_PREFIX = '/api/launch/static/ppt-canvas';
export const PPT_STYLE_HTML_STATIC_PREFIX = '/api/launch/static/ppt-style-html';

/** ppt-master style id → ai-image-comparison/rendering/*.png */
export const PPT_STYLE_PREVIEW_FILES = {
  'swiss-minimal': 'minimalist-swiss.png',
  'soft-rounded': 'flat.png',
  glassmorphism: 'glassmorphism.png',
  'dark-tech': 'digital-dashboard.png',
  blueprint: 'blueprint.png',
  editorial: 'editorial.png',
  'photo-editorial': 'corporate-photo.png',
  'data-journalism': 'digital-dashboard.png',
  brutalist: 'screen-print.png',
  memphis: 'vintage-poster.png',
  zine: 'screen-print.png',
  'vintage-poster': 'vintage-poster.png',
  'paper-cut': 'paper-cut.png',
  'sketch-notes': 'sketch-notes.png',
  'ink-notes': 'ink-notes.png',
  chalkboard: 'chalkboard.png',
  'ink-wash': 'watercolor.png',
  'pixel-art': 'pixel-art.png',
};

/** ppt-master mode id → ai-image-comparison/type/*.png */
export const PPT_MODE_PREVIEW_FILES = {
  pyramid: 'pyramid.png',
  narrative: 'timeline.png',
  instructional: 'framework.png',
  showcase: 'scene.png',
  briefing: 'infographic.png',
};

const CANVAS_SPECS = {
  ppt169: { w: 1280, h: 720, label: '16:9 演示' },
  ppt43: { w: 1024, h: 768, label: '4:3 演示' },
  wechat: { w: 900, h: 383, label: '公众号头图' },
  xiaohongshu: { w: 620, h: 830, label: '小红书图文' },
  moments: { w: 1080, h: 1080, label: '社交方图' },
  story: { w: 540, h: 960, label: '竖屏 Story' },
  banner: { w: 1280, h: 720, label: '横幅 Banner' },
  a4: { w: 620, h: 877, label: 'A4 文档' },
};

function luminance(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function previewShell({ title, body, width = 1280, height = 800, bg = '#0b0c10' }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
  body { font-family: Inter, "Segoe UI", system-ui, sans-serif; background: ${bg}; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function resolveOdPreviewLayout({ category, colors, id }) {
  const cat = String(category || '').toLowerCase();
  const slug = String(id || '').toLowerCase();
  const dark = colors?.[1] ?? '#0f1115';
  const light = colors?.[2] ?? '#f7f8f8';
  const darkFirst = luminance(dark) < 0.22 && luminance(light) > 0.72;

  if (/ai\s*&\s*llm|artificial intelligence/.test(cat)) return 'ai-terminal';
  if (/editorial|creative|artistic|bold|expressive|themed|automotive|luxury|design/.test(cat)) {
    return 'editorial';
  }
  if (/e-?commerce|retail|fintech|crypto|media|consumer/.test(cat)) return 'marketing';
  if (/developer|backend|data|tools/.test(cat)) return 'dev-tools';
  if (/poster|social|banner|layout/.test(cat) || /poster|social|banner|zine/.test(slug)) {
    return 'poster';
  }
  if (darkFirst) return 'saas-dark';
  return 'saas-light';
}

function swatches(colors) {
  return colors
    .map((c) => `<span style="flex:1;height:5px;border-radius:2px;background:${c}"></span>`)
    .join('');
}

function buildSaasDark({ id, label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:${dark};color:${light};display:flex;flex-direction:column;">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:18px 28px;border-bottom:1px solid ${border}55;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="width:22px;height:22px;border-radius:6px;background:${accent};display:inline-block;"></span>
      <strong style="font-size:15px;letter-spacing:-0.03em;">${esc(label)}</strong>
    </div>
    <nav style="display:flex;gap:18px;font-size:11px;color:${muted};">
      <span>产品</span><span>定价</span><span>文档</span><span style="color:${light}">登录</span>
    </nav>
  </header>
  <div style="flex:1;display:grid;grid-template-columns:220px 1fr;min-height:0;">
    <aside style="padding:20px 16px;border-right:1px solid ${border}44;">
      ${['概览', '项目', '分析', '设置'].map((t, i) => `
        <div style="padding:8px 10px;margin-bottom:4px;border-radius:8px;font-size:11px;color:${i === 1 ? light : muted};background:${i === 1 ? `${accent}33` : 'transparent'};border:1px solid ${i === 1 ? `${accent}66` : 'transparent'};">${t}</div>`).join('')}
    </aside>
    <main style="padding:28px 32px;display:flex;flex-direction:column;gap:18px;">
      <div>
        <div style="font-size:10px;color:${accent};text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px;">${esc(tagline || 'Productivity & SaaS')}</div>
        <h1 style="font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-0.04em;margin-bottom:10px;">更快完成复杂协作</h1>
        <p style="font-size:13px;line-height:1.55;color:${muted};max-width:42ch;">${esc(tagline || '深色界面 · 精确层级 · 品牌强调色')}</p>
      </div>
      <div style="display:flex;gap:10px;">
        <span style="background:${accent};color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:600;">开始使用</span>
        <span style="border:1px solid ${border}88;color:${light};padding:10px 18px;border-radius:8px;font-size:12px;">查看演示</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px;">
        ${['活跃项目', '本周任务', '完成率'].map((t, i) => `
          <div style="background:${border};border:1px solid ${muted}33;border-radius:12px;padding:14px;">
            <div style="font-size:10px;color:${muted};margin-bottom:8px;">${t}</div>
            <div style="font-size:22px;font-weight:700;color:${i === 2 ? accent : light};">${['128', '46', '94%'][i]}</div>
          </div>`).join('')}
      </div>
      <div style="flex:1;background:linear-gradient(180deg,${border} 0%,${dark} 100%);border:1px solid ${muted}33;border-radius:14px;padding:16px;display:grid;grid-template-columns:1.2fr 1fr;gap:14px;min-height:180px;">
        <div style="background:${dark};border-radius:10px;border:1px solid ${muted}22;padding:12px;">
          <div style="height:8px;width:55%;background:${accent};border-radius:4px;margin-bottom:10px;"></div>
          <div style="height:6px;width:88%;background:${muted};opacity:0.35;border-radius:3px;margin-bottom:6px;"></div>
          <div style="height:6px;width:72%;background:${muted};opacity:0.25;border-radius:3px;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${[0, 1, 2, 3].map(() => `<div style="background:${dark};border-radius:8px;border:1px solid ${muted}22;"></div>`).join('')}
        </div>
      </div>
    </main>
  </div>
  <div style="display:flex;gap:4px;padding:10px 28px 14px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: dark, height: 800 });
}

function buildSaasLight({ id, label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:${light};color:${dark};">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:16px 32px;border-bottom:1px solid ${border};background:#fff;">
    <strong style="font-size:15px;color:${dark};">${esc(label)}</strong>
    <div style="display:flex;gap:16px;font-size:11px;color:${muted};align-items:center;">
      <span>功能</span><span>客户</span><span style="background:${accent};color:#fff;padding:7px 14px;border-radius:999px;font-weight:600;">免费试用</span>
    </div>
  </header>
  <section style="padding:40px 32px 24px;display:grid;grid-template-columns:1.1fr 0.9fr;gap:28px;align-items:center;">
    <div>
      <div style="display:inline-block;background:${accent}18;color:${accent};padding:5px 10px;border-radius:999px;font-size:10px;font-weight:600;margin-bottom:14px;">${esc(tagline?.slice(0, 24) || 'Modern & Minimal')}</div>
      <h1 style="font-size:38px;line-height:1.06;font-weight:800;letter-spacing:-0.04em;color:${dark};margin-bottom:12px;">${esc(label)}<br/>官网首页</h1>
      <p style="font-size:13px;line-height:1.6;color:${muted};max-width:38ch;margin-bottom:18px;">浅色 SaaS 着陆页：大标题、双 CTA、右侧产品截图区，风格差异一眼可辨。</p>
      <div style="display:flex;gap:10px;">
        <span style="background:${dark};color:${light};padding:10px 18px;border-radius:10px;font-size:12px;font-weight:600;">立即开始</span>
        <span style="border:1px solid ${border};padding:10px 18px;border-radius:10px;font-size:12px;">预约演示</span>
      </div>
    </div>
    <div style="background:#fff;border:1px solid ${border};border-radius:16px;padding:14px;box-shadow:0 24px 60px ${dark}14;">
      <div style="height:10px;width:40%;background:${accent};border-radius:5px;margin-bottom:12px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="height:72px;background:${border};border-radius:10px;"></div>
        <div style="height:72px;background:${accent}22;border-radius:10px;border:1px solid ${accent}44;"></div>
      </div>
      <div style="height:120px;background:linear-gradient(135deg,${accent}18,${border});border-radius:12px;border:1px solid ${border};"></div>
    </div>
  </section>
  <section style="padding:8px 32px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
    ${['极速', '安全', '协作', '扩展'].map((t) => `
      <div style="background:#fff;border:1px solid ${border};border-radius:12px;padding:14px;">
        <div style="width:28px;height:28px;border-radius:8px;background:${accent};margin-bottom:8px;"></div>
        <div style="font-size:12px;font-weight:700;color:${dark};">${t}</div>
        <div style="font-size:10px;color:${muted};margin-top:4px;">特性说明</div>
      </div>`).join('')}
  </section>
  <div style="display:flex;gap:4px;padding:0 32px 16px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: light, height: 800 });
}

function buildAiTerminal({ label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:radial-gradient(circle at 20% 0%, ${accent}33 0%, transparent 45%), ${dark};color:${light};padding:24px 28px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
    <strong style="font-size:15px;">${esc(label)}</strong>
    <span style="font-size:10px;color:${muted};border:1px solid ${border}66;padding:4px 8px;border-radius:999px;">AI · LLM</span>
  </div>
  <div style="max-width:760px;margin:0 auto;">
    <h1 style="font-size:32px;text-align:center;font-weight:700;letter-spacing:-0.03em;margin-bottom:18px;">向 AI 提问，立刻得到答案</h1>
    <div style="background:${border};border:1px solid ${accent}55;border-radius:14px;padding:14px 16px;display:flex;gap:10px;align-items:center;margin-bottom:18px;box-shadow:0 0 0 1px ${accent}22, 0 20px 50px ${dark};">
      <span style="flex:1;font-size:12px;color:${muted};">搜索知识库、代码与文档…</span>
      <span style="background:${accent};color:#fff;padding:8px 14px;border-radius:10px;font-size:11px;font-weight:600;">发送</span>
    </div>
    <div style="display:grid;gap:10px;">
      ${['总结这份报告的核心结论', '对比三家竞品定价策略', '生成一页路演提纲'].map((q, i) => `
        <div style="background:${i === 0 ? `${accent}22` : `${border}88`};border:1px solid ${i === 0 ? accent : `${muted}33`};border-radius:12px;padding:12px 14px;font-size:11px;color:${i === 0 ? light : muted};">${esc(q)}</div>`).join('')}
    </div>
    <div style="margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:${border};border-radius:12px;padding:14px;border:1px solid ${muted}33;">
        <div style="font-size:10px;color:${accent};margin-bottom:8px;">回答片段</div>
        <div style="height:6px;width:92%;background:${muted};opacity:0.35;border-radius:3px;margin-bottom:6px;"></div>
        <div style="height:6px;width:78%;background:${muted};opacity:0.25;border-radius:3px;"></div>
      </div>
      <div style="background:${border};border-radius:12px;padding:14px;border:1px solid ${muted}33;">
        <div style="font-size:10px;color:${accent};margin-bottom:8px;">引用来源</div>
        <div style="font-size:10px;color:${muted};line-height:1.5;">${esc(tagline || '检索增强 · 可追溯')}</div>
      </div>
    </div>
  </div>
  <div style="display:flex;gap:4px;padding-top:18px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: dark, height: 800 });
}

function buildMarketing({ label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:${light};color:${dark};">
  <div style="background:linear-gradient(120deg,${dark} 0%, ${accent} 100%);color:#fff;padding:28px 32px 36px;">
    <div style="font-size:11px;opacity:0.75;margin-bottom:10px;">${esc(tagline || 'E-Commerce · Retail')}</div>
    <h1 style="font-size:36px;font-weight:800;letter-spacing:-0.03em;margin-bottom:8px;">${esc(label)}</h1>
    <p style="font-size:13px;opacity:0.88;max-width:36ch;">电商/营销风：大图促销区 + 商品卡片栅格，和 SaaS 工作台完全不同。</p>
  </div>
  <div style="padding:20px 32px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
    ${['新品上市', '限时优惠', '会员专享'].map((t, i) => `
      <div style="background:#fff;border:1px solid ${border};border-radius:14px;overflow:hidden;box-shadow:0 8px 24px ${dark}10;">
        <div style="height:96px;background:linear-gradient(${i * 40}deg, ${accent}${i === 0 ? '' : 'cc'}, ${border});"></div>
        <div style="padding:12px;">
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">${t}</div>
          <div style="font-size:18px;font-weight:800;color:${accent};">¥${[299, 199, 99][i]}</div>
        </div>
      </div>`).join('')}
  </div>
  <div style="margin:0 32px;background:${border};border-radius:14px;padding:16px;display:flex;gap:14px;align-items:center;">
    <div style="width:80px;height:80px;border-radius:12px;background:${accent};flex-shrink:0;"></div>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">品牌故事 / 转化条</div>
      <div style="font-size:11px;color:${muted};">双列图文 + 价格 CTA，适合零售与 fintech 落地页。</div>
    </div>
    <span style="background:${accent};color:#fff;padding:10px 16px;border-radius:10px;font-size:11px;font-weight:600;">立即购买</span>
  </div>
  <div style="display:flex;gap:4px;padding:16px 32px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: light, height: 800 });
}

function buildDevTools({ label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:${dark};color:${light};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
  <div style="padding:14px 18px;border-bottom:1px solid ${border};display:flex;justify-content:space-between;align-items:center;">
    <strong style="font-size:13px;font-family:Inter,sans-serif;">${esc(label)}</strong>
    <span style="font-size:10px;color:${accent};">dev tools</span>
  </div>
  <div style="display:grid;grid-template-columns:260px 1fr;min-height:740px;">
    <aside style="border-right:1px solid ${border};padding:14px;font-size:10px;color:${muted};">
      <div style="color:${accent};margin-bottom:10px;">$ deploy --prod</div>
      <div style="margin-bottom:6px;">✓ build completed</div>
      <div style="margin-bottom:6px;">✓ tests passed</div>
      <div style="margin-bottom:6px;color:${light};">→ release v2.4.0</div>
    </aside>
    <main style="padding:16px;">
      <div style="background:#000;border:1px solid ${border};border-radius:10px;padding:14px;font-size:11px;line-height:1.6;">
        <div style="color:${accent};">import</div> <span style="color:${light};">{ createClient }</span> <span style="color:${muted};">from</span> <span style="color:#a5d6ff;">'@sdk/core'</span><br/><br/>
        <span style="color:${muted};">// ${esc(tagline || 'Developer-first docs & CLI')}</span><br/>
        <span style="color:#c586c0;">const</span> client = <span style="color:#dcdcaa;">createClient</span>({ apiKey: <span style="color:#ce9178;">'…'</span> })
      </div>
      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:Inter,sans-serif;">
        <div style="background:${border};border-radius:10px;padding:12px;font-size:10px;">API 参考</div>
        <div style="background:${border};border-radius:10px;padding:12px;font-size:10px;">CLI 指南</div>
      </div>
    </main>
  </div>
  <div style="display:flex;gap:4px;padding:10px 18px;font-family:Inter,sans-serif;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: dark, height: 800 });
}

function buildEditorial({ label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:${light};color:${dark};">
  <header style="padding:22px 32px;border-bottom:3px solid ${dark};display:flex;justify-content:space-between;align-items:baseline;">
    <h1 style="font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:-0.02em;">${esc(label)}</h1>
    <span style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${muted};">Editorial</span>
  </header>
  <div style="padding:24px 32px;display:grid;grid-template-columns:1.3fr 0.7fr;gap:24px;">
    <article>
      <div style="font-size:11px;color:${accent};font-weight:700;margin-bottom:8px;">封面专题</div>
      <h2 style="font-size:34px;line-height:1.08;font-family:Georgia,serif;margin-bottom:12px;">${esc(tagline || '杂志式排版与衬线标题')}</h2>
      <p style="font-size:13px;line-height:1.7;color:${muted};margin-bottom:16px;">大字号导语 + 多栏正文 + 侧边引语，适合品牌叙事、艺术、汽车等风格站。</p>
      <div style="columns:2;gap:18px;font-size:11px;line-height:1.65;color:${muted};">
        <p style="margin-bottom:10px;">第一段正文占位，展示分栏阅读体验。</p>
        <p>第二段正文占位，强调 editorial 与其他模板的差异。</p>
      </div>
    </article>
    <aside>
      <div style="height:200px;background:linear-gradient(180deg,${accent},${dark});border-radius:4px;margin-bottom:14px;"></div>
      <div style="border-left:4px solid ${accent};padding-left:12px;font-family:Georgia,serif;font-size:16px;line-height:1.4;color:${dark};">“引语块让气质立刻不同。”</div>
    </aside>
  </div>
  <div style="display:flex;gap:4px;padding:0 32px 16px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: light, height: 800 });
}

function buildPoster({ label, colors, tagline }) {
  const [accent, dark, light, muted, border] = colors;
  const body = `
<div style="min-height:800px;background:${dark};display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="width:420px;min-height:620px;background:linear-gradient(165deg,${accent} 0%, ${dark} 55%, ${border} 100%);border-radius:18px;padding:28px 24px;color:#fff;box-shadow:0 30px 80px #0008;display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.8;margin-bottom:16px;">Poster · Social</div>
      <h1 style="font-size:34px;line-height:1.05;font-weight:900;letter-spacing:-0.03em;margin-bottom:12px;">${esc(label)}</h1>
      <p style="font-size:13px;line-height:1.55;opacity:0.88;">${esc(tagline || '竖版海报 / 社媒封面预览')}</p>
    </div>
    <div style="background:#fff2;border-radius:14px;padding:16px;backdrop-filter:blur(8px);">
      <div style="font-size:22px;font-weight:800;margin-bottom:6px;">NEW</div>
      <div style="font-size:11px;opacity:0.85;">扫码了解更多 · 限时活动</div>
    </div>
  </div>
  <div style="position:absolute;bottom:12px;left:24px;right:24px;display:flex;gap:4px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, bg: dark, height: 800 });
}

const OD_LAYOUT_BUILDERS = {
  'saas-dark': buildSaasDark,
  'saas-light': buildSaasLight,
  'ai-terminal': buildAiTerminal,
  marketing: buildMarketing,
  'dev-tools': buildDevTools,
  editorial: buildEditorial,
  poster: buildPoster,
};

export function buildOdPreviewHtml({ id, label, colors, category, tagline }) {
  const layout = resolveOdPreviewLayout({ category, colors, id });
  const builder = OD_LAYOUT_BUILDERS[layout] ?? buildSaasLight;
  return builder({ id, label, colors, category, tagline });
}

export function buildPptCanvasPreviewHtml({ id, label, colors, use }) {
  const spec = CANVAS_SPECS[id] ?? { w: 1280, h: 720, label: 'Canvas' };
  const [accent, dark, light, muted, border] = colors;
  const isVertical = spec.h > spec.w;
  const isWideBanner = id === 'wechat' || id === 'banner';
  const isSlide = id === 'ppt169' || id === 'ppt43';

  let inner = '';
  if (isSlide) {
    inner = `
      <div style="height:100%;display:flex;flex-direction:column;padding:28px 32px;background:linear-gradient(135deg,${light} 0%,#fff 100%);">
        <div style="font-size:11px;color:${accent};font-weight:700;margin-bottom:10px;">${esc(spec.label)}</div>
        <h1 style="font-size:${id === 'ppt43' ? '28px' : '34px'};color:${dark};font-weight:800;line-height:1.1;margin-bottom:14px;">${esc(label)}</h1>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1;">
          <div>
            ${['要点一：结论先行', '要点二：数据支撑', '要点三：行动建议'].map((t) => `
              <div style="display:flex;gap:8px;margin-bottom:10px;font-size:12px;color:${muted};">
                <span style="width:8px;height:8px;border-radius:50%;background:${accent};margin-top:5px;flex-shrink:0;"></span>${t}
              </div>`).join('')}
          </div>
          <div style="background:${border};border-radius:12px;border:1px solid ${muted}33;display:flex;align-items:flex-end;padding:12px;gap:6px;">
            ${[40, 65, 50, 80, 55].map((h) => `<div style="flex:1;height:${h}%;background:${accent};border-radius:4px 4px 0 0;opacity:0.85;"></div>`).join('')}
          </div>
        </div>
      </div>`;
  } else if (isVertical) {
    inner = `
      <div style="height:100%;padding:22px 20px;background:linear-gradient(180deg,${accent} 0%, ${dark} 100%);color:#fff;display:flex;flex-direction:column;">
        <div style="font-size:10px;opacity:0.75;margin-bottom:12px;">${esc(spec.label)}</div>
        <h1 style="font-size:28px;font-weight:900;line-height:1.08;margin-bottom:10px;">${esc(label)}</h1>
        <p style="font-size:12px;line-height:1.55;opacity:0.88;margin-bottom:auto;">${esc(use || '竖版图文 · 封面种草')}</p>
        <div style="height:180px;background:#fff2;border-radius:14px;margin:16px 0;"></div>
        <div style="font-size:11px;opacity:0.8;"># 标签 · 互动引导</div>
      </div>`;
  } else if (isWideBanner) {
    inner = `
      <div style="height:100%;display:grid;grid-template-columns:1.1fr 0.9fr;background:${dark};color:#fff;">
        <div style="padding:24px 28px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:10px;color:${accent};margin-bottom:8px;">${esc(spec.label)}</div>
          <h1 style="font-size:26px;font-weight:800;line-height:1.15;margin-bottom:8px;">${esc(label)}</h1>
          <p style="font-size:12px;opacity:0.82;">${esc(use || '横幅 / 头图')}</p>
        </div>
        <div style="background:linear-gradient(135deg,${accent},${border});"></div>
      </div>`;
  } else {
    inner = `
      <div style="height:100%;padding:24px;background:${light};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <div style="width:72%;aspect-ratio:1;background:linear-gradient(135deg,${accent},${dark});border-radius:16px;margin-bottom:14px;"></div>
        <div style="font-size:14px;font-weight:700;color:${dark};">${esc(label)}</div>
        <div style="font-size:11px;color:${muted};margin-top:6px;">${esc(spec.label)}</div>
      </div>`;
  }

  const frameW = Math.min(spec.w, 1280);
  const frameH = Math.min(spec.h, isVertical ? 960 : 720);
  const body = `
<div style="width:1280px;height:800px;background:${dark};display:flex;align-items:center;justify-content:center;position:relative;">
  <div style="width:${frameW}px;height:${frameH}px;border-radius:${isSlide ? '8px' : '14px'};overflow:hidden;box-shadow:0 24px 60px #0006;border:2px solid ${accent};">
    ${inner}
  </div>
  <div style="position:absolute;bottom:14px;left:24px;right:24px;display:flex;gap:4px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, width: 1280, height: 800, bg: dark });
}

export function buildPptStylePreviewHtml({ id, label, colors, group }) {
  const [accent, dark, light, muted, border] = colors;
  const styleHints = {
    'swiss-minimal': { bg: light, title: 'SWISS', grid: true, serif: false },
    glassmorphism: { bg: `linear-gradient(135deg, ${dark}, ${accent}88)`, title: 'GLASS', grid: false, serif: false },
    brutalist: { bg: '#fff', title: 'BRUTAL', grid: true, serif: false, hard: true },
    editorial: { bg: light, title: label, grid: false, serif: true },
    chalkboard: { bg: dark, title: label, grid: false, serif: false },
    'pixel-art': { bg: dark, title: 'PIXEL', grid: true, serif: false, pixel: true },
  };
  const hint = styleHints[id] ?? { bg: light, title: label.slice(0, 12), grid: false, serif: false };
  const titleFont = hint.serif ? 'Georgia,serif' : 'Inter,sans-serif';
  const body = `
<div style="width:1280px;height:720px;background:${hint.bg};padding:28px 32px;color:${hint.serif ? dark : (luminance(dark) < 0.3 ? light : dark)};">
  <div style="font-size:10px;opacity:0.65;margin-bottom:8px;">${esc(group || 'Visual Style')} · ${esc(id)}</div>
  <h1 style="font-family:${titleFont};font-size:42px;font-weight:${hint.hard ? '900' : '700'};letter-spacing:${hint.hard ? '0.06em' : '-0.03em'};margin-bottom:18px;text-transform:${hint.hard ? 'uppercase' : 'none'};">${esc(hint.title)}</h1>
  <div style="display:grid;grid-template-columns:${hint.grid ? 'repeat(3,1fr)' : '1.2fr 0.8fr'};gap:16px;height:520px;">
    ${hint.grid
    ? [0, 1, 2].map((i) => `
        <div style="background:${hint.pixel ? accent : border};border:${hint.hard ? `4px solid ${dark}` : `1px solid ${muted}33`};border-radius:${hint.hard ? '0' : '12px'};padding:16px;">
          <div style="height:120px;background:${accent};opacity:${0.5 + i * 0.15};margin-bottom:12px;${hint.pixel ? 'image-rendering:pixelated;' : ''}"></div>
          <div style="font-size:12px;font-weight:700;">幻灯 ${i + 1}</div>
        </div>`).join('')
    : `
        <div style="background:${border};border-radius:14px;padding:18px;border:1px solid ${muted}33;">
          <div style="font-size:13px;line-height:1.6;opacity:0.85;">${esc(label)} 风格预览：版式、字体与装饰语言与极简 wireframe 不同。</div>
          <div style="margin-top:16px;height:8px;width:70%;background:${accent};border-radius:4px;"></div>
        </div>
        <div style="background:linear-gradient(180deg,${accent},${dark});border-radius:14px;"></div>`}
  </div>
  <div style="display:flex;gap:4px;margin-top:14px;">${swatches(colors)}</div>
</div>`;
  return previewShell({ title: label, body, width: 1280, height: 720, bg: typeof hint.bg === 'string' && hint.bg.startsWith('linear') ? dark : hint.bg });
}

export function odPreviewHtmlPath(id) {
  return path.join(OD_PREVIEW_DIR, `${id}.html`);
}

export function pptCanvasPreviewHtmlPath(id) {
  return path.join(PPT_CANVAS_PREVIEW_DIR, `${id}.html`);
}

export function pptStylePreviewHtmlPath(id) {
  return path.join(PPT_STYLE_PREVIEW_DIR, `${id}.html`);
}

export function odPreviewPageUrl(id) {
  return `${OD_PREVIEW_STATIC_PREFIX}/${encodeURIComponent(id)}.html`;
}

export function pptCanvasPreviewPageUrl(id) {
  return `${PPT_CANVAS_STATIC_PREFIX}/${encodeURIComponent(id)}.html`;
}

export function pptStylePreviewPageUrl(id) {
  return `${PPT_STYLE_HTML_STATIC_PREFIX}/${encodeURIComponent(id)}.html`;
}

export function resolvePptStylePreviewImageUrl(styleId) {
  const file = PPT_STYLE_PREVIEW_FILES[styleId] ?? 'vector-illustration.png';
  const abs = path.join(PPT_MASTER_ROOT, 'references/ai-image-comparison/rendering', file);
  if (!existsSync(abs)) return undefined;
  return `${PPT_PREVIEW_STATIC_PREFIX}/references/ai-image-comparison/rendering/${file}`;
}

export function resolvePptModePreviewImageUrl(modeId) {
  const file = PPT_MODE_PREVIEW_FILES[modeId] ?? 'framework.png';
  const abs = path.join(PPT_MASTER_ROOT, 'references/ai-image-comparison/type', file);
  if (!existsSync(abs)) return undefined;
  return `${PPT_PREVIEW_STATIC_PREFIX}/references/ai-image-comparison/type/${file}`;
}

export function resolvePptStylePreviewPngAbs(styleId) {
  const file = PPT_STYLE_PREVIEW_FILES[styleId] ?? 'vector-illustration.png';
  const abs = path.join(PPT_MASTER_ROOT, 'references/ai-image-comparison/rendering', file);
  return existsSync(abs) ? abs : null;
}

export function resolvePptModePreviewPngAbs(modeId) {
  const file = PPT_MODE_PREVIEW_FILES[modeId] ?? 'framework.png';
  const abs = path.join(PPT_MASTER_ROOT, 'references/ai-image-comparison/type', file);
  return existsSync(abs) ? abs : null;
}

export function getOpenDesignStaticRoot(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const abs = path.join(OD_PREVIEW_DIR, normalized);
  if (!abs.startsWith(OD_PREVIEW_DIR)) return null;
  if (!existsSync(abs)) return null;
  return abs;
}

export function getPptCanvasStaticRoot(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const abs = path.join(PPT_CANVAS_PREVIEW_DIR, normalized);
  if (!abs.startsWith(PPT_CANVAS_PREVIEW_DIR)) return null;
  if (!existsSync(abs)) return null;
  return abs;
}

export function getPptStyleHtmlStaticRoot(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const abs = path.join(PPT_STYLE_PREVIEW_DIR, normalized);
  if (!abs.startsWith(PPT_STYLE_PREVIEW_DIR)) return null;
  if (!existsSync(abs)) return null;
  return abs;
}

export function getPptMasterStaticRoot(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const abs = path.join(PPT_MASTER_ROOT, normalized);
  if (!abs.startsWith(PPT_MASTER_ROOT)) return null;
  if (!existsSync(abs)) return null;
  return abs;
}
