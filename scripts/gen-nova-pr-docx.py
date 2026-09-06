#!/usr/bin/env python3
"""Generate Nova product overview Word (.docx) matching HTML/PDF content & graphite style."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "artifacts" / "nova-product-pr-20260812"
OUT = DIR / "nova-ai-product-overview.docx"

INK = RGBColor(0x1C, 0x1F, 0x24)
MUTED = RGBColor(0x5C, 0x65, 0x70)
NOVA = RGBColor(0x3D, 0x44, 0x50)
ACCENT = RGBColor(0x4A, 0x6F, 0xA5)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
HEADER_BG = "EEF1F5"
HERO_BG = "2A2F38"
CALL_BG = "E8EEF6"


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
    return p


def add_h3(doc, text):
    return add_p(doc, text, size=12.5, bold=True, color=NOVA, before=12, after=6)


def add_caption(doc, text):
    return add_p(doc, text, size=9.5, color=MUTED, before=2, after=12, align=WD_ALIGN_PARAGRAPH.CENTER)


def add_image(doc, path: Path, width_cm=15.5):
    if not path.exists():
        add_p(doc, f"[缺图：{path.name}]", size=10, color=MUTED)
        return
    p = doc.add_paragraph()
    para_space(p, before=8, after=2)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(str(path), width=Cm(width_cm))


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
                size=9.5 if not is_header else 10,
                bold=is_header or j == 0,
                color=WHITE if is_header else (NOVA if j == 0 else INK),
            )
            set_cell_border(cell)
            if is_header:
                shade_cell(cell, HERO_BG)
            elif i % 2 == 1:
                shade_cell(cell, "F7F8FA")


def add_bullet(doc, lead: str, body: str):
    p = doc.add_paragraph(style="List Bullet")
    para_space(p, before=2, after=4, line=1.35)
    r1 = p.add_run(lead)
    set_run(r1, size=11, bold=True, color=INK)
    r2 = p.add_run(body)
    set_run(r2, size=11, color=INK)


def build():
    media = DIR / "media"
    charts = DIR / "charts"

    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.8)

    # Cover / hero block
    hero = doc.add_table(rows=1, cols=1)
    cell = hero.cell(0, 0)
    shade_cell(cell, HERO_BG)
    set_cell_border(cell, HERO_BG)
    p = cell.paragraphs[0]
    para_space(p, before=10, after=4)
    r = p.add_run("PRODUCT OVERVIEW · 2026.8")
    set_run(r, size=9, bold=True, color=RGBColor(0xB8, 0xC4, 0xD4))

    p = cell.add_paragraph()
    para_space(p, before=4, after=6)
    r = p.add_run("NOVA AI 企业级全场景 AI 应用产品全景介绍")
    set_run(r, size=20, bold=True, color=WHITE)

    p = cell.add_paragraph()
    para_space(p, before=2, after=4)
    r = p.add_run("定位：NOVA AI——标准化商用企业级全场景经营 AI 平台")
    set_run(r, size=11, color=RGBColor(0xC9, 0xD0, 0xD8))

    p = cell.add_paragraph()
    para_space(p, before=6, after=10)
    r = p.add_run("文档日期：2026.8.11　｜　版本用途：产品介绍 / PR　｜　版式：Nova 石墨高级灰 · 专业阅读版")
    set_run(r, size=9, color=RGBColor(0xAE, 0xB6, 0xC0))

    add_p(
        doc,
        "目录：企业级 AI 四大刚需　｜　NOVA AI vs 大众通用 AI　｜　四大核心差异化壁垒　｜　全部门专家智能体",
        size=9.5,
        color=MUTED,
        before=12,
        after=10,
    )

    add_p(
        doc,
        "当下 AI 普及化，市面上豆包等通用大模型主打个人轻量化办公、碎片化内容创作；而具备资金、技术实力的大型企业，全部自主投入人力、成本自研专属企业级 AI，不会直接使用公有通用 AI，背后存在四大刚需，也是企业级 AI 不可替代的核心价值：",
    )

    add_h2(doc, "企业级 AI 的四大刚需")

    needs = [
        (
            "沉淀企业自有数字资产，规避造成业务断层",
            "通用公有 AI 的数据、项目资料、业务经验全部存储在第三方平台，核心员工行业打法、客户逻辑、项目方案会流失；自研企业级 AI 配套专属私有知识库，全公司经营数据、部门流程、历史项目永久留存企业自有体系，新人可依托 AI 快速承接工作，业务不会因人中断。",
        ),
        (
            "打通全部门业务链路，消除多工具数据孤岛",
            "企业分开采购多款单点 AI 工具会形成割裂烟囱，产品、市场、销售、财务数据互不互通，跨部门协作需要人工复制文件、重复录入信息；企业级全场景 AI 原生串联研发、营销、商务、财法、管理层完整经营流程，业务成果可一键跨部门流转，一套系统支撑全公司协同分工。",
        ),
        (
            "具备行业专家级研判能力，不止基础提效",
            "通用大模型仅作为助手，依赖使用者给出完整思路、详细提示词，只能做润色、套模板，产出上限由使用者自身专业水平决定；企业级 AI 内置对应部门资深专家逻辑，可自主完成市场研判、产品规划、财税风控、营销全案策划，主动拔高业务方案专业度。",
        ),
        (
            "数据安全合规可控，满足政企、金融、生产企业监管要求",
            "通用公有 AI 所有上传文档、对话记录外存第三方云端，财务报表、合同、核心商业方案存在泄露风险；企业级 AI 支持私有化本地部署、分级权限管控、全链路操作审计，敏感经营数据不出企业内网，适配高合规行业硬性标准。",
        ),
    ]
    for title, body in needs:
        add_h3(doc, title)
        add_p(doc, body, size=10.5, color=MUTED, after=8)

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
    r = p.add_run("市场定位：")
    set_run(r, size=11, bold=True, color=ACCENT)
    r = p.add_run(
        "NOVA AI 精准填补市场空白：面向大中小企业、一人创业团队提供开箱即用标准化企业级全场景 AI，同时支持按需定制开发。无需企业承担高额自研成本，即可拥有完整、打通端到端经营流程的企业 AI 能力，补齐自研覆盖不全、小微无力研发的市场缺口。"
    )
    set_run(r, size=11, color=INK)

    add_image(doc, media / "01-login-hero.png", 15.2)
    add_caption(doc, "图 1　产品入口（登录页全屏）——对话驱动的企业级智能体工作台")

    add_h2(
        doc,
        "一、什么是真正的企业级 AI：NOVA AI VS 豆包（大众 C 端通用 AI）基础维度对比",
    )
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
    table.autofit = True
    fill_table(table, t1)

    add_image(doc, charts / "compare-bars.png", 14.5)
    add_caption(
        doc,
        "图 2　能力维度对照（定性示意）：组织协同、经营闭环、专家研判、成套物料、安全合规、零提示词落地",
    )

    add_h3(doc, "赛道核心差异总结")
    add_bullet(
        doc,
        "豆包：",
        "个人辅助工具，核心作用提升单人文字工作效率，产出上限取决于使用者自身专业能力；",
    )
    add_bullet(
        doc,
        "NOVA AI：",
        "企业一体化经营系统，核心作用以行业专家视角全盘承接企业经营全流程，不只是简单提效，更能输出高于普通员工水平的专业策略方案。",
    )

    add_h3(doc, "产品愿景")
    add_p(
        doc,
        "降低企业级 AI 定制与使用门槛，让标准化、完整闭环、专家级能力的企业 AI 惠及每一位经营者；无论大企业、小微企业、个体创业者，都能低成本拥有对标集团级完整经营 AI 体系。",
    )

    add_image(doc, media / "02-workbench-chat.png", 15.2)
    add_caption(doc, "图 3　统一工作台（全屏）——以对话承接复杂经营任务，连接能力中心与成果交付")

    add_image(doc, charts / "architecture.png", 15.0)
    add_caption(
        doc,
        "图 4　平台架构逻辑视图：工作台与能力中心之上，是各部门总监级智能体与统一目标管控；底层为私有知识库、权限审计与私有化部署",
    )

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
    for item in [
        "产品研发智能体自动抓取竞品、用户口碑、行业技术，以产品总监视角输出新品规划 / 迭代方案；",
        "方案确认后一键流转至营销智能体，自动生成品牌定位、文案、短视频脚本、活动全案、PPT、配套配图、大 V 仿写全套物料；",
        "营销物料自动推送法务智能体，筛查违规广告词、宣传法律风险，输出整改意见；",
        "合规校验完成后，一键适配全平台短视频、自媒体平台，批量规划全域内容分发投放；",
        "同步销售智能体全网挖掘精准商业线索，分层筛选高意向客户，配套销冠谈判成交话术；",
        "全流程经营数据同步财务智能体，自动对账、筛查税务风险，匹配各级产业补贴并生成全套申报材料；",
        "所有经营数据汇总至管理层数据驾驶舱，自动完成经营诊断、输出中长期战略优化方案。",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        para_space(p, before=1, after=3)
        r = p.add_run(item)
        set_run(r, size=11)
    add_p(
        doc,
        "整套流程无需人工反复切换工具、传递文件，从产品构思到营销落地、获客成交、合规风控、经营复盘一站式闭环落地。",
    )

    add_image(doc, charts / "flow-e2e.png", 15.0)
    add_caption(
        doc,
        "图 5　端到端经营闭环：产品研发 → 市场营销 → 法务合规 → 全域分发 → 销售获客 → 财务风控 → 经营驾驶舱",
    )

    add_p(doc, "壁垒二", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "全部门完整覆盖，无需二次开发，开箱即用标准化企业经营体系")
    add_p(
        doc,
        "市面同类产品大多只覆盖单一板块（仅营销、仅办公、仅财务）；NOVA AI 一次性配齐产品、营销、销售、行政、财务法务、决策全职能智能体，完整复刻成熟企业全部经营逻辑，中小企业无需自研、无需外包搭建流程，直接落地整套企业 AI 系统。",
    )

    add_p(doc, "壁垒三", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "零提示词门槛，内置总监级专家模型，产出质量高于员工")
    add_p(
        doc,
        "豆包等通用 AI 是“助手型工具”：需要用户提供完整思路、框架、行业信息，AI 仅做文字优化，只能辅助提速，无法拔高专业度；",
    )
    add_p(
        doc,
        "NOVA AI 预埋各行业资深总监完整业务逻辑、合规标准、成熟行业打法，用户仅需简单一句业务需求，AI 自主完成深度数据研判、策略规划，以专家视角输出高阶落地方案，产出专业度可超越岗位员工，彻底摆脱提示词依赖、解决“人决定产出水平”的痛点。",
    )

    add_p(doc, "壁垒四", size=10, bold=True, color=ACCENT, before=10, after=2)
    add_h3(doc, "多 Agent 统一目标管控，一次性成套输出全品类落地物料")
    add_p(
        doc,
        "普通多智能体工具各模块目标割裂，一套方案需要分多次生成文档、PPT、表格、配图；NOVA AI 同一项目下所有智能体实时校准统一目标，同步批量输出 Word 方案、汇报 PPT、宣传配图、执行清单、数据测算表、申报文书全套物料，产出完整成套，拿来即可直接用于宣传、汇报、商务、申报场景。",
    )

    add_image(doc, media / "04-marketing-flywheel.png", 15.2)
    add_caption(doc, "图 6　能力中心（全屏）——按经营阶段组织的专家能力与全案模板入口")

    add_h2(doc, "三、全部门总监级专家智能体功能详解")
    add_p(
        doc,
        "依托四大核心壁垒，NOVA AI 为企业每个核心职能部门配备虚拟专家智能体，区别于豆包仅做基础文字辅助，所有模块均具备自主分析、策略输出、业务流转的专家级能力，下表直观对比各模块功能差距：",
    )
    add_p(
        doc,
        "表格 2　NOVA AI 各部门专家智能体 VS 豆包（大众 AI）分模块功能对比",
        size=9.5,
        color=MUTED,
        after=4,
    )

    t2 = [
        ["业务部门", "NOVA AI（总监级专家智能体核心能力）", "核心优势总结"],
        [
            "产品与研发（产品总监）",
            "自动抓取竞品、专利、全网用户痛点，量化分析并输出新品 / 迭代专业方案；成果一键流转营销模块启动包装策划",
            "具备三维市场研判能力，打通产品到营销完整业务链路，主动输出高阶产品规划",
        ],
        [
            "市场营销（营销总监・核心强项）",
            "内置全赛道爆款营销底层逻辑；一键成套产出文案、脚本、活动全案、PPT、配图、大 V 仿写；全平台投放适配；7×24 舆情监控 + 公关方案",
            "营销模块深度垂直行业训练，从策略、成套物料、投放、舆情全链路专家操盘，是核心差异化强项",
        ],
        [
            "销售商务（顶尖销冠顾问）",
            "全网自动挖掘、分层筛选精准商机；实时追踪客户经营动态，生成客户背调、定制成交谈判策略",
            "主动挖掘高价值客户，预判合作窗口期，全流程辅助成交转化",
        ],
        [
            "行政办公（综合管理顾问）",
            "公文、周报、审批自动化标准化处理；配套企业私有知识库沉淀组织经验，新人快速上手",
            "适配企业内部标准化管理，永久留存企业数字资产，解决人员流失经验断层问题",
        ],
        [
            "管理层决策（经营管理顾问）",
            "整合全业务数据生成可视化数据驾驶舱；结合企业历史 + 行业对标输出经营诊断、中长期战略方案",
            "实现数据驱动经营复盘，替代人工月度季度报表复盘，辅助管理层科学决策",
        ],
        [
            "财务 & 法务（财税 + 法务双总监）",
            "实时同步财税、广告合规法规；自动对账、筛查税务 / 宣传风险；匹配产业补贴，生成全套申报材料",
            "全业务前置主动风控，补齐中小企业高端财法人才缺口",
        ],
        [
            "全公司通用保障",
            "私有化部署、多租户隔离、分级权限、全链路操作审计，企业敏感数据本地留存",
            "满足央企、政企、金融等高等级数据合规监管要求",
        ],
    ]
    table2 = doc.add_table(rows=len(t2), cols=3)
    fill_table(table2, t2)

    add_h3(doc, "各模块简要说明（精简无重复，突出专家属性与流转能力）")

    modules = [
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
    ]
    for title, body in modules:
        add_h3(doc, title)
        add_p(doc, body)

    # Resources
    add_h2(doc, "进一步了解")
    add_p(
        doc,
        "如需查阅产品官网、完整白皮书或在线演示案例，可通过以下官方入口访问（与主站同源发布）：",
        size=10.5,
        color=MUTED,
    )

    resources = [
        ("产品官网", "https://www.novapage.online/", "了解平台定位、核心能力与企业级应用场景"),
        ("产品白皮书", "https://www.novapage.online/docs/", "阅读选型、私有化、Token 与竞品对照等完整说明"),
        ("演示案例", "https://www.novapage.online/showcase/", "浏览设计、报告、飞轮、GEO、媒体与全案等实机成果样例"),
    ]
    for title, url, hint in resources:
        p = doc.add_paragraph()
        para_space(p, before=6, after=2)
        r = p.add_run(f"{title}　")
        set_run(r, size=11, bold=True, color=NOVA)
        add_hyperlink(p, url, url)
        p2 = doc.add_paragraph()
        para_space(p2, before=0, after=6)
        r = p2.add_run(hint)
        set_run(r, size=9.5, color=MUTED)

    add_p(
        doc,
        "本文依据《NOVA AI 企业级全场景 AI 应用产品全景介绍（2026.8.11）》整理排版。正文论述保持原意；仅修正明显错别字、标点与残缺句式，并补充专业版式、架构/流程图与系统全屏截图。配图为实机界面截取，图表为定性示意，不构成第三方产品实测评分。",
        size=9,
        color=MUTED,
        before=16,
        after=4,
    )

    doc.save(OUT)
    print(f"DOCX {OUT} {OUT.stat().st_size}")


if __name__ == "__main__":
    build()
