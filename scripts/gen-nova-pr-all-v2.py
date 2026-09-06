#!/usr/bin/env python3
"""Rebuild Nova PR HTML + DOCX from 2026.8.11 v2 source (style + restrained media)."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "artifacts" / "nova-product-pr-20260812"
HTML_OUT = DIR / "index.html"
DOCX_OUT = DIR / "nova-ai-product-overview.docx"

INK = RGBColor(0x1C, 0x1F, 0x24)
MUTED = RGBColor(0x5C, 0x65, 0x70)
NOVA = RGBColor(0x3D, 0x44, 0x50)
ACCENT = RGBColor(0x4A, 0x6F, 0xA5)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
HERO_BG = "2A2F38"
CALL_BG = "E8EEF6"

CSS = r"""
    :root {
      --ink: #1c1f24;
      --muted: #5c6570;
      --line: #d7dbe0;
      --bg: #eef0f3;
      --paper: #f7f8fa;
      --card: #ffffff;
      --accent: #4a6fa5;
      --accent-soft: #e8eef6;
      --nova: #3d4450;
      --rail: #c5cad1;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(1200px 500px at 10% -10%, #e4e9f0 0%, transparent 55%),
        radial-gradient(900px 420px at 100% 0%, #e7ebe8 0%, transparent 50%),
        var(--bg);
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      line-height: 1.75;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 0 28px 80px; }
    .hero {
      margin: 28px 0 40px;
      padding: 48px 48px 40px;
      border-radius: 20px;
      background: linear-gradient(145deg, #2a2f38 0%, #3d4450 55%, #4a5563 100%);
      color: #f3f5f7;
      position: relative;
      overflow: hidden;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: auto -10% -40% 40%;
      height: 280px;
      background: radial-gradient(circle, rgba(74,111,165,.35), transparent 70%);
      pointer-events: none;
    }
    .hero-kicker {
      display: inline-block;
      font-size: 12px;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #b8c4d4;
      border: 1px solid rgba(255,255,255,.18);
      padding: 6px 12px;
      border-radius: 999px;
      margin-bottom: 18px;
    }
    .hero h1 {
      margin: 0 0 14px;
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 650;
      letter-spacing: .02em;
      line-height: 1.25;
      max-width: 18em;
    }
    .hero .lead { margin: 0; max-width: 40em; color: #c9d0d8; font-size: 16px; }
    .meta {
      margin-top: 28px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      font-size: 12px;
      color: #aeb6c0;
    }
    article.paper {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 48px 52px 56px;
      box-shadow: 0 18px 50px rgba(28, 31, 36, .06);
    }
    .toc {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin: 0 0 36px;
      padding: 18px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    .toc a {
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      padding: 8px 10px;
      border-radius: 8px;
    }
    .toc a:hover { background: var(--accent-soft); color: var(--ink); }
    h2 {
      margin: 48px 0 16px;
      font-size: 22px;
      font-weight: 650;
      letter-spacing: .01em;
      padding-left: 14px;
      border-left: 3px solid var(--accent);
    }
    h3 { margin: 28px 0 12px; font-size: 17px; font-weight: 600; color: var(--nova); }
    h4 { margin: 18px 0 8px; font-size: 14px; font-weight: 650; color: var(--accent); }
    p { margin: 0 0 14px; color: var(--ink); }
    .muted { color: var(--muted); }
    ul.clean { margin: 0 0 16px; padding-left: 1.2em; }
    ul.clean li { margin: 6px 0; }
    .callout {
      margin: 20px 0;
      padding: 16px 18px;
      background: var(--accent-soft);
      border-radius: 12px;
      border: 1px solid #d5e0ee;
    }
    .callout strong { color: var(--accent); }
    .need-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin: 18px 0 8px;
    }
    @media (max-width: 720px) {
      article.paper { padding: 28px 20px 36px; }
      .need-grid { grid-template-columns: 1fr; }
    }
    .need-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px 16px 14px;
    }
    .need-card h3 { margin: 0 0 8px; font-size: 15px; border: 0; padding: 0; }
    .need-card p { margin: 0; font-size: 14px; color: var(--muted); line-height: 1.65; }
    .figure {
      margin: 28px 0;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
    }
    .figure img { display: block; width: 100%; height: auto; background: #f4f5f7; }
    .figure figcaption {
      padding: 12px 16px 14px;
      font-size: 12px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      background: #fbfbfc;
    }
    .shot {
      margin: 28px 0;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--line);
      box-shadow: 0 10px 30px rgba(28,31,36,.07);
      background: #111;
    }
    .shot img { display: block; width: 100%; height: auto; }
    .shot .cap {
      padding: 12px 16px;
      background: var(--card);
      font-size: 12px;
      color: var(--muted);
      border-top: 1px solid var(--line);
    }
    table.compare {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      margin: 16px 0 8px;
      background: var(--card);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--line);
    }
    table.compare th, table.compare td {
      padding: 11px 12px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      text-align: left;
    }
    table.compare th { background: #eef1f5; font-weight: 600; color: var(--nova); }
    table.compare tr:last-child td { border-bottom: 0; }
    table.compare td:first-child { font-weight: 600; color: var(--nova); width: 14%; }
    .barrier {
      margin: 18px 0;
      padding: 18px 18px 8px;
      border-radius: 12px;
      background: var(--card);
      border: 1px solid var(--line);
    }
    .barrier .num {
      display: inline-block;
      font-size: 12px;
      color: var(--accent);
      letter-spacing: .08em;
      margin-bottom: 6px;
    }
    .mode-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0 8px;
    }
    @media (max-width: 820px) { .mode-grid { grid-template-columns: 1fr; } }
    .mode-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
    }
    .mode-card .idx { font-size: 12px; color: var(--accent); letter-spacing: .08em; margin-bottom: 6px; }
    .mode-card h3 { margin: 0 0 8px; font-size: 15px; }
    .mode-card p { margin: 0; font-size: 13.5px; color: var(--muted); }
    .case {
      margin: 22px 0;
      padding: 20px 20px 12px;
      border-radius: 14px;
      background: var(--card);
      border: 1px solid var(--line);
    }
    .case .eyebrow { font-size: 12px; color: var(--accent); letter-spacing: .06em; margin-bottom: 4px; }
    .case h3 { margin: 0 0 10px; }
    .case .who { font-size: 14px; color: var(--muted); margin-bottom: 12px; }
    .tech-list { margin: 12px 0 8px; padding: 0; list-style: none; }
    .tech-list li {
      margin: 0 0 12px;
      padding: 14px 16px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      font-size: 14.5px;
    }
    .tech-list strong { color: var(--nova); }
    .closing {
      margin: 28px 0 8px;
      padding: 22px 22px;
      border-radius: 14px;
      background: linear-gradient(145deg, #eef1f5, #f7f8fa);
      border: 1px solid var(--line);
    }
    .closing p { margin: 0 0 10px; }
    .closing p:last-child { margin: 0; }
    .footer-note {
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
    }
    .resource-block {
      margin-top: 48px;
      padding: 28px 28px 24px;
      border-radius: 16px;
      background: linear-gradient(160deg, #2a2f38 0%, #3d4450 58%, #46515f 100%);
      color: #f3f5f7;
      border: 1px solid rgba(255,255,255,.08);
    }
    .resource-block h2 {
      margin: 0 0 8px;
      color: #f7f8fa;
      border-left: 0;
      padding-left: 0;
      font-size: 20px;
    }
    .resource-block .resource-lead {
      margin: 0 0 20px;
      color: #b8c0ca;
      font-size: 14px;
      max-width: 42em;
    }
    .resource-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    @media (max-width: 820px) { .resource-grid { grid-template-columns: 1fr; } }
    .resource-card {
      display: block;
      text-decoration: none;
      color: inherit;
      padding: 16px 16px 14px;
      border-radius: 12px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
    }
    .resource-card .tag {
      display: inline-block;
      font-size: 11px;
      letter-spacing: .1em;
      color: #9eb0c8;
      margin-bottom: 8px;
    }
    .resource-card .title {
      display: block;
      font-size: 16px;
      font-weight: 650;
      color: #f3f5f7;
      margin-bottom: 6px;
    }
    .resource-card .url {
      display: block;
      font-size: 12px;
      color: #a7b4c4;
      word-break: break-all;
      line-height: 1.45;
    }
    .resource-card .hint {
      display: block;
      margin-top: 10px;
      font-size: 12.5px;
      color: #c5ccd5;
      line-height: 1.5;
    }
    @media print {
      html, body, .wrap { background: #fff !important; }
      body { background-image: none !important; }
      .wrap { max-width: none; padding: 0; }
      .hero { margin: 0 0 24px; border-radius: 0; break-inside: avoid; }
      article.paper {
        background: #fff !important;
        border: 0;
        box-shadow: none;
        border-radius: 0;
        padding: 0;
      }
      .toc, .need-card, .barrier, .figure, .callout, .case, .mode-card,
      table.compare, table.compare th, .tech-list li, .closing {
        background: #fff !important;
      }
      .shot, .figure, table.compare, .barrier, .need-card, .case, .resource-block { break-inside: avoid; }
      h2 { break-after: avoid; }
      a { color: inherit; text-decoration: none; }
    }
"""

CASES = [
    {
        "title": "1. 白马广告 · 广告营销行业",
        "who": "客户是谁：一家拥有20多年行业沉淀的广告公司，服务于多个知名品牌。中国最大的公交媒体供应商。",
        "pain": [
            "创意方向全靠经验和感觉，内部反复讨论仍难定方向",
            "海量媒体和自媒体分散各处，竞品数据采集困难",
            "文案、稿件、设计、方案内容产出量大，团队长期超负荷",
            "内容反复修改，来回折返，效率极低",
        ],
        "deploy": [
            "部署NOVA AI营销板块全套解决方案",
            "聚合全域自媒体数据，实现数据驱动决策",
            "AI精准定位创意方向，极速批量产出文案、稿件、设计及全套方案",
            "搭载行业商用AI模块，一键全平台智能分发，自动适配各渠道格式",
            "沉淀可复用方案资产，形成企业内部知识库",
        ],
        "solve": [
            "创意方向不再拍脑袋，有真实数据支撑",
            "批量内容生产能力大幅提升，团队从“生产”变“精选”",
            "分发效率指数级增长，覆盖平台更广",
            "重复劳作与内容反复修改大幅削减",
        ],
        "effect": [
            "整体效率提升3倍，人力成本降低30%",
            "业务从传统广告拓展到全域营销，全面拓宽服务范围",
            "历经试点验证，落地多份合作协议",
            "双方已签署深度战略合作协议，携手深耕广告赛道",
        ],
    },
    {
        "title": "2. 非凡文化 · 智慧教育行业",
        "who": "客户是谁：非凡文化，拥有150所中小学合作资源的教育服务企业。",
        "pain": [
            "学校端：校园安全难前置管控、数据繁杂信息安全难管、行政流程冗余",
            "教师端：学情无法精准掌握、教学环节事务繁杂负担重、教研备课缺少创新支撑",
            "学生端：优等生缺少拔高拓展资源、普通学生无针对性巩固训练",
            "家长端：仅知晓成绩，缺少具体辅导办法",
        ],
        "deploy": [
            "部署AI校内智慧平台，覆盖三大板块",
            "校园综合管理类：AI全场景安全防控系统、舆情与危机管控平台、心理健康监测系统、智慧校务行政中心等",
            "教师教学减负类：AI智能作业试卷批改系统、课堂质量分析助手、名师备课复刻系统、课件公开课打磨工具等",
            "学生个性化学习类：AI全域学情智能诊断系统、分层精准培优系统、线下AI智慧自习室硬件方案",
            "家长协同端口类：AI家长学情可视化窗口、家校智能办事知识库",
        ],
        "solve": [
            "校园安全从“事后处理”变成“事前预警”",
            "教师从繁重的备课、批改、行政事务中解放出来",
            "学生实现个性化、精准化学习",
            "家长不仅了解孩子学情，更知道如何配合辅导",
        ],
        "effect": [
            "备课耗时减少65%，大幅提效",
            "行政工作削减60%，聚焦教学",
            "教学质量提升，精准定位学生薄弱点",
            "全维度风险预警，校园安全强化",
            "个性化因材施教，学生成绩同步提升",
        ],
    },
    {
        "title": "3. 中国石化 · 能源行业",
        "who": "客户是谁：世界500强能源企业，作为清华智谱合作伙伴引入我们进行项目承接。",
        "pain": [
            "企业内部海量多格式、多语言资料（技术文档、国际标准、项目报告等）",
            "人工检索处理效率极低，项目周期被严重拉长",
            "存量数据沉睡，无法有效盘活利用",
        ],
        "deploy": [
            "打通企业内部数据通道，建立智能检索系统",
            "部署全流程数据可视化平台",
            "AI辅助多格式、多语言资料自动处理",
        ],
        "solve": [
            "海量资料实现秒级检索，无需人工翻阅",
            "存量数据全面盘活，成为可调用的企业资产",
            "数据处理从人工转为自动化",
        ],
        "effect": [
            "处理效率提升40倍，单日可批量处理上百份文件",
            "企业内部数据通道全面打通，存量数据充分盘活",
            "全流程数据可视化，企业知识资产被充分激活",
        ],
    },
    {
        "title": "4. 中国科协 · 政务领域",
        "who": "客户是谁：中国科学技术协会，国家级科技工作者组织。",
        "pain": [
            "公文、报告、文书类文案撰写工作量大",
            "各类报表重复填报，耗费大量人力",
            "工作人员深陷事务性工作，无法聚焦核心职能",
        ],
        "deploy": [
            "部署智能文书处理平台",
            "AI辅助各类文书、报表自动生成与处理",
        ],
        "solve": [
            "标准化文书不再需要人工逐字撰写",
            "报表自动填充、格式自动规范",
            "工作人员从重复劳动中解脱",
        ],
        "effect": [
            "各类文书、报表类重复工作减少70%",
            "办公效率显著提升",
            "工作人员得以聚焦统筹、规划等高价值工作",
        ],
    },
    {
        "title": "5. 郑州文旅 · 文旅行业",
        "who": "客户是谁：郑州市文化和旅游主管部门。",
        "pain": [
            "核心景区线下人工咨询讲解压力大",
            "多语种服务能力不足，国际化体验欠缺",
            "游客互动参与感弱，社交传播效果有限",
            "管理端缺少实时客流数据支撑运营决策",
        ],
        "deploy": [
            "部署“豫见AI”智慧文旅解决方案",
            "游客手机端：自助多语讲解、实时翻译、打卡互动、智能导览",
            "管理端：可视化运营看板，实时掌握客流、评价等数据",
            "多语种讲解素材统一入库，覆盖全部核心景区",
        ],
        "solve": [
            "游客不再依赖线下人工咨询，手机自助完成讲解和翻译",
            "打卡互动功能激发游客社交分享，扩大传播",
            "管理者实时掌握运营数据，精准调度资源",
        ],
        "effect": [
            "大幅减轻线下人工咨询讲解压力",
            "平台口碑好评优异，游客参与及社交传播效果显著",
            "管理端可视化运营看板精准掌握客流情况",
            "“豫见AI”成为郑州智慧文旅标杆，成功赋能“天地之中、功夫郑州”城市品牌传播",
        ],
    },
    {
        "title": "6. 汽车后市场培训机构 · 职业培训行业",
        "who": "客户是谁：一家专注于汽车后市场的线下培训机构，主营技师培训课程。",
        "pain": [
            "传统线下讲师模式成本高，受地域和人力限制严重",
            "业务规模难以扩大，生存面临挑战",
            "行业亟需向线上数字化培训转型",
        ],
        "deploy": [
            "部署AI智能培训平台",
            "实现线上常态化AI培训课程",
            "AI自动完成内容更新和学员答疑",
        ],
        "solve": [
            "摆脱了对专职线下讲师的强依赖",
            "培训不再受地域限制，可覆盖全国学员",
            "内容维护和日常答疑完全自动化",
        ],
        "effect": [
            "成功化解生存危机，摆脱对专职线下讲师的强依赖",
            "新增线上AI常态化培训业务，拓展收入来源",
            "运营全面提效，内容更新与答疑全自动化，团队聚焦课程研发和品质把控",
        ],
    },
]


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def ul(items: list[str]) -> str:
    return "<ul class=\"clean\">" + "".join(f"<li>{esc(x)}</li>" for x in items) + "</ul>"


def case_html(c: dict) -> str:
    return f"""
      <article class="case">
        <div class="eyebrow">服务案例</div>
        <h3>{esc(c['title'])}</h3>
        <p class="who">{esc(c['who'])}</p>
        <h4>客户痛点</h4>
        {ul(c['pain'])}
        <h4>我们部署了什么</h4>
        {ul(c['deploy'])}
        <h4>解决了什么问题</h4>
        {ul(c['solve'])}
        <h4>落地成效</h4>
        {ul(c['effect'])}
      </article>
"""


def build_html() -> str:
    cases = "\n".join(case_html(c) for c in CASES)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NOVA AI 企业级全场景 AI 应用产品全景介绍</title>
  <style>{CSS}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="hero-kicker">PRODUCT OVERVIEW · 2026.8</div>
      <h1>NOVA AI 企业级全场景 AI 应用产品全景介绍</h1>
      <p class="lead">定位：NOVA AI——标准化商用企业级全场景经营 AI 平台</p>
      <div class="meta">
        <span>文档日期：2026.8.11</span>
        <span>版本：内容更新稿</span>
        <span>版式：Nova 石墨高级灰 · 专业阅读版</span>
      </div>
    </header>

    <article class="paper">
      <nav class="toc" aria-label="目录">
        <a href="#sec-why">企业级 AI 四大刚需</a>
        <a href="#sec-vs">NOVA AI vs 大众通用 AI</a>
        <a href="#sec-moat">四大核心差异化壁垒</a>
        <a href="#sec-agents">全部门专家智能体</a>
        <a href="#sec-coop">合作方式</a>
        <a href="#sec-cases">服务案例</a>
        <a href="#sec-tech">技术底子</a>
        <a href="#sec-value">合作价值</a>
      </nav>

      <p>当下 AI 普及化，市面上豆包等通用大模型主打个人轻量化办公、碎片化内容创作；而具备资金、技术实力的大型企业，全部自主投入人力、成本自研专属企业级 AI，不会直接使用公有通用 AI，背后存在四大刚需，也是企业级 AI 不可替代的核心价值：</p>

      <h2 id="sec-why">企业级 AI 的四大刚需</h2>
      <div class="need-grid">
        <div class="need-card">
          <h3>沉淀企业自有数字资产，规避各层级人员变动造成业务断层</h3>
          <p>通用公有 AI 的数据、项目资料、业务经验全部存储在第三方平台，核心员工出现升职、调岗、离职等情况，其核心业务数据如行业打法、客户逻辑、项目方案、管理经验会出现流失断层；自研企业级 AI 配套专属私有知识库，全公司经营数据、部门流程、历史项目永久留存企业自有体系，新人可依托 AI 快速承接工作，业务不会因人中断。</p>
        </div>
        <div class="need-card">
          <h3>打通全部门业务链路，消除多工具数据孤岛</h3>
          <p>企业分开采购多款单点 AI 工具会形成割裂烟囱，产品、市场、销售、财务数据互不互通，跨部门协作需要人工复制文件、重复录入信息；企业级全场景 AI 原生串联研发、营销、商务、财法、管理层完整经营流程，业务成果可一键跨部门流转，一套系统支撑全公司协同分工。</p>
        </div>
        <div class="need-card">
          <h3>具备行业专家级研判能力，不止基础文本提效</h3>
          <p>通用大模型仅作为文本助手，依赖使用者给出完整思路、详细提示词，只能做润色、套模板，产出上限由使用者自身专业水平决定；企业级 AI 内置对应部门资深专家逻辑，可自主完成市场研判、产品规划、财税风控、营销全案策划，主动拔高业务方案专业度。</p>
        </div>
        <div class="need-card">
          <h3>数据安全合规可控，满足政企、金融、生产企业监管要求</h3>
          <p>通用公有 AI 所有上传文档、对话记录外存第三方云端，财务报表、合同、核心商业方案存在泄露风险；企业级 AI 支持私有化本地部署、分级权限管控、全链路操作审计，敏感经营数据不出企业内网，适配高合规行业硬性标准。</p>
        </div>
      </div>

      <p>头部企业自研企业级 AI 成本极高、周期漫长，中小微企业、创业团队无力独立开发；同时不少大型企业自研仅覆盖基础内部办公，缺少深度营销、商机挖掘、政策申报、全链路成套物料产出等高阶能力。</p>
      <div class="callout">
        <strong>市场定位：</strong>NOVA AI 精准填补市场空白：面向大中小企业、一人创业团队提供开箱即用标准化企业级全场景 AI，同时支持按需定制开发。无需企业承担高额自研成本，即可拥有完整、打通端到端经营流程的企业 AI 能力，补齐自研覆盖不全、小微无力研发的市场缺口。
      </div>

      <figure class="shot">
        <img src="media/05-site-home.png" alt="Nova Ai-Studio 官网首页 Hero" />
        <div class="cap">图 1　产品官网首页（全屏）——对话驱动的企业级 Agent 平台入口</div>
      </figure>

      <figure class="shot">
        <img src="media/01-login-hero.png" alt="NOVA AI 登录与产品入口全屏截图" />
        <div class="cap">图 2　产品登录入口（全屏）——进入企业级智能体工作台</div>
      </figure>

      <h2 id="sec-vs">一、什么是真正的企业级 AI：NOVA AI VS 豆包（大众 C 端通用 AI）基础维度对比</h2>
      <p>市面 99% AI 产品聚焦 To C 个人赛道，豆包属于典型大众通用 AI，仅解决单人碎片化需求；NOVA AI 纯卡位企业经营赛道，二者底层定位、架构、服务逻辑存在本质区别，详见下表：</p>
      <p class="muted">表格 1　企业级 NOVA AI vs 大众版豆包 基础定位对比</p>
      <table class="compare">
        <thead>
          <tr>
            <th>对比维度</th>
            <th>NOVA AI（纯正企业级全场景 AI）</th>
            <th>豆包（大众 C 端通用 AI）</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>服务对象</td>
            <td>大型企业、中小企业、一人公司、完整组织团队、企业管理层，服务整套经营主体</td>
            <td>个人普通用户、职场单人，仅服务独立个体，无组织协同设计</td>
          </tr>
          <tr>
            <td>产品架构</td>
            <td>原生企业协同流转架构，全部门总监级智能体配套，多 Agent 统一目标管控；支持私有化部署、多租户数据隔离、分级权限、企业私有知识库、跨部门任务自动流转</td>
            <td>轻量化单点工具架构，无企业部门分层、协同底层；无私有化部署、企业知识库、权限管控、业务流转模块，会话完全独立隔离</td>
          </tr>
          <tr>
            <td>能力逻辑</td>
            <td>复刻完整企业端到端经营闭环，预埋各行业总监级专业业务模型、合规标准、爆款营销体系；零提示词依赖，一句需求即可输出成套专业落地成果；项目任务一键跨部门流转</td>
            <td>通用通识生成逻辑，无垂直企业经营底层模型；产出质量完全依赖用户提示词水平，仅做文字基础加工；无跨部门自动流转，多任务产出零散割裂</td>
          </tr>
          <tr>
            <td>落地场景</td>
            <td>全链路商业闭环：产品调研规划→营销全案成套产出→法务合规审核→全域投放分发→精准商机获客→财税风控核算→政策申报→经营数据复盘</td>
            <td>个人碎片化场景：闲聊、短文写作、简单文档、学习、娱乐，无法承接完整企业商业项目</td>
          </tr>
          <tr>
            <td>专业技能</td>
            <td>营销、产品、销售、财税法务、经营管理多维度专家级研判，可自主完成数据分析、策略制定、风险筛查、补贴测算等高阶商业工作</td>
            <td>仅基础文字问答、简单计算、浅层文案润色，无企业经营、全域营销、财税风控、产品规划专业能力</td>
          </tr>
        </tbody>
      </table>

      <figure class="figure">
        <img src="charts/compare-bars.svg" alt="能力维度对照示意" />
        <figcaption>图 3　能力维度对照（定性示意）：组织协同、经营闭环、专家研判、成套物料、安全合规、零提示词落地</figcaption>
      </figure>

      <h3>赛道核心差异总结</h3>
      <ul class="clean">
        <li><strong>豆包：</strong>个人辅助工具，核心作用提升单人文字工作效率，产出上限取决于使用者自身专业能力；</li>
        <li><strong>NOVA AI：</strong>企业一体化经营系统，核心作用以行业专家视角全盘承接企业经营全流程，不只是简单提效，更能输出高于普通员工水平的专业策略方案。</li>
      </ul>

      <h3>产品愿景</h3>
      <p>降低企业级 AI 定制与使用门槛，让标准化、完整闭环、专家级能力的企业 AI 助力每一位经营者；无论大企业、小微企业、个体创业者，都能低成本拥有对标集团级完整经营 AI 体系。</p>

      <figure class="shot">
        <img src="media/02-workbench-chat.png" alt="NOVA AI 对话工作台全屏截图" />
        <div class="cap">图 4　统一工作台（全屏）——以对话承接复杂经营任务，连接能力中心与成果交付</div>
      </figure>

      <figure class="figure">
        <img src="charts/architecture.svg" alt="NOVA AI 企业级平台架构逻辑视图" />
        <figcaption>图 5　平台架构逻辑视图：工作台与能力中心之上，是各部门总监级智能体与统一目标管控；底层为私有知识库、权限审计与私有化部署</figcaption>
      </figure>

      <h2 id="sec-moat">二、NOVA AI 四大核心差异化壁垒（突出全场景端到端业务闭环核心优势）</h2>
      <p>通用大模型、简易企业工具普遍存在功能碎片化、无专业研判、流程割裂、产出零散四大短板，NOVA AI 搭建独家壁垒，实现全方位差异化：</p>

      <div class="barrier">
        <div class="num">壁垒一</div>
        <h3 style="margin-top:0">打破工具孤岛，原生支持跨部门业务自动流转，形成完整经营闭环</h3>
        <p>普通 AI 工具各模块相互独立，产品、营销、法务、销售之间资料需要人工复制导出；NOVA AI 打通全业务链路，实现一站式流转：</p>
        <p><strong>完整端到端业务落地流程：</strong></p>
        <ul class="clean">
          <li>产品研发智能体自动抓取竞品、用户口碑、行业技术，以产品总监视角输出新品规划 / 迭代方案；</li>
          <li>方案确认后一键流转至营销智能体，自动生成品牌定位、文案、短视频脚本、活动全案、PPT、配套配图、大 V 仿写全套物料；</li>
          <li>营销物料自动推送法务智能体，筛查违规广告词、宣传法律风险，输出整改意见；</li>
          <li>合规校验完成后，一键适配全平台短视频、自媒体平台，批量规划全域内容分发投放；</li>
          <li>同步销售智能体全网挖掘精准商业线索，分层筛选高意向客户，配套销冠谈判成交话术；</li>
          <li>全流程经营数据同步财务智能体，自动对账、筛查税务风险，匹配各级产业补贴并生成全套申报材料；</li>
          <li>所有经营数据汇总至管理层数据驾驶舱，自动完成经营诊断、输出中长期战略优化方案。</li>
        </ul>
        <p>整套流程无需人工反复切换工具、传递文件，从产品构思到营销落地、获客成交、合规风控、经营复盘一站式闭环落地。</p>
      </div>

      <figure class="figure">
        <img src="charts/flow-e2e.svg" alt="端到端经营闭环流程图" />
        <figcaption>图 6　端到端经营闭环：产品研发 → 市场营销 → 法务合规 → 全域分发 → 销售获客 → 财务风控 → 经营驾驶舱</figcaption>
      </figure>

      <div class="barrier">
        <div class="num">壁垒二</div>
        <h3 style="margin-top:0">全部门完整覆盖，无需二次开发，开箱即用标准化企业经营体系</h3>
        <p>市面同类产品大多只覆盖单一板块（仅营销、仅办公、仅财务）；NOVA AI 一次性配齐产品、营销、销售、行政、财务法务、决策全职能智能体，完整复刻成熟企业全部经营逻辑，中小企业无需自研、无需外包搭建流程，直接落地整套企业 AI 系统。</p>
      </div>

      <div class="barrier">
        <div class="num">壁垒三</div>
        <h3 style="margin-top:0">零“提示词”门槛，内置总监级专家模型，产出质量高于个体员工</h3>
        <p>豆包等通用 AI 是“助手型工具”：需要用户提供完整思路、框架、行业信息，AI 仅做文字优化，只能辅助提速，无法拔高专业度；</p>
        <p>NOVA AI 预埋各行业资深总监完整业务逻辑、合规标准、成熟行业打法，形成“全案模板”。用户仅需简单一句业务需求，AI 自主完成深度数据研判、策略规划，以专家视角输出高阶落地方案，产出专业度可超越一般岗位个体员工，彻底摆脱提示词依赖、解决“人决定产出水平”的痛点。</p>
      </div>

      <div class="barrier">
        <div class="num">壁垒四</div>
        <h3 style="margin-top:0">多 Agent 统一目标管控，一次性成套输出全品类落地物料</h3>
        <p>普通多智能体工具各模块目标割裂，一套方案需要分多次生成文档、PPT、表格、配图；NOVA AI 同一项目下所有智能体实时校准统一目标，同步批量输出 Word 方案、汇报 PPT、宣传配图、执行清单、数据测算表、申报文书全套物料，产出完整成套，拿来即可直接用于宣传、汇报、商务、申报场景。</p>
      </div>

      <figure class="shot">
        <img src="media/04-marketing-flywheel.png" alt="NOVA AI 能力中心营销能力全屏截图" />
        <div class="cap">图 7　能力中心（全屏）——按经营阶段组织的专家能力与全案模板入口</div>
      </figure>

      <h2 id="sec-agents">三、全部门总监级专家智能体功能详解</h2>
      <p>依托四大核心壁垒，NOVA AI 为企业每个核心职能部门配备虚拟专家智能体，区别于豆包仅做基础文字辅助，所有模块均具备自主分析、策略输出、业务流转的专家级能力，下表直观对比各模块功能差距：</p>
      <p class="muted">表格 2　NOVA AI 各部门专家智能体 VS 豆包（大众 AI）分模块功能对比</p>
      <table class="compare">
        <thead>
          <tr>
            <th>业务部门</th>
            <th>NOVA AI（总监级专家智能体核心能力）</th>
            <th>核心优势总结</th>
            <th>豆包（大众通用 AI 功能上限）</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>产品与研发<br/>（产品总监）</td>
            <td>自动抓取竞品、专利、全网用户痛点，量化分析并输出新品 / 迭代专业方案；成果一键流转营销模块启动包装策划</td>
            <td>具备三维市场研判能力，打通产品到营销完整业务链路，主动输出高阶产品规划</td>
            <td>仅能整理用户手动提供的零散信息，无法自主抓取行业数据，不能主动输出产品策略，无跨部门流转通道</td>
          </tr>
          <tr>
            <td>市场营销<br/>（营销总监・核心强项）</td>
            <td>内置全赛道爆款营销底层逻辑；一键成套产出文案、脚本、活动全案、PPT、配图、大 V 仿写；全平台投放适配；7×24 舆情监控 + 公关方案</td>
            <td>营销模块深度垂直行业训练，从策略、成套物料、投放、舆情全链路专家操盘，是核心差异化强项</td>
            <td>仅生成基础通用文字，需多次分指令生成 PPT、配图；无流量投放模型，无全自动舆情预警</td>
          </tr>
          <tr>
            <td>销售商务<br/>（顶尖销冠顾问）</td>
            <td>全网自动挖掘、分层筛选精准商机；实时追踪客户经营动态，生成客户背调、定制成交谈判策略</td>
            <td>主动挖掘高价值客户，预判合作窗口期，全流程辅助成交转化</td>
            <td>无法自主抓取商业线索，仅能基于用户输入简单撰写话术</td>
          </tr>
          <tr>
            <td>行政办公<br/>（综合管理顾问）</td>
            <td>公文、周报、审批自动化标准化处理；配套企业私有知识库沉淀组织经验，新人快速上手</td>
            <td>适配企业内部标准化管理，永久留存企业数字资产，解决人员流失经验断层问题</td>
            <td>仅简单文字润色，无企业标准化文书体系，无私有企业知识库</td>
          </tr>
          <tr>
            <td>管理层决策<br/>（经营管理顾问）</td>
            <td>整合全业务数据生成可视化数据驾驶舱；结合企业历史 + 行业对标输出经营诊断、中长期战略方案</td>
            <td>实现数据驱动经营复盘，替代人工月度季度报表复盘，辅助管理层科学决策</td>
            <td>无法对接企业经营数据，仅能做简单数字计算，无经营分析、战略规划能力</td>
          </tr>
          <tr>
            <td>财务 &amp; 法务<br/>（财税 + 法务双总监）</td>
            <td>实时同步财税、广告合规法规；自动对账、筛查税务 / 宣传风险；匹配产业补贴，生成全套申报材料</td>
            <td>全业务前置主动风控，补齐中小企业高端财法人才缺口</td>
            <td>仅基础数字计算、简单合同文字校对，无合规筛查、补贴测算、申报文书生成能力</td>
          </tr>
          <tr>
            <td>全公司通用保障</td>
            <td>私有化部署、多租户隔离、分级权限、全链路操作审计，企业敏感数据本地留存</td>
            <td>满足央企、政企、金融等高等级数据合规监管要求</td>
            <td>无私有化、企业数据隔离、权限管控能力，数据全部上传公有云端</td>
          </tr>
        </tbody>
      </table>

      <h3>各模块简要说明（精简无重复，突出专家属性与流转能力）</h3>
      <h3>市场与营销（核心优势板块）</h3>
      <p>作为产品核心强项模块，可承接上游产品方案，一键输出品牌定位、宣传策略及完整整合营销全案，方案内同步覆盖线上线下全媒介物料制作需求，包含各渠道图文、短视频、宣传海报、户外广告、TVC、病毒视频、线下活动全流程脚本与执行方案。内容创作依托各大赛道头部大 V 爆款逻辑合规仿写，产出内容更贴合平台流量规则，数据表现优于普通自主原创文案。全套物料自动推送法务完成合规校验，审核通过后可一键完成全域渠道分发投放。搭配 7×24 小时全网舆情实时监测，实时捕捉品牌口碑与行业动态，出现负面风险自动预警，并同步给出营销方案优化、公关应对调整建议，形成从策划、物料产出、全域投放到舆情优化的完整营销闭环。</p>
      <h3>产品研发</h3>
      <p>自主完成竞品、用户、技术三维深度分析，输出可落地新品迭代方案，成果直接流转营销端启动品牌包装，打通企业产品开发到市场化完整链路，通用 AI 无数据抓取、策略输出、业务流转能力。</p>
      <h3>销售商务</h3>
      <p>主动挖掘全网商业线索，筛选高意向客户，同步追踪客户动态，可一键生成应标书并配套销冠级成交策略，覆盖营销后的客户转化全流程，通用 AI 仅能被动撰写沟通话术。</p>
      <h3>行政办公</h3>
      <p>自动化处理企业重复性办公事务，依托私有知识库沉淀企业专属制度、项目经验，解决人员流失带来的业务断层，通用 AI 无企业资产留存体系。</p>
      <h3>管理层决策</h3>
      <p>整合全公司营销、销售、财务数据形成可视化驾驶舱，自主诊断经营短板、输出中长期战略建议，通用 AI 不具备企业经营数据分析能力。</p>
      <h3>财务 &amp; 法务</h3>
      <p>贯穿全业务前置合规风控，营销产出物料自动筛查宣传违规风险，自动完成账务整理、税务预警、产业补贴申报全套工作，补齐中小团队缺少财税、法务专家的短板。</p>
      <h3>全公司安全保障</h3>
      <p>私有化部署、分级权限管控、操作审计等企业专属安全能力，适配涉密经营主体，公有通用 AI 无法满足企业数据合规需求。</p>

      <h2 id="sec-coop">四、合作方式</h2>
      <p>三种模式，灵活选择：</p>
      <div class="mode-grid">
        <div class="mode-card">
          <div class="idx">模式一</div>
          <h3>标准化成品订阅/部署</h3>
          <p>现有产品开箱即用，支持 SaaS 订阅或本地私有化部署</p>
        </div>
        <div class="mode-card">
          <div class="idx">模式二</div>
          <h3>驻场式 AI 升级服务</h3>
          <p>团队入驻企业，从梳理痛点到输出完整落地方案，手把手落地</p>
        </div>
        <div class="mode-card">
          <div class="idx">模式三</div>
          <h3>专属定制开发</h3>
          <p>根据个性化需求，从零定制开发</p>
        </div>
      </div>

      <figure class="shot">
        <img src="media/07-showcase-home.png" alt="Nova 官网演示案例首页" />
        <div class="cap">图 8　官网演示案例首页（全屏）——可预览的设计、营销、全案等成果样例入口</div>
      </figure>

      <h2 id="sec-cases">五、服务案例</h2>
      {cases}

      <h2 id="sec-tech">六、我们的技术底子</h2>
      <ul class="tech-list">
        <li><strong>全球主流 AI 模型一池统管：</strong>集成 OpenAI、Claude、智谱、文心、通义等国内外所有主流模型，按任务自动选最优模型——您不用纠结用哪个，我们帮您选对</li>
        <li><strong>365+ 项能力开箱即用：</strong>文案、图像、视频、语音、数据分析……不需要开发，直接调用</li>
        <li><strong>主从式多 Agent 协同架构：</strong>一个总 Agent 统筹任务，多个子 Agent 分工执行，兼顾统一度和效率</li>
        <li><strong>智能路由省 Token：</strong>自动选择性价比最高的模型，帮您省下 30%~50% 的 API 调用成本</li>
        <li><strong>四层企业级安全防护：</strong>对标银行标准，多租户隔离、权限沙箱、临时任务痕迹自动清除、全链路审计</li>
      </ul>

      <figure class="shot">
        <img src="media/06-site-token70.png" alt="官网智能路由节省 Token Hero" />
        <div class="cap">图 9　官网「智能路由 / 节省约 70% Token」专屏（全屏）——与智能路由省 Token 能力对应的产品叙事</div>
      </figure>

      <h2 id="sec-value">七、合作价值</h2>
      <div class="closing">
        <p><strong>把省下来的时间、人力、成本，变成实实在在的增长！</strong></p>
        <p>我们不只是 AI 供应商，更是长期陪跑的伙伴。</p>
        <p>携手共建企业 AI 新生态，期待与您深度合作。</p>
      </div>

      <section class="resource-block" aria-label="官方资源入口">
        <h2>进一步了解</h2>
        <p class="resource-lead">如需查阅产品官网、完整白皮书或在线演示案例，可通过以下官方入口访问（与主站同源发布）：</p>
        <div class="resource-grid">
          <a class="resource-card" href="https://www.novapage.online/" target="_blank" rel="noopener noreferrer">
            <span class="tag">OFFICIAL SITE</span>
            <span class="title">产品官网</span>
            <span class="url">https://www.novapage.online/</span>
            <span class="hint">了解平台定位、核心能力与企业级应用场景</span>
          </a>
          <a class="resource-card" href="https://www.novapage.online/docs/" target="_blank" rel="noopener noreferrer">
            <span class="tag">WHITE PAPER</span>
            <span class="title">产品白皮书</span>
            <span class="url">https://www.novapage.online/docs/</span>
            <span class="hint">阅读选型、私有化、Token 与竞品对照等完整说明</span>
          </a>
          <a class="resource-card" href="https://www.novapage.online/showcase/" target="_blank" rel="noopener noreferrer">
            <span class="tag">SHOWCASE</span>
            <span class="title">演示案例</span>
            <span class="url">https://www.novapage.online/showcase/</span>
            <span class="hint">浏览设计、报告、飞轮、GEO、媒体与全案等实机成果样例</span>
          </a>
        </div>
      </section>

      <div class="footer-note">
        本文依据《NOVA AI 企业级全场景 AI 应用产品全景介绍（2026.8.11）》更新稿整理排版。正文论述保持原意；仅修正明显错别字、标点与残缺句式，并补充专业版式、架构/流程图与系统/官网全屏截图。配图为实机界面截取，图表为定性示意，不构成第三方产品实测评分。
      </div>
    </article>
  </div>
</body>
</html>
"""


# ---- DOCX helpers (compact reuse) ----

def set_run(run, *, size=11, bold=False, color=INK, font="微软雅黑"):
    run.font.name = font
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color


def shade_cell(cell, hex_color: str):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_cell_border(cell, color="D7DBE0"):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), color)
        tcBorders.append(el)
    tcPr.append(tcBorders)


def para_space(p, before=0, after=8, line=1.35):
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = line


def add_p(doc, text, *, size=11, bold=False, color=INK, before=0, after=8, align=None):
    p = doc.add_paragraph()
    para_space(p, before=before, after=after)
    if align is not None:
        p.alignment = align
    run = p.add_run(text)
    set_run(run, size=size, bold=bold, color=color)
    return p


def add_h2(doc, text):
    p = doc.add_paragraph()
    para_space(p, before=18, after=10)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "24")
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), "4A6FA5")
    pBdr.append(left)
    pPr.append(pBdr)
    run = p.add_run(text)
    set_run(run, size=15, bold=True, color=NOVA)


