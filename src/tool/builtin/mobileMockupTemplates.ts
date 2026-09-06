// PD-SAAS-FORK: embedded templates for scaffold_mobile_mockup (no skills/ read required)

export type ScreenSpec = { title: string; label: string; body: string };

export function buildGalleryIndex(screens: ScreenSpec[]): string {
  const cols = screens.map((s, i) => {
    const n = i + 1;
    return `  <div class="phone-col">
    <div class="phone-shell">
      <iframe class="phone-screen" src="screen-${n}.html" title="${s.title}"></iframe>
    </div>
    <p class="phone-label">${s.label}</p>
  </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>三屏手机界面示意</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh; display: flex; align-items: flex-start; justify-content: center;
      gap: 32px; flex-wrap: nowrap; overflow-x: auto; padding: 48px 32px 64px;
      background: radial-gradient(1200px 600px at 50% 0%, #1a2a5e 0%, #0a0a1a 55%, #050508 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; color: #fff;
    }
    .phone-col { display: flex; flex-direction: column; align-items: center; gap: 14px; flex: 0 0 auto; }
    .phone-label { font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: rgba(255,255,255,0.72); text-align: center; max-width: 280px; line-height: 1.4; }
    .phone-shell {
      width: 390px; height: 844px; padding: 12px; border-radius: 52px;
      background: linear-gradient(155deg, #3a3a3e, #121214 48%, #08080a);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.06) inset, 0 28px 64px rgba(0,0,0,0.55), 0 0 80px rgba(0,75,141,0.12);
      position: relative;
    }
    .phone-shell::before {
      content: ''; position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
      width: 118px; height: 34px; background: #000; border-radius: 20px; z-index: 2; pointer-events: none;
    }
    .phone-screen { width: 100%; height: 100%; border: 0; border-radius: 42px; background: #0a1020; display: block; }
  </style>
</head>
<body>
${cols}
</body>
</html>`;
}

const FIFA_SCREENS: ScreenSpec[] = [
  {
    title: "观赛首页",
    label: "屏 1 · 观赛总览与今日焦点",
    body: `<div class="badge">FIFA WORLD CUP 2026</div>
  <h1>观赛指南</h1>
  <p class="sub">美加墨联合举办 · 48 队 · 104 场</p>
  <section class="hero-card"><div class="inner">
    <div class="eyebrow">今日焦点</div>
    <div class="match">
      <div class="team"><div class="flag">🇧🇷</div><div class="name">巴西</div></div>
      <div class="vs">VS</div>
      <div class="team"><div class="flag">🇦🇷</div><div class="name">阿根廷</div></div>
    </div>
    <p class="kick">今晚 08:00（北京时间）· 半决赛 · 纽约大都会球场</p>
  </div></section>
  <div class="grid">
    <article class="tile"><h2>📺 怎么看</h2><p>央视 / 咪咕 / 抖音体育，一键设提醒</p></article>
    <article class="tile"><h2>⏰ 时差</h2><p>西七区为主，自动换算本地开球</p></article>
    <article class="tile"><h2>🏟 球场</h2><p>16 座主办球场交通与入场</p></article>
    <article class="tile"><h2>📋 规则</h2><p>48 队赛制与加时点球说明</p></article>
  </div>
  <nav class="tabbar"><div class="tab active">首页</div><div class="tab">赛程</div><div class="tab">球队</div><div class="tab">我的</div></nav>`,
  },
  {
    title: "赛程",
    label: "屏 2 · 赛程与开球提醒",
    body: `<header class="head"><h1>全部赛程</h1>
  <div class="filters"><span class="chip on">全部</span><span class="chip">小组赛</span><span class="chip">淘汰赛</span><span class="chip">已关注</span></div></header>
  <div class="day">7 月 14 日 · 周二</div>
  <article class="row"><div><div class="time">08:00</div><div class="stage">半决赛</div></div>
    <div><div class="teams">🇧🇷 巴西 vs 🇦🇷 阿根廷</div><div class="venue">纽约 · 大都会人寿体育场</div></div>
    <button type="button" class="bell" aria-label="提醒">🔔</button></article>
  <article class="row"><div><div class="time">11:00</div><div class="stage">半决赛</div></div>
    <div><div class="teams">🇫🇷 法国 vs 🇩🇪 德国</div><div class="venue">洛杉矶 · SoFi 体育场</div></div>
    <button type="button" class="bell" aria-label="提醒">🔔</button></article>
  <div class="day">7 月 19 日 · 周日</div>
  <article class="row"><div><div class="time">07:00</div><div class="stage">决赛</div></div>
    <div><div class="teams">待定 vs 待定</div><div class="venue">纽约 · 大都会人寿体育场</div></div>
    <button type="button" class="bell" aria-label="提醒">🔔</button></article>
  <nav class="tabbar"><div class="tab">首页</div><div class="tab active">赛程</div><div class="tab">球队</div><div class="tab">我的</div></nav>`,
  },
  {
    title: "城市指南",
    label: "屏 3 · 主办城市与现场指南",
    body: `<header class="cover"><div class="eyebrow">主办城市</div><h1>纽约</h1><p>大都会人寿体育场 · 决赛场地</p></header>
  <section class="section"><h2>现场观赛</h2>
    <article class="card"><h3>🚇 交通</h3><p>NJ Transit 至 Meadowlands 站，赛前 3 小时加开班次。</p></article>
    <article class="card"><h3>🎫 入场须知</h3><p>禁止大包入场；实名与护照核对；开赛前 90 分钟开门。</p></article>
    <article class="card"><h3>🌤 当地贴士</h3><p>7 月平均 28°C，午后雷阵雨；场馆内可购饮品。</p></article>
  </section>
  <button type="button" class="cta">添加到我的行程</button>
  <nav class="tabbar"><div class="tab">首页</div><div class="tab">赛程</div><div class="tab">球队</div><div class="tab active">我的</div></nav>`,
  },
];

const BLANK_SCREENS: ScreenSpec[] = [
  { title: "屏 1", label: "屏 1：首页 / 总览", body: `<div class="badge">APP</div><h1>标题占位</h1><p class="sub">一句话说明本屏任务</p>
  <section class="card"><h2>模块标题</h2><p>替换为真实内容。</p></section>
  <button type="button" class="cta">主操作</button>
  <nav class="tabbar"><div class="tab active">首页</div><div class="tab">列表</div><div class="tab">消息</div><div class="tab">我的</div></nav>` },
  { title: "屏 2", label: "屏 2：列表 / 浏览", body: `<h1>列表页</h1><p class="sub">筛选与条目</p>
  <section class="card"><h2>条目 A</h2><p>说明文字</p></section>
  <section class="card"><h2>条目 B</h2><p>说明文字</p></section>
  <nav class="tabbar"><div class="tab">首页</div><div class="tab active">列表</div><div class="tab">消息</div><div class="tab">我的</div></nav>` },
  { title: "屏 3", label: "屏 3：详情 / 操作", body: `<h1>详情页</h1><p class="sub">深度信息与操作</p>
  <section class="card"><h2>详情模块</h2><p>展开说明与数据。</p></section>
  <button type="button" class="cta">确认操作</button>
  <nav class="tabbar"><div class="tab">首页</div><div class="tab">列表</div><div class="tab">消息</div><div class="tab active">我的</div></nav>` },
];

export function getPresetScreens(preset: string, screenCount: number): ScreenSpec[] {
  const base = preset === "fifa-world-cup" ? FIFA_SCREENS : BLANK_SCREENS;
  return base.slice(0, Math.min(Math.max(screenCount, 1), 3));
}

export function buildScreenHtml(spec: ScreenSpec, variant: "home" | "list" | "detail"): string {
  const extraStyles =
    variant === "list"
      ? `.head{padding:12px 20px 8px}h1{font-size:24px;margin-bottom:12px}
.filters{display:flex;gap:8px;overflow-x:auto}.chip{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:600;background:rgba(255,255,255,0.06);color:var(--muted)}
.chip.on{background:rgba(0,75,141,0.35);color:#fff}.day{padding:16px 20px 6px;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:0.06em}
.row{margin:0 16px 10px;padding:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center}
.time{font-size:13px;font-weight:700}.stage{font-size:10px;color:var(--muted);margin-top:2px}.teams{font-size:14px;font-weight:600;line-height:1.35}
.venue{font-size:11px;color:var(--muted);margin-top:4px}.bell{width:36px;height:36px;border-radius:12px;border:0;background:rgba(201,162,39,0.15);color:var(--gold);font-size:16px}`
      : variant === "detail"
        ? `.cover{height:220px;background:linear-gradient(180deg,rgba(0,0,0,0.1),rgba(10,16,32,0.95)),linear-gradient(135deg,#1a4a7a,#004b8d 40%,#0a2848);padding:52px 20px 20px;display:flex;flex-direction:column;justify-content:flex-end}
.cover h1{font-size:26px;margin-bottom:6px}.cover p{font-size:13px;color:var(--muted)}.section{padding:18px 20px 0}.section h2{font-size:15px;margin-bottom:12px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.tag{font-size:10px;padding:4px 8px;border-radius:6px;background:rgba(201,162,39,0.12);color:var(--gold);font-weight:600}`
        : `.hero-card{border-radius:22px;overflow:hidden;margin-bottom:16px;background:linear-gradient(135deg,#0d3d6b,#004b8d 55%,#1a5a9e);border:1px solid rgba(255,255,255,0.1)}
.hero-card .inner{padding:18px 16px 16px}.eyebrow{font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.06em}
.match{display:flex;align-items:center;justify-content:space-between;margin-top:12px}.team{text-align:center;flex:1}.flag{font-size:32px;margin-bottom:4px}.name{font-size:13px;font-weight:600}
.vs{font-size:12px;color:var(--gold);font-weight:800;padding:0 8px}.kick{margin-top:12px;font-size:12px;color:rgba(255,255,255,0.75);text-align:center}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tile{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px 12px}
.tile h2{font-size:13px;margin-bottom:4px}.tile p{font-size:11px;color:var(--muted);line-height:1.4}`;

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${spec.title}</title>
  <style>
    :root { --fifa-blue: #004b8d; --fifa-gold: #c9a227; --bg: #0a1020; --gold: #c9a227; --muted: rgba(244,247,255,0.62); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; color: #f4f7ff; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
      background: linear-gradient(180deg, #0f1a35 0%, var(--bg) 42%, #060910 100%); padding: 52px 20px 100px; }
    .status { position: fixed; top: 0; left: 0; right: 0; height: 44px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 22px; font-size: 13px; font-weight: 600; background: linear-gradient(180deg, rgba(0,0,0,0.35), transparent); pointer-events: none; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(201,162,39,0.16); color: var(--gold); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 10px; }
    h1 { font-size: 28px; line-height: 1.15; margin-bottom: 8px; } .sub { font-size: 14px; line-height: 1.5; color: var(--muted); margin-bottom: 20px; }
    .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 16px; margin-bottom: 12px; }
    .card h2, .card h3 { font-size: 15px; margin-bottom: 6px; } .card p { font-size: 13px; line-height: 1.45; color: var(--muted); }
    .cta { margin-top: 18px; display: block; width: 100%; border: 0; border-radius: 14px; padding: 14px 16px;
      background: linear-gradient(135deg, var(--fifa-blue), #0066b3); color: #fff; font-size: 15px; font-weight: 700; text-align: center; }
    .tabbar { position: fixed; left: 12px; right: 12px; bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
      padding: 10px 8px; border-radius: 22px; background: rgba(8,12,22,0.92); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px); }
    .tab { text-align: center; font-size: 10px; color: var(--muted); padding: 6px 2px; } .tab.active { color: var(--gold); font-weight: 700; }
    ${extraStyles}
  </style>
</head>
<body>
  <div class="status"><span>9:41</span><span>LTE ▮▮▮</span></div>
  ${spec.body}
</body>
</html>`;
}

export function buildScaffoldFiles(preset: string, screenCount: number): Map<string, string> {
  const screens = getPresetScreens(preset, screenCount);
  const variants: Array<"home" | "list" | "detail"> = ["home", "list", "detail"];
  const files = new Map<string, string>();
  files.set("index.html", buildGalleryIndex(screens));
  screens.forEach((spec, i) => {
    files.set(`screen-${i + 1}.html`, buildScreenHtml(spec, variants[i] ?? "home"));
  });
  return files;
}