def add_h3(doc, text):
    add_p(doc, text, size=12.5, bold=True, color=NOVA, before=12, after=6)


def add_h4(doc, text):
    add_p(doc, text, size=11, bold=True, color=ACCENT, before=8, after=4)


def add_caption(doc, text):
    add_p(doc, text, size=9.5, color=MUTED, before=2, after=12, align=WD_ALIGN_PARAGRAPH.CENTER)


def add_image(doc, path: Path, width_cm=15.2):
    if not path.exists():
        add_p(doc, f"[缺图：{path.name}]", size=10, color=MUTED)
        return
    p = doc.add_paragraph()
    para_space(p, before=8, after=2)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Cm(width_cm))


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    r_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    new_run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "4A6FA5")
    rPr.append(color)
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rPr.append(u)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), "20")
    rPr.append(sz)
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), "微软雅黑")
    rFonts.set(qn("w:hAnsi"), "微软雅黑")
    rFonts.set(qn("w:eastAsia"), "微软雅黑")
    rPr.append(rFonts)
    new_run.append(rPr)
    text_el = OxmlElement("w:t")
    text_el.text = text
    new_run.append(text_el)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def fill_table(table, rows, header=True):
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = table.cell(i, j)
            cell.text = ""
            p = cell.paragraphs[0]
            para_space(p, before=2, after=2, line=1.25)
            run = p.add_run(val)
            is_header = header and i == 0
            set_run(
                run,
                size=9 if not is_header else 9.5,
                bold=is_header or j == 0,
                color=WHITE if is_header else (NOVA if j == 0 else INK),
            )
            set_cell_border(cell)
            if is_header:
                shade_cell(cell, HERO_BG)
            elif i % 2 == 1:
                shade_cell(cell, "F7F8FA")


def bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        para_space(p, before=1, after=3)
        set_run(p.add_run(item), size=11)


def build_docx():
    media = DIR / "media"
    charts = DIR / "charts"
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.6)
    section.right_margin = Cm(1.6)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.6)

    hero = doc.add_table(rows=1, cols=1)
    cell = hero.cell(0, 0)
    shade_cell(cell, HERO_BG)
    set_cell_border(cell, HERO_BG)
    p = cell.paragraphs[0]
    para_space(p, before=10, after=4)
    set_run(p.add_run("PRODUCT OVERVIEW · 2026.8"), size=9, bold=True, color=RGBColor(0xB8, 0xC4, 0xD4))
    p = cell.add_paragraph()
    para_space(p, before=4, after=6)
    set_run(p.add_run("NOVA AI 企业级全场景 AI 应用产品全景介绍"), size=18, bold=True, color=WHITE)
    p = cell.add_paragraph()
    para_space(p, before=2, after=4)
    set_run(p.add_run("定位：NOVA AI——标准化商用企业级全场景经营 AI 平台"), size=11, color=RGBColor(0xC9, 0xD0, 0xD8))
    p = cell.add_paragraph()
    para_space(p, before=6, after=10)
    set_run(
        p.add_run("文档日期：2026.8.11　｜　内容更新稿　｜　版式：Nova 石墨高级灰 · 专业阅读版"),
        size=9,
        color=RGBColor(0xAE, 0xB6, 0xC0),
    )

    add_p(
        doc,
        "当下 AI 普及化，市面上豆包等通用大模型主打个人轻量化办公、碎片化内容创作；而具备资金、技术实力的大型企业，全部自主投入人力、成本自研专属企业级 AI，不会直接使用公有通用 AI，背后存在四大刚需，也是企业级 AI 不可替代的核心价值：",
        before=12,
    )

    add_h2(doc, "企业级 AI 的四大刚需")
    for title, body in [
        (
            "沉淀企业自有数字资产，规避各层级人员变动造成业务断层",
            "通用公有 AI 的数据、项目资料、业务经验全部存储在第三方平台，核心员工出现升职、调岗、离职等情况，其核心业务数据如行业打法、客户逻辑、项目方案、管理经验会出现流失断层；自研企业级 AI 配套专属私有知识库，全公司经营数据、部门流程、历史项目永久留存企业自有体系，新人可依托 AI 快速承接工作，业务不会因人中断。",
        ),
        (
            "打通全部门业务链路，消除多工具数据孤岛",
            "企业分开采购多款单点 AI 工具会形成割裂烟囱，产品、市场、销售、财务数据互不互通，跨部门协作需要人工复制文件、重复录入信息；企业级全场景 AI 原生串联研发、营销、商务、财法、管理层完整经营流程，业务成果可一键跨部门流转，一套系统支撑全公司协同分工。",
        ),
        (
            "具备行业专家级研判能力，不止基础文本提效",
            "通用大模型仅作为文本助手，依赖使用者给出完整思路、详细提示词，只能做润色、套模板，产出上限由使用者自身专业水平决定；企业级 AI 内置对应部门资深专家逻辑，可自主完成市场研判、产品规划、财税风控、营销全案策划，主动拔高业务方案专业度。",
        ),
        (
            "数据安全合规可控，满足政企、金融、生产企业监管要求",
            "通用公有 AI 所有上传文档、对话记录外存第三方云端，财务报表、合同、核心商业方案存在泄露风险；企业级 AI 支持私有化本地部署、分级权限管控、全链路操作审计，敏感经营数据不出企业内网，适配高合规行业硬性标准。",
        ),
    ]:
        add_h3(doc, title)
        add_p(doc, body, size=10.5, color=MUTED)

    add_p(
        doc,
        "头部企业自研企业级 AI 成本极高、周期漫长，中小微企业、创业团队无力独立开发；同时不少大型企业自研仅覆盖基础内部办公，缺少深度营销、商机挖掘、政策申报、全链路成套物料产出等高阶能力。",
    )
    call = doc.add_table(rows=1, cols=1)
    c = call.cell(0, 0)
    shade_cell(c, CALL_BG)
    set_cell_border(c, "D5E0EE")
    p = c.paragraphs[0]
    para_space(p, before=6, after=6)
    set_run(p.add_run("市场定位："), size=11, bold=True, color=ACCENT)
    set_run(
        p.add_run(
            "NOVA AI 精准填补市场空白：面向大中小企业、一人创业团队提供开箱即用标准化企业级全场景 AI，同时支持按需定制开发。无需企业承担高额自研成本，即可拥有完整、打通端到端经营流程的企业 AI 能力，补齐自研覆盖不全、小微无力研发的市场缺口。"
        ),
        size=11,
    )

    add_image(doc, media / "05-site-home.png")
    add_caption(doc, "图 1　产品官网首页（全屏）——对话驱动的企业级 Agent 平台入口")
    add_image(doc, media / "01-login-hero.png")
    add_caption(doc, "图 2　产品登录入口（全屏）——进入企业级智能体工作台")

    add_h2(doc, "一、什么是真正的企业级 AI：NOVA AI VS 豆包（大众 C 端通用 AI）基础维度对比")
    add_p(
        doc,
        "市面 99% AI 产品聚焦 To C 个人赛道，豆包属于典型大众通用 AI，仅解决单人碎片化需求；NOVA AI 纯卡位企业经营赛道，二者底层定位、架构、服务逻辑存在本质区别，详见下表：",
    )
    add_p(doc, "表格 1　企业级 NOVA AI vs 大众版豆包 基础定位对比", size=9.5, color=MUTED, after=4)
    t1 = [
        ["对比维度", "NOVA AI（纯正企业级全场景 AI）", "豆包（大众 C 端通用 AI）"],
        [
            "服务对象",
            "大型企业、中小企业、一人公司、完整组织团队、企业管理层，服务整套经营主体",
            "个人普通用户、职场单人，仅服务独立个体，无组织协同设计",
        ],
        [
            "产品架构",
            "原生企业协同流转架构，全部门总监级智能体配套，多 Agent 统一目标管控；支持私有化部署、多租户数据隔离、分级权限、企业私有知识库、跨部门任务自动流转",
            "轻量化单点工具架构，无企业部门分层、协同底层；无私有化部署、企业知识库、权限管控、业务流转模块，会话完全独立隔离",
        ],
        [
            "能力逻辑",
            "复刻完整企业端到端经营闭环，预埋各行业总监级专业业务模型、合规标准、爆款营销体系；零提示词依赖，一句需求即可输出成套专业落地成果；项目任务一键跨部门流转",
            "通用通识生成逻辑，无垂直企业经营底层模型；产出质量完全依赖用户提示词水平，仅做文字基础加工；无跨部门自动流转，多任务产出零散割裂",
        ],
        [
            "落地场景",
            "全链路商业闭环：产品调研规划→营销全案成套产出→法务合规审核→全域投放分发→精准商机获客→财税风控核算→政策申报→经营数据复盘",
            "个人碎片化场景：闲聊、短文写作、简单文档、学习、娱乐，无法承接完整企业商业项目",
        ],
        [
            "专业技能",
            "营销、产品、销售、财税法务、经营管理多维度专家级研判，可自主完成数据分析、策略制定、风险筛查、补贴测算等高阶商业工作",
            "仅基础文字问答、简单计算、浅层文案润色，无企业经营、全域营销、财税风控、产品规划专业能力",
        ],
    ]
    table = doc.add_table(rows=len(t1), cols=3)
    fill_table(table, t1)
    add_image(doc, charts / "compare-bars.png", 14.5)
    add_caption(doc, "图 3　能力维度对照（定性示意）")

    add_h3(doc, "赛道核心差异总结")
    bullets(
        doc,
        [
            "豆包：个人辅助工具，核心作用提升单人文字工作效率，产出上限取决于使用者自身专业能力；",
            "NOVA AI：企业一体化经营系统，核心作用以行业专家视角全盘承接企业经营全流程，不只是简单提效，更能输出高于普通员工水平的专业策略方案。",
        ],
    )
    add_h3(doc, "产品愿景")
    add_p(
        doc,
        "降低企业级 AI 定制与使用门槛，让标准化、完整闭环、专家级能力的企业 AI 助力每一位经营者；无论大企业、小微企业、个体创业者，都能低成本拥有对标集团级完整经营 AI 体系。",
    )
    add_image(doc, media / "02-workbench-chat.png")
    add_caption(doc, "图 4　统一工作台（全屏）")
    add_image(doc, charts / "architecture.png", 15.0)
    add_caption(doc, "图 5　平台架构逻辑视图")

    add_h2(doc, "二、NOVA AI 四大核心差异化壁垒（突出全场景端到端业务闭环核心优势）")
    add_p(
        doc,
        "通用大模型、简易企业工具普遍存在功能碎片化、无专业研判、流程割裂、产出零散四大短板，NOVA AI 搭建独家壁垒，实现全方位差异化：",
    )
    add_p(doc, "壁垒一", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "打破工具孤岛，原生支持跨部门业务自动流转，形成完整经营闭环")
    add_p(
        doc,
        "普通 AI 工具各模块相互独立，产品、营销、法务、销售之间资料需要人工复制导出；NOVA AI 打通全业务链路，实现一站式流转：",
    )
    add_p(doc, "完整端到端业务落地流程：", bold=True, after=4)
    bullets(
        doc,
        [
            "产品研发智能体自动抓取竞品、用户口碑、行业技术，以产品总监视角输出新品规划 / 迭代方案；",
            "方案确认后一键流转至营销智能体，自动生成品牌定位、文案、短视频脚本、活动全案、PPT、配套配图、大 V 仿写全套物料；",
            "营销物料自动推送法务智能体，筛查违规广告词、宣传法律风险，输出整改意见；",
            "合规校验完成后，一键适配全平台短视频、自媒体平台，批量规划全域内容分发投放；",
            "同步销售智能体全网挖掘精准商业线索，分层筛选高意向客户，配套销冠谈判成交话术；",
            "全流程经营数据同步财务智能体，自动对账、筛查税务风险，匹配各级产业补贴并生成全套申报材料；",
            "所有经营数据汇总至管理层数据驾驶舱，自动完成经营诊断、输出中长期战略优化方案。",
        ],
    )
    add_p(
        doc,
        "整套流程无需人工反复切换工具、传递文件，从产品构思到营销落地、获客成交、合规风控、经营复盘一站式闭环落地。",
    )
    add_image(doc, charts / "flow-e2e.png", 15.0)
    add_caption(doc, "图 6　端到端经营闭环")

    add_p(doc, "壁垒二", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "全部门完整覆盖，无需二次开发，开箱即用标准化企业经营体系")
    add_p(
        doc,
        "市面同类产品大多只覆盖单一板块（仅营销、仅办公、仅财务）；NOVA AI 一次性配齐产品、营销、销售、行政、财务法务、决策全职能智能体，完整复刻成熟企业全部经营逻辑，中小企业无需自研、无需外包搭建流程，直接落地整套企业 AI 系统。",
    )
    add_p(doc, "壁垒三", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "零“提示词”门槛，内置总监级专家模型，产出质量高于个体员工")
    add_p(
        doc,
        "豆包等通用 AI 是“助手型工具”：需要用户提供完整思路、框架、行业信息，AI 仅做文字优化，只能辅助提速，无法拔高专业度；",
    )
    add_p(
        doc,
        "NOVA AI 预埋各行业资深总监完整业务逻辑、合规标准、成熟行业打法，形成“全案模板”。用户仅需简单一句业务需求，AI 自主完成深度数据研判、策略规划，以专家视角输出高阶落地方案，产出专业度可超越一般岗位个体员工，彻底摆脱提示词依赖、解决“人决定产出水平”的痛点。",
    )
    add_p(doc, "壁垒四", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "多 Agent 统一目标管控，一次性成套输出全品类落地物料")
    add_p(
        doc,
        "普通多智能体工具各模块目标割裂，一套方案需要分多次生成文档、PPT、表格、配图；NOVA AI 同一项目下所有智能体实时校准统一目标，同步批量输出 Word 方案、汇报 PPT、宣传配图、执行清单、数据测算表、申报文书全套物料，产出完整成套，拿来即可直接用于宣传、汇报、商务、申报场景。",
    )
    add_image(doc, media / "04-marketing-flywheel.png")
    add_caption(doc, "图 7　能力中心（全屏）")

    add_h2(doc, "三、全部门总监级专家智能体功能详解")
    add_p(
        doc,
        "依托四大核心壁垒，NOVA AI 为企业每个核心职能部门配备虚拟专家智能体，区别于豆包仅做基础文字辅助，所有模块均具备自主分析、策略输出、业务流转的专家级能力，下表直观对比各模块功能差距：",
    )
    add_p(doc, "表格 2　NOVA AI 各部门专家智能体 VS 豆包（大众 AI）分模块功能对比", size=9.5, color=MUTED, after=4)
    t2 = [
        ["业务部门", "NOVA AI（总监级专家智能体核心能力）", "核心优势总结", "豆包（大众通用 AI 功能上限）"],
        [
            "产品与研发（产品总监）",
            "自动抓取竞品、专利、全网用户痛点，量化分析并输出新品 / 迭代专业方案；成果一键流转营销模块启动包装策划",
            "具备三维市场研判能力，打通产品到营销完整业务链路，主动输出高阶产品规划",
            "仅能整理用户手动提供的零散信息，无法自主抓取行业数据，不能主动输出产品策略，无跨部门流转通道",
        ],
        [
            "市场营销（营销总监・核心强项）",
            "内置全赛道爆款营销底层逻辑；一键成套产出文案、脚本、活动全案、PPT、配图、大 V 仿写；全平台投放适配；7×24 舆情监控 + 公关方案",
            "营销模块深度垂直行业训练，从策略、成套物料、投放、舆情全链路专家操盘，是核心差异化强项",
            "仅生成基础通用文字，需多次分指令生成 PPT、配图；无流量投放模型，无全自动舆情预警",
        ],
        [
            "销售商务（顶尖销冠顾问）",
            "全网自动挖掘、分层筛选精准商机；实时追踪客户经营动态，生成客户背调、定制成交谈判策略",
            "主动挖掘高价值客户，预判合作窗口期，全流程辅助成交转化",
            "无法自主抓取商业线索，仅能基于用户输入简单撰写话术",
        ],
        [
            "行政办公（综合管理顾问）",
            "公文、周报、审批自动化标准化处理；配套企业私有知识库沉淀组织经验，新人快速上手",
            "适配企业内部标准化管理，永久留存企业数字资产，解决人员流失经验断层问题",
            "仅简单文字润色，无企业标准化文书体系，无私有企业知识库",
        ],
        [
            "管理层决策（经营管理顾问）",
            "整合全业务数据生成可视化数据驾驶舱；结合企业历史 + 行业对标输出经营诊断、中长期战略方案",
            "实现数据驱动经营复盘，替代人工月度季度报表复盘，辅助管理层科学决策",
            "无法对接企业经营数据，仅能做简单数字计算，无经营分析、战略规划能力",
        ],
        [
            "财务 & 法务（财税 + 法务双总监）",
            "实时同步财税、广告合规法规；自动对账、筛查税务 / 宣传风险；匹配产业补贴，生成全套申报材料",
            "全业务前置主动风控，补齐中小企业高端财法人才缺口",
            "仅基础数字计算、简单合同文字校对，无合规筛查、补贴测算、申报文书生成能力",
        ],
        [
            "全公司通用保障",
            "私有化部署、多租户隔离、分级权限、全链路操作审计，企业敏感数据本地留存",
            "满足央企、政企、金融等高等级数据合规监管要求",
            "无私有化、企业数据隔离、权限管控能力，数据全部上传公有云端",
        ],
    ]
    table2 = doc.add_table(rows=len(t2), cols=4)
    fill_table(table2, t2)

    add_h3(doc, "各模块简要说明（精简无重复，突出专家属性与流转能力）")
    for title, body in [
        (
            "市场与营销（核心优势板块）",
            "作为产品核心强项模块，可承接上游产品方案，一键输出品牌定位、宣传策略及完整整合营销全案，方案内同步覆盖线上线下全媒介物料制作需求，包含各渠道图文、短视频、宣传海报、户外广告、TVC、病毒视频、线下活动全流程脚本与执行方案。内容创作依托各大赛道头部大 V 爆款逻辑合规仿写，产出内容更贴合平台流量规则，数据表现优于普通自主原创文案。全套物料自动推送法务完成合规校验，审核通过后可一键完成全域渠道分发投放。搭配 7×24 小时全网舆情实时监测，实时捕捉品牌口碑与行业动态，出现负面风险自动预警，并同步给出营销方案优化、公关应对调整建议，形成从策划、物料产出、全域投放到舆情优化的完整营销闭环。",
        ),
        (
            "产品研发",
            "自主完成竞品、用户、技术三维深度分析，输出可落地新品迭代方案，成果直接流转营销端启动品牌包装，打通企业产品开发到市场化完整链路，通用 AI 无数据抓取、策略输出、业务流转能力。",
        ),
        (
            "销售商务",
            "主动挖掘全网商业线索，筛选高意向客户，同步追踪客户动态，可一键生成应标书并配套销冠级成交策略，覆盖营销后的客户转化全流程，通用 AI 仅能被动撰写沟通话术。",
        ),
        (
            "行政办公",
            "自动化处理企业重复性办公事务，依托私有知识库沉淀企业专属制度、项目经验，解决人员流失带来的业务断层，通用 AI 无企业资产留存体系。",
        ),
        (
            "管理层决策",
            "整合全公司营销、销售、财务数据形成可视化驾驶舱，自主诊断经营短板、输出中长期战略建议，通用 AI 不具备企业经营数据分析能力。",
        ),
        (
            "财务 & 法务",
            "贯穿全业务前置合规风控，营销产出物料自动筛查宣传违规风险，自动完成账务整理、税务预警、产业补贴申报全套工作，补齐中小团队缺少财税、法务专家的短板。",
        ),
        (
            "全公司安全保障",
            "私有化部署、分级权限管控、操作审计等企业专属安全能力，适配涉密经营主体，公有通用 AI 无法满足企业数据合规需求。",
        ),
    ]:
        add_h3(doc, title)
        add_p(doc, body)

    add_h2(doc, "四、合作方式")
    add_p(doc, "三种模式，灵活选择：")
    bullets(
        doc,
        [
            "NOVA AI 标准化成品订阅/部署：现有产品开箱即用，支持SaaS订阅或本地私有化部署",
            "驻场式AI升级服务：团队入驻企业，从梳理痛点到输出完整落地方案，手把手落地",
            "专属定制开发：根据个性化需求，从零定制开发",
        ],
    )

    add_image(doc, media / "07-showcase-home.png")
    add_caption(doc, "图 8　官网演示案例首页（全屏）——放在「五、服务案例」之前")

    add_h2(doc, "五、服务案例")
    for cased in CASES:
        add_h3(doc, cased["title"])
        add_p(doc, cased["who"], size=10.5, color=MUTED)
        add_h4(doc, "客户痛点")
        bullets(doc, cased["pain"])
        add_h4(doc, "我们部署了什么")
        bullets(doc, cased["deploy"])
        add_h4(doc, "解决了什么问题")
        bullets(doc, cased["solve"])
        add_h4(doc, "落地成效")
        bullets(doc, cased["effect"])

    add_h2(doc, "六、我们的技术底子")
    bullets(
        doc,
        [
            "全球主流AI模型一池统管：集成OpenAI、Claude、智谱、文心、通义等国内外所有主流模型，按任务自动选最优模型——您不用纠结用哪个，我们帮您选对",
            "365+项能力开箱即用：文案、图像、视频、语音、数据分析……不需要开发，直接调用",
            "主从式多Agent协同架构：一个总Agent统筹任务，多个子Agent分工执行，兼顾统一度和效率",
            "智能路由省Token：自动选择性价比最高的模型，帮您省下30%~50%的API调用成本",
            "四层企业级安全防护：对标银行标准，多租户隔离、权限沙箱、临时任务痕迹自动清除、全链路审计",
        ],
    )
    add_image(doc, media / "06-site-token70.png")
    add_caption(doc, "图 9　官网「智能路由 / 节省约 70% Token」专屏（全屏）")

    add_h2(doc, "七、合作价值")
    add_p(doc, "把省下来的时间、人力、成本，变成实实在在的增长！", bold=True)
    add_p(doc, "我们不只是AI供应商，更是长期陪跑的伙伴。")
    add_p(doc, "携手共建企业AI新生态，期待与您深度合作。")

    add_h2(doc, "进一步了解")
    add_p(doc, "如需查阅产品官网、完整白皮书或在线演示案例，可通过以下官方入口访问（与主站同源发布）：", size=10.5, color=MUTED)
    for title, url, hint in [
        ("产品官网", "https://www.novapage.online/", "了解平台定位、核心能力与企业级应用场景"),
        ("产品白皮书", "https://www.novapage.online/docs/", "阅读选型、私有化、Token 与竞品对照等完整说明"),
        ("演示案例", "https://www.novapage.online/showcase/", "浏览设计、报告、飞轮、GEO、媒体与全案等实机成果样例"),
    ]:
        p = doc.add_paragraph()
        para_space(p, before=6, after=2)
        set_run(p.add_run(f"{title}　"), size=11, bold=True, color=NOVA)
        add_hyperlink(p, url, url)
        add_p(doc, hint, size=9.5, color=MUTED, before=0, after=6)

    add_p(
        doc,
        "本文依据《NOVA AI 企业级全场景 AI 应用产品全景介绍（2026.8.11）》更新稿整理排版。正文论述保持原意；仅修正明显错别字、标点与残缺句式，并补充专业版式、架构/流程图与系统/官网全屏截图。",
        size=9,
        color=MUTED,
        before=16,
    )

    doc.save(DOCX_OUT)
    print(f"DOCX {DOCX_OUT} {DOCX_OUT.stat().st_size}")


def main():
    HTML_OUT.write_text(build_html(), encoding="utf-8")
    print(f"HTML {HTML_OUT} {HTML_OUT.stat().st_size}")
    build_docx()


if __name__ == "__main__":
    main()
