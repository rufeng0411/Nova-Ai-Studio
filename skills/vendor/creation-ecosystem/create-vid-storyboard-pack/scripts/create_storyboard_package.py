#!/usr/bin/env python3
"""Create a SceneDance/Seedance continuity-first storyboard package skeleton."""

from __future__ import annotations

import argparse
from pathlib import Path


def write_file(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def make_context(args: argparse.Namespace) -> dict[str, str]:
    return {
        "slug": args.slug,
        "title": args.title or args.slug,
        "duration": args.duration or "待确认",
        "aspect": args.aspect or "待确认",
        "video_type": args.video_type or "待确认",
    }


def render_project_brief(ctx: dict[str, str]) -> str:
    return f"""
# 项目简报

| 字段 | 内容 |
| --- | --- |
| 项目 ID | `{ctx["slug"]}` |
| 项目名称 | {ctx["title"]} |
| 视频类型 | {ctx["video_type"]} |
| 目标时长 | {ctx["duration"]} |
| 画幅 | {ctx["aspect"]} |
| 平台 / 用途 | 待确认 |
| 核心受众 | 待确认 |
| 叙事目标 | 待确认 |
| 风格参考 | 待确认 |
| SceneDance 约束 | 每个 clip 最长 15 秒；新项目默认 `SH### = CLIP###`；时长按剧情和动作复杂度决定 |
| 输出范围 | 完整制作包：剧本分析、bible、连续性圣经、shot cards、参考图组合、Img2 中英文提示词、SceneDance shot 提示词、剪辑清单、风险备用 |
"""


SCRIPT_TEMPLATE = """
# 原始剧本

在这里粘贴用户剧本、产品 brief、旁白、对白或创意描述。
"""


SCRIPT_ANALYSIS = """
# 剧本分析

| 场次 | 剧情 Beat | 情绪变化 | 关键动作 | 关键信息 | 建议镜头策略 | 潜在剪辑点 / 接力点 |
| --- | --- | --- | --- | --- | --- | --- |
| SC01 | 待补充 | 待补充 | 待补充 | 待补充 | 建立镜头 / 反打 / 插入 / 反应 / 空镜 / 前景遮挡 / 跟拍入场 | 动作切 / 视线切 / 声音桥 / 遮挡切 / 光线或空间接力 |

## 生成风险预判

| 风险点 | 涉及场次/角色 | 原因 | 预防方式 |
| --- | --- | --- | --- |
| 身份漂移 | 待补充 | 多片段独立生成 | 角色 360、表情表、关键帧锁定 |
| 动作断裂 | 待补充 | 跨 clip 连续动作 | 设计动作接点、插入镜头或反应镜头 |
| 空间跳变 | 待补充 | 场景方向不清 | 场景建立图、反打图、180 度轴线锁定 |
| 接力失败 | 待补充 | 前一 clip 尾部没有递出下一空间或视觉线索 | 设计 handoff，使用遮挡、光线、道具、UI 或声音桥 |
"""


CHARACTER_BIBLE = """
# 角色 Bible

| 角色 ID | 角色名 | 年龄/身份 | 面部识别点 | 发型/妆容 | 服装锁定 | 体态/动作习惯 | 表演关键词 | 禁止变化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C001 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 不换脸、不换发型、不换服装 |
"""


PRODUCT_PROP_BIBLE = """
# 产品 / 道具 Bible

| 道具 ID | 名称 | 类型 | 外观锁定 | 材质/颜色 | 尺寸关系 | 使用方式 | 镜头重点 | 禁止变化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P001 | 待补充 | 产品 / 道具 / 武器 / 载具 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 不变形、不改颜色、不改 logo |
"""


SCENE_BIBLE = """
# 场景 Bible

| 场景 ID | 场景名 | 时间状态 | 天气/环境 | 光线 | 空间布局 | 主机位方向 | 关键物件位置 | 禁止变化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S001 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | 不跳光、不改空间结构 |
"""


STYLE_BIBLE = """
# 风格 Bible

| 维度 | 设定 |
| --- | --- |
| 影像风格 | 待补充 |
| 色彩 | 待补充 |
| 光线 | 待补充 |
| 镜头语言 | 待补充 |
| 质感 | 待补充 |
| 画幅 | 待确认 |
| 全局负面约束 | 不换脸，不换衣服，不改产品包装，不要错乱手指，不要文字乱码，不要水印 |
"""


CONTINUITY_BIBLE = """
# 连续性圣经

| 连续性维度 | 锁定内容 | 影响镜头 | 检查方法 |
| --- | --- | --- | --- |
| 人物外貌 | 待补充 | C001 | 对照角色 360、表情表和已选关键帧 |
| 服装/发型 | 待补充 | 全片 | 每个 keyframe 复核 |
| 场景空间关系 | 待补充 | S001 | 建立图、反打图、主机位方向 |
| 180 度轴线 | 待补充 | SH001-SH### | 标注角色左右关系和镜头站位 |
| 视线方向 | 待补充 | SH001-SH### | 视线切必须对应被看对象 |
| 角色运动方向 | 待补充 | SH001-SH### | 入画/出画方向保持逻辑 |
| 镜头接力规则 | 待补充 | CLIP001-CLIP### | 每个 clip 结尾交出下一空间/动作/视觉线索，下一 clip 开头接住 |
| 重要道具位置 | 待补充 | P001 | 插入镜头前后位置一致 |
| 光线/天气/时间 | 待补充 | 全片 | 色温、光源方向、雨雪风等保持 |
| 色调/画幅/镜头风格 | 待补充 | 全片 | 每个提示词继承同一设定 |

## 轴线与空间备注

- 主轴线：待补充。
- 允许机位区域：待补充。
- 需要轴线重置的镜头：待补充。
- 屏幕方向锁定：待补充。
- 接力可用元素：门框、走廊、窗、屏幕、道具、光源、UI、前景遮挡、环境声。
"""


MASTER_STORYBOARD = """
# 分镜总表

| Shot ID | Clip ID | 时间轴 | 推荐时长 | 所属场景 | 镜头目的 | 景别 | 运镜 | 构图 | 角色/道具 | 动作起点 | 动作终点 | 情绪起点 | 情绪终点 | 接棒入点 | 交棒出点 | 运动/空间桥 | 风险/备用 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SH001 | CLIP001 | 0-待确认 | <=15s | S001 | 待补充 | 全景 / 中景 / 近景 / 特写 / 插入 | 固定观察 / 缓慢推进 / 拉远揭示 / 横移跟拍 / 随行跟拍 / 前景遮挡推进 / POV / 过肩 | 待补充 | C001/S001/P001 | 待补充 | 待补充 | 待补充 | 待补充 | 片头 / 待补充 | 交出下一镜头线索 | 门框/光线/运动方向 | 待补充 |
"""


SHOT_CARDS = """
# Shot Cards

> 新项目默认 `SH### = CLIP###`。每个 shot card 对应一次 SceneDance 生成，除非在 `clip_plan.md` 明确说明合并原因。

## SH001 / CLIP001

```yaml
shot_id: SH001
clip_id: CLIP001
scene_id: S001
purpose: "待补充"
duration: "<=15s"
shot_size: "全景 / 中景 / 近景 / 特写 / 插入"
camera_movement: "固定观察 / 缓慢推进 / 拉远揭示 / 横移跟拍 / 随行跟拍 / 前景遮挡推进 / POV / 过肩 / 低高机位 / 手持微晃 / 道具或光源引导"
composition: "待补充：主体位置、视线方向、运动方向、前后景"
character_state: "待补充：角色姿态、位置、服装、手部、道具关系"
action_start: "待补充：镜头开始时的明确身体动作"
action_end: "待补充：镜头结束时可剪切的身体动作或停顿"
emotion_start: "待补充"
emotion_end: "待补充"
receiver_in: "片头 / 待补充：从上一镜头接住的遮挡、光线、动作、空间或声音线索"
handoff_out: "待补充：结尾交给下一镜头的视觉、空间、运动或声音线索"
motion_vector: "待补充：人物/镜头/前景的主要运动方向"
spatial_bridge: "待补充：门、走廊、窗、屏幕、道具、光源、UI 等空间交代方式"
occlusion_carrier: "待补充：门框、人物背影、黑场、前景物体、烟雾、光斑、UI 弹窗；没有则写无"
visual_bridge: "待补充：颜色、形状、亮度、构图、前景元素或道具的视觉接力"
handoff_risk_reduction: "待补充：说明该接力如何降低身份跳变、空间跳变、光线跳变、动作断裂或节奏断裂"
reference_images:
  - C001_turnaround
  - S001_establishing
  - KF_CLIP001_start
scenedance_prompt: "待补充：一条清晰动作链 + 一个主运镜 + 接棒入点 + 交棒出点 + 连续性锁定"
prev_transition: "片头 / 待补充"
next_transition: "待补充"
edit_notes: "待补充：剪映裁切余量、J-cut/L-cut、声音桥、节奏点"
risks:
  - "身份漂移"
  - "动作未完成"
fallback_plan: "改成更短镜头 / 切道具特写 / 插入反应镜头 / 重生关键帧"
```

| 字段 | 内容 |
| --- | --- |
| 镜头目的 | 待补充 |
| 推荐时长理由 | 动作复杂度 / 情绪停顿 / 信息量 / 节奏 |
| 画面构图 | 待补充 |
| 人物状态 | 待补充 |
| 动作起点 | 待补充 |
| 动作终点 | 待补充 |
| 情绪起点 | 待补充 |
| 情绪终点 | 待补充 |
| 接棒入点 | 片头 / 待补充 |
| 交棒出点 | 待补充 |
| 运动方向 | 待补充 |
| 空间桥 / 遮挡载体 | 待补充 |
| 视觉桥 | 待补充 |
| 接力降低的风险 | 待补充 |
| 需要参考图 | C001_turnaround / S001_establishing / KF_CLIP001_start |
| SceneDance 生成提示词 | 待补充 |
| 与上一镜头衔接 | 片头 / 待补充 |
| 与下一镜头衔接 | 待补充 |
| 剪辑备注 | 待补充 |
| 风险提示 | 待补充 |
| 失败备用方案 | 待补充 |
"""


CLIP_PLAN = """
# SceneDance Clip 计划表

> `CLIP###` 是 SceneDance 生成单位。新项目默认 `SH### = CLIP###`，一个 clip 只承载一个主要动作链和一个主要镜头运动。每个 clip 必须 `<=15s`。

| Clip ID | 对应 Shot | 时间轴 | 时长 | 主动作目标 | 主镜头运动 | 起始关键帧 | 关键动作帧 | 出点关键帧 | 剪辑安全余量 | 剪辑点类型 | 是否一镜一片段 | 合并例外说明 | 预算结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLIP001 | SH001 | 0-待确认 | <=15s | 一个清晰动作链 | 固定观察 / 缓慢推进 / 拉远揭示 / 横移跟拍 / 随行跟拍 / 前景遮挡推进 / POV / 过肩 | KF_CLIP001_start | 视情况 | KF_CLIP001_out | 0.5-1s | 动作接动作 / 视线切 / 声音桥 / 遮挡切 / 镜头接力 | 是 | 无 | 可执行 / 过载 |
"""


SHOT_MOTION_BUDGET = """
# Shot / Motion Budget

| Clip ID | 时长 | 镜头数 | 主要动作链 | 动作复杂度 | 情绪复杂度 | 镜头方法 | 镜头方法理由 | 是否单一主动作 | 是否单一主运镜 | 可裁切余量 | 预算结论 | 调整建议 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLIP001 | <=15s | 1 | 待补充 | 低 / 中 / 高 | 低 / 中 / 高 | 跟拍 / 前景遮挡推进 / 插入特写 | 为动作、空间或接力服务 | 是 / 否 | 是 / 否 | 0.5-1s | 可执行 / 过载 | 缩短动作 / 拆镜 / 改成插入或反应镜头 |
"""


REFERENCE_INPUT_MATRIX = """
# SceneDance 参考图组合表

| Clip ID | 对应 Shot | 主输入关键帧 | 人物参考 | 场景参考 | 道具参考 | 动作/表情参考 | 分镜图参考 | 为什么需要这些参考图 | 不使用哪些图 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLIP001 | SH001 | KF_CLIP001_start | C001_turnaround | S001_establishing | P001_reference | C001_pose_action | CLIP001_storyboard_0-待确认 | 锁定身份、空间、道具和动作起点 | 不把带表格文字的分镜图作为唯一主输入 |
"""


HANDOFF_DESIGN_MATRIX = """
# 镜头接力矩阵

每个相邻 clip 必须填写一行。上一 clip 结尾负责交出下一空间、运动、视觉或声音线索；下一 clip 开头负责接住它。不要只写“自然衔接”。

| Handoff ID | 边界 | 上一镜头交出的线索 | 下一镜头接住的线索 | 空间入口/出口 | 运动方向 | 遮挡载体 | 视觉桥 | 声音桥 | 降低的 AI 风险 | 失败时改接方案 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HO_CLIP001_CLIP002 | CLIP001 -> CLIP002 | 待补充 | 待补充 | 门 / 窗 / 走廊 / 屏幕 / 道具 / 光源 / UI | 左到右 / 推入 / 拉出 / 由远到近 | 门框 / 背影 / 黑场 / UI / 烟雾 / 光斑 | 同色光 / 同形构图 / 道具延续 | J-cut / L-cut / 环境声 / SFX | 空间跳变 / 动作断裂 / 光线跳变 / 身份跳变 | 改插入道具特写 / 反应镜头 / 空镜 / 重生关键帧 |
"""


EDIT_BOUNDARY_MATRIX = """
# 剪辑边界矩阵

每个相邻 clip 必须填写一行，并引用 `handoff_design_matrix.md`。默认使用可剪辑边界，不强求首尾帧连续；只有动作必须跨片段连续时才做严格首尾帧匹配或桥接视频。

| 边界 ID | 接力 ID | 边界 | 前段出点 | 后段入点 | 剪辑类型 | 匹配依据 | 音频桥 | 是否需要首尾帧匹配 | 剪映处理建议 | 风险 | 失败时改切方案 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EB_CLIP001_CLIP002 | HO_CLIP001_CLIP002 | CLIP001 -> CLIP002 | 待补充 | 待补充 | 动作接动作 / 视线匹配 / 方向匹配 / 构图匹配 / 反应 / 插入 / 空镜 / 遮挡切 / J-cut / L-cut | 必须引用接力矩阵，不写空泛自然衔接 | 待补充 | 否 / 是 | 直接切 / 声音提前 / 裁掉0.5s / 插入特写 | 视觉跳变 / 节奏断裂 / 轴线反转 | 改切插入镜头 / 改反应镜头 / 重生关键帧 |
"""


SEEDANCE_SEGMENTS = """
# Seedance 2.0 分段表（旧项目兼容）

新项目默认使用 `shot_cards.md`、`clip_plan.md`、`reference_input_matrix.md` 和 `scenedance_shot_prompts.md`。本文件只用于旧版 `SEG###` 项目。

| 段 ID | 覆盖镜头 | 时间轴 | 段时长 | 镜头数 | 转场预留 | 起始关键帧 | 中间/桥接关键帧 | 结束关键帧 | 视频动作提示词 | 镜头运动 | 连续性锁定 | 与下一段衔接 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEG001 | SH001 | 0-15s 以内 | 15s 以内 | 1-5 | 0-4s | KF_SEG001_start | 视情况 | KF_SEG001_end | 待补充 | 待补充 | 角色脸、服装、场景光线、道具位置 | 待补充 |
"""


TRANSITION_MATRIX = """
# 段间转场矩阵（旧项目兼容）

新项目默认使用 `edit_boundary_matrix.md`。本文件只用于旧版 `SEG###` 项目。

| 转场 ID | 边界 | 前段尾帧 / 结束状态 | 后段首帧 / 起始状态 | 转场目的 | 桥接动作 | 时长分配 | 机位变化 | 所需图片 / 提示词 | 风险 | 处理方式 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TR_SEG001_SEG002 | SEG001 -> SEG002 | KF_SEG001_end：待补充 | KF_SEG002_start：待补充 | 待补充 | 待补充 | 前段尾部 / 后段开头 / 可选独立桥接 | 待补充 | TR_SEG001_SEG002_bridge / transition_prompts.md | 动作跳变 / 光线跳变 / 道具位置跳变 | 重生尾帧 / 重生首帧 / 生成桥接段 |
"""


IMG2_ZH = """
# Img2 中文提示词

## C001_turnaround

【图片用途】角色 360 一致性参考
【主体 ID】C001
【生产目的】保证所有 SceneDance 片段中的人物脸、发型、服装和体态一致
【连续性锁定】待补充
【画面内容】同一个角色，同一套服装，同一发型，正面、背面、左右侧、三分之四视角
【构图与镜头】干净中性背景，全身角色设定表
【动作状态】中性站姿
【情绪状态】平静
【光线与色彩】待补充
【风格】待补充
【技术要求】高清，身份稳定，服装细节清楚
【负面约束】不要换脸，不要改变年龄，不要换衣服，不要文字乱码
【输出路径】05_images/zh/C001_turnaround__zh__v01.png

## KF_CLIP001_start

【图片用途】Clip 起始关键帧
【主体 ID】CLIP001 / SH001
【生产目的】作为 SceneDance 主输入，锁定镜头入点
【连续性锁定】角色脸、服装、场景布局、道具位置、光线、轴线、视线方向、运动方向
【画面内容】待补充
【构图与镜头】待补充
【动作状态】动作起点：待补充
【接力状态】片头 / 待补充：本图接住上一镜头的线索，或准备本 clip 的交棒线索
【情绪状态】情绪起点：待补充
【光线与色彩】待补充
【风格】待补充
【技术要求】高清，画面干净，无表格文字，适合作为视频首帧
【负面约束】不要换脸，不要换衣服，不要多余手指，不要空间方向错误，不要字幕
【输出路径】05_images/zh/KF_CLIP001_start__zh__v01.png

## CLIP001_start_panel

【图片用途】SceneDance Clip 分镜 panel 源图
【项目】待补充
【Clip】CLIP001，时间轴待补充，时长必须 <=15s
【参考输入】C001_turnaround / S001_establishing / P001_reference / KF_CLIP001_start
【Panel 角色】START / KEY ACTION / EDIT OUT / HANDOFF；一次只生成一个干净 panel
【画面要求】只生成干净视觉画面，不生成生产板布局、文字栏、表格、caption、箭头说明或可读标签
【Clip预算】时长、主动作目标、主镜头运动、剪辑安全余量、剪辑点类型待补充
【镜头内容】接棒入点、起点、关键动作、出点、交棒出点、角色状态、道具位置、情绪变化待补充
【构图要求】干净电影画面；无文字；无表格；无多余 panel 边框；适合后续放入确定性 storyboard board 模板
【连续性锁定】角色脸、服装、场景布局、道具、色彩、光线、轴线、视线、运动方向
【镜头接力】按 handoff_design_matrix.md；写清上一镜交出的线索、本镜接住的线索、本镜交出的下一镜线索
【剪辑边界】按 edit_boundary_matrix.md；默认不要求首尾帧连续
【负面约束】不要生成最终 storyboard board，不要生成全片总览图，不要生成带文字/标签/空 caption 的三格板，不要生成无关四宫格概念图，不要只给单张电影海报，不要把一个 clip 塞成多动作混剪，不要让 AI 自行硬插值转场
【输出路径】final_image_package/clip_storyboards/panels/CLIP001_start.png
"""


IMG2_EN = """
# Img2 English Prompts

## C001_turnaround

Purpose: character turnaround consistency reference.
Subject ID: C001.
Production purpose: keep the character face, hair, wardrobe, and body language consistent across SceneDance clips.
Continuity locks: to be filled.
Image content: the same character in the same outfit and hairstyle, front, back, left side, right side, and three-quarter views.
Composition and camera: clean neutral background, full-body character sheet.
Action state: neutral standing pose.
Emotion state: calm.
Lighting and color: to be filled.
Style: to be filled.
Technical requirements: high detail, stable identity, clear wardrobe details.
Negative constraints: no face change, no age change, no outfit change, no garbled text.
Output path: 05_images/en/C001_turnaround__en__v01.png.

## KF_CLIP001_start

Purpose: clip start keyframe.
Subject ID: CLIP001 / SH001.
Production purpose: primary SceneDance input that locks the shot entry point.
Continuity locks: character face, wardrobe, scene layout, prop placement, light, axis, eyeline, screen direction.
Image content: to be filled.
Composition and camera: to be filled.
Action state: action start to be filled.
Handoff state: opening / to be filled with what this frame receives from the prior shot or prepares for the clip handoff.
Emotion state: emotion start to be filled.
Lighting and color: to be filled.
Style: to be filled.
Technical requirements: high detail, clean frame, no table text, suitable as a video start frame.
Negative constraints: no face change, no outfit change, no extra fingers, no wrong screen direction, no subtitles.
Output path: 05_images/en/KF_CLIP001_start__en__v01.png.

## CLIP001_start_panel

Purpose: clean SceneDance clip storyboard panel source.
Project: to be filled.
Clip: CLIP001 and time range to be filled; duration must be <=15s.
Reference inputs: C001_turnaround / S001_establishing / P001_reference / KF_CLIP001_start.
Panel role: START / KEY ACTION / EDIT OUT / HANDOFF; generate one clean panel at a time.
Image requirement: generate clean visual imagery only. Do not generate the final storyboard board layout, caption boxes, table text, arrows, or readable labels.
Clip budget: to be filled with duration, main action objective, main camera movement, edit handles, and cut type.
Shot content: receiver-in, start, key action, edit-out, handoff-out, character state, prop position, and emotion change to be filled.
Composition requirement: clean cinematic frame, no text, no tables, no extra panel borders, suitable for deterministic storyboard board assembly.
Continuity locks: identity, wardrobe, scene layout, prop design, color, lighting, axis, eyeline, screen direction.
Shot handoff: follow handoff_design_matrix.md; state what the prior shot gives, what this shot receives, and what this shot gives to the next shot.
Edit boundary: follow edit_boundary_matrix.md; no continuous frame match unless required.
Negative constraints: do not generate a final storyboard board, no text labels, no empty caption boxes, no unrelated four-panel concept art, no single poster image, no overloaded multi-action clip, no AI-invented interpolation transition.
Output path: final_image_package/clip_storyboards/panels/CLIP001_start.png.
"""


SCENEDANCE_SHOT_PROMPTS = """
# SceneDance Shot 视频提示词

## SH001 / CLIP001

Shot ID: SH001.
Clip ID: CLIP001.
Duration: <= 15 seconds.
Primary input image: 05_images/selected/KF_CLIP001_start__selected.png.
Auxiliary references: C001_turnaround / S001_establishing / P001_reference / CLIP001_storyboard_0-待确认.
Shot purpose: to be filled.
Main action: one clear action chain only; to be filled.
Start receiver state: opening / to be filled with the visual, spatial, motion, or audio clue received from the prior clip.
Action start: to be filled.
Action end / edit-out: to be filled with a natural cut point.
End handoff state: to be filled with the foreground, doorway, object, light, shape, motion, UI, sound, or spatial clue planted for the next clip.
Edit-out visual token: to be filled with the visible token the editor can cut on.
Next-scene clue: to be filled with what the audience should subconsciously expect in the next clip.
Emotion start: to be filled.
Emotion end: to be filled.
Camera movement: one main movement only; locked-off / slow push-in / pull-back reveal / lateral track / following track / foreground occlusion push / POV / over-shoulder / low-high angle / handheld micro-move / prop-led or light-led move.
Composition: to be filled with shot size, subject position, look room, foreground/background, screen direction.
Continuity locks: keep character identity, wardrobe, hair, scene layout, prop placement, light, weather, color, axis, eyeline, and screen direction stable.
Edit handles: keep 0.5-1s at start/end if possible for Jianying trimming.
Audio direction: dialogue / ambience / SFX / music cue / J-cut or L-cut idea to be filled.
Avoid: identity drift, wardrobe changes, scene jumps, axis flip, eyeline mismatch, rushed cuts, unfinished actions, malformed hands, logo changes, AI-invented interpolation between unrelated scenes.
"""


SCENEDANCE_CLIP_PROMPTS = """
# SceneDance Clip 视频提示词（旧命名兼容）

新项目默认使用 `scenedance_shot_prompts.md`。因为新项目默认 `SH### = CLIP###`，本文件仅保留给依赖旧文件名的流程。

请同步引用：

- `03_storyboard/shot_cards.md`
- `03_storyboard/reference_input_matrix.md`
- `04_prompts/scenedance_shot_prompts.md`
"""


SEEDANCE_PROMPTS = """
# Seedance 2.0 视频提示词（旧项目兼容）

新项目默认使用 `scenedance_shot_prompts.md` 和 `CLIP###`。本文件保留给旧版 `SEG###` 项目。

## SEG001

Duration: <= 15 seconds.
Input image: 05_images/selected/KF_SEG001_start__selected.png.
Action: to be filled.
Camera movement: to be filled.
Continuity: keep character identity, wardrobe, scene layout, prop placement, and lighting stable.
Start state: to be filled.
End state: to be filled for the next segment.
Transition handling: to be filled.
Avoid: identity drift, wardrobe changes, scene jumps, rushed cuts, unfinished actions, malformed hands, logo changes.
"""


TRANSITION_PROMPTS = """
# 剪辑边界 / 旧段间转场提示词

新项目优先在 `handoff_design_matrix.md` 里设计 `HO_CLIP001_CLIP002`，再在 `edit_boundary_matrix.md` 里设计 `EB_CLIP001_CLIP002`，并在 `scenedance_shot_prompts.md` 里写清接棒入点和交棒出点。只有必须连续动作时，才额外生成桥接视频或首尾匹配关键帧。

## HO_CLIP001_CLIP002

Handoff ID: HO_CLIP001_CLIP002.
Boundary: CLIP001 -> CLIP002.
Prior clip handoff: to be filled.
Next clip receiver: to be filled.
Spatial entrance/exit: door / corridor / window / screen / product surface / UI panel / light source / object direction.
Motion vector: to be filled.
Occlusion carrier: door frame / body crossing lens / black foreground / smoke / flare / vehicle / package / UI window; none only with reason.
Visual bridge: matched color / shape / brightness / texture / composition / object position / foreground mass.
Sound bridge: ambience / dialogue / music / footsteps / click / impact / product SFX.
How it hides AI discontinuity: to be filled.
Fallback if failed: insert / reaction / prop close-up / empty shot / rebuild keyframe / shorten clip.

## EB_CLIP001_CLIP002

Edit boundary ID: EB_CLIP001_CLIP002.
Boundary: CLIP001 -> CLIP002.
Handoff ID: HO_CLIP001_CLIP002.
Previous out point: to be filled.
Next in point: to be filled.
Cut type: action match / eyeline match / screen-direction match / composition match / reaction cut / insert / occlusion cut / J-cut / L-cut / continuous action.
Why it cuts naturally: reference the handoff design; to be filled.
Audio bridge: to be filled.
Frame matching required: no by default; yes only for continuous action.
CapCut handling: direct cut / sound overlap / trim 0.5s / insert close-up.
Risk: identity jump, object jump, rhythm break, axis flip, eyeline mismatch, lighting jump.
Fallback cut: switch to insert / reaction / prop close-up / empty shot / rebuild keyframe; do not rely on vague AI interpolation.
"""


NEGATIVE_PROMPTS = """
# 通用负面提示词

不要换脸，不要改变年龄，不要改变发型，不要改变服装，不要改变产品包装，不要 logo 变形，不要文字乱码，不要多余手指，不要畸形手，不要肢体穿模，不要场景突然变化，不要光线跳变，不要轴线反转，不要视线错乱，不要运动方向错乱，不要过度磨皮，不要低清晰度，不要水印，不要字幕。

# General Negative Prompt

No face change, no age change, no hairstyle change, no wardrobe change, no product packaging change, no distorted logo, no garbled text, no extra fingers, no malformed hands, no body intersection, no sudden scene change, no lighting jump, no axis flip, no eyeline mismatch, no wrong screen direction, no over-smoothed skin, no low resolution, no watermark, no subtitles.
"""


SCENEDANCE_USAGE = """
# SceneDance 使用清单

| Clip ID | Shot ID | 主输入图 | 辅助参考图 | 建议生成时长 | 建议使用时长 | 可裁切余量 | 接棒入点 | 主动作目标 | 动作起点 | 动作终点/出点 | 交棒出点 | 连续性锁定 | 剪辑点类型 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLIP001 | SH001 | 05_images/selected/KF_CLIP001_start__selected.png | C001_turnaround / S001_establishing / P001_reference | <=15s | 待补充 | 0.5-1s | 片头 / 待补充 | 待补充 | 待补充 | 待补充 | 待补充 | C001/S001/P001/轴线/视线/方向 | 待补充 |
"""


EDIT_NOTES = """
# 剪辑衔接说明

| 衔接点 | 接力 ID | 前一 clip 交棒出点 | 后一 clip 接棒入点 | 剪辑类型 | 匹配依据 | 音频桥 | 风险 | 处理方式 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLIP001 -> CLIP002 | HO_CLIP001_CLIP002 | 待补充 | 待补充 | 动作接动作 / 视线匹配 / 插入 / 遮挡切 / J-cut / L-cut | 引用 handoff_design_matrix.md | 待补充 | 人物/动作/光线/轴线跳变 | 优先改接力点；必要时插入特写/反应/空镜或补关键帧 |
"""


POST_EDIT_PLAN = """
# 后期剪辑计划

| 顺序 | Clip ID | 源视频文件 | 建议使用时长 | 入点裁切 | 出点裁切 | 画面剪辑 | 音频衔接 | 接力处理 | 节奏备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CLIP001 | 待生成 | 待补充 | 0-0.5s | 0.5s | 硬切 / 匹配切 / 插入 / 遮挡切 | J-cut / L-cut / 环境声延续 / 音乐桥 | 保留交棒出点，不要裁掉关键遮挡/光线/道具线索 | 裁掉模型不稳的开头或结尾 |
"""


RISK_FALLBACK_PLAN = """
# 生成风险与备用方案

| Clip ID | Shot ID | 主要风险 | 失败判定 | 首选备用方案 | 次选备用方案 | 是否需要补图 |
| --- | --- | --- | --- | --- | --- | --- |
| CLIP001 | SH001 | 人物漂移 / 动作断裂 / 空间跳变 / 接力失败 / 节奏赶 | 角色不像、动作没完成、出点不可剪、没有交棒线索 | 缩短动作并重生 | 切成道具特写、反应镜头或空镜接力 | 是 / 否 |
"""


JIANYING_EDIT_LIST = """
# 剪映剪辑清单

| 顺序 | Clip ID | 源视频文件 | 建议使用时长 | 入点裁切 | 出点裁切 | 剪辑方式 | 音效 / 音乐衔接 | 接力备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CLIP001 | 待生成 | 待补充 | 0-0.5s | 0.5s | 硬切 / 匹配切 / 声音桥 | 待补充 | 保留交棒出点；若接力失败，改插入或反应镜头 |
"""


IMAGE_MANIFEST = """
# 图片清单

## Clip 生产分镜板

| Clip | Shot | 时间 | 图片 | 视觉源 | 文本来源 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| CLIP001 | SH001 | 待确认 | final_image_package/clip_storyboards/CLIP001_storyboard_0-待确认.png | panels/CLIP001_start.png / panels/CLIP001_key.png / panels/CLIP001_out.png | shot_cards / handoff / edit boundary / scenedance prompts | pending |

## Clip 分镜 panel 源图

| Clip | Shot | Panel | 图片 | 状态 |
| --- | --- | --- | --- | --- |
| CLIP001 | SH001 | START | final_image_package/clip_storyboards/panels/CLIP001_start.png | pending |
| CLIP001 | SH001 | KEY ACTION | final_image_package/clip_storyboards/panels/CLIP001_key.png | pending |
| CLIP001 | SH001 | EDIT OUT | final_image_package/clip_storyboards/panels/CLIP001_out.png | pending |

## SceneDance Clip 关键帧

| Clip | Shot | 图片 | 同步选中图 | 状态 |
| --- | --- | --- | --- | --- |
| CLIP001 | SH001 | final_image_package/clip_keyframes/KF_CLIP001_start.png | 05_images/selected/KF_CLIP001_start__selected.png | pending |
| CLIP001 | SH001 | final_image_package/clip_keyframes/KF_CLIP001_out.png | 05_images/selected/KF_CLIP001_out__selected.png | as-needed |

## 一致性参考图

| 类型 | 图片 | 同步选中图 | 状态 |
| --- | --- | --- | --- |
| 角色一致性 | final_image_package/support_assets/C001_turnaround.png | 05_images/selected/C001_turnaround__selected.png | pending |
| 场景一致性 | final_image_package/support_assets/S001_establishing.png | 05_images/selected/S001_establishing__selected.png | pending |
| 道具一致性 | final_image_package/support_assets/P001_reference.png | 05_images/selected/P001_reference__selected.png | pending |

## 可选桥接素材

| 边界 | 图片 / 提示词 | 用途 | 状态 |
| --- | --- | --- | --- |
| HO_CLIP001_CLIP002 | final_image_package/transition_bridges/HO_CLIP001_CLIP002_bridge.png / 04_prompts/transition_prompts.md | 仅在接力需要额外遮挡、光线、道具或空间桥时使用 | as-needed |

## 交付规则

- 每个 SceneDance clip 必须有干净起始关键帧。
- 每个 clip 必须有一张确定性排版的生产分镜板，保存到 `final_image_package/clip_storyboards/`。
- 图片模型只生成干净 panel/keyframe 源图；最终 board 的可读文字和版式必须由本地确定性渲染生成。
- 生产分镜板用于审阅和低权重参考，不作为唯一视频主输入。
- 每个相邻 clip 必须有一条 `handoff_design_matrix.md` 记录。
- 每个相邻 clip 必须有一条 `edit_boundary_matrix.md` 记录。
- 最终 board 不能有空 caption、乱码字、缺 Clip ID、缺时间范围、缺 START/KEY ACTION/EDIT OUT、缺剪辑边界、混入多个 clip 或海报式单图冒充分镜。
- 交付前必须把所有 `pending` 改成实际完成状态或明确阻塞原因。
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a SceneDance continuity-first storyboard package skeleton.")
    parser.add_argument("slug", help="Project slug, e.g. rain-night-drama")
    parser.add_argument("--root", default=".", help="Workspace root. Package is created under storyboard_projects/.")
    parser.add_argument("--title", default="", help="Human-readable project title.")
    parser.add_argument("--duration", default="", help="Target duration, e.g. 60s.")
    parser.add_argument("--aspect", default="", help="Aspect ratio, e.g. 9:16 or 16:9.")
    parser.add_argument("--video-type", default="", help="Video type, e.g. product ad or short drama.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing template files.")
    args = parser.parse_args()

    ctx = make_context(args)
    root = Path(args.root).expanduser().resolve()
    project_dir = root / "storyboard_projects" / args.slug

    directories = [
        "01_script_brief",
        "02_bibles",
        "03_storyboard",
        "04_prompts",
        "05_images/zh",
        "05_images/en",
        "05_images/selected",
        "05_images/references",
        "06_delivery",
        "final_image_package/clip_storyboards",
        "final_image_package/clip_storyboards/panels",
        "final_image_package/clip_keyframes",
        "final_image_package/storyboards_15s",
        "final_image_package/seedance_keyframes",
        "final_image_package/transition_bridges",
        "final_image_package/support_assets",
    ]
    for directory in directories:
        (project_dir / directory).mkdir(parents=True, exist_ok=True)

    files = {
        "01_script_brief/script.md": SCRIPT_TEMPLATE,
        "01_script_brief/script_analysis.md": SCRIPT_ANALYSIS,
        "01_script_brief/project_brief.md": render_project_brief(ctx),
        "02_bibles/character_bible.md": CHARACTER_BIBLE,
        "02_bibles/product_prop_bible.md": PRODUCT_PROP_BIBLE,
        "02_bibles/scene_bible.md": SCENE_BIBLE,
        "02_bibles/style_bible.md": STYLE_BIBLE,
        "02_bibles/continuity_bible.md": CONTINUITY_BIBLE,
        "03_storyboard/master_storyboard.md": MASTER_STORYBOARD,
        "03_storyboard/shot_cards.md": SHOT_CARDS,
        "03_storyboard/clip_plan.md": CLIP_PLAN,
        "03_storyboard/shot_motion_budget.md": SHOT_MOTION_BUDGET,
        "03_storyboard/reference_input_matrix.md": REFERENCE_INPUT_MATRIX,
        "03_storyboard/handoff_design_matrix.md": HANDOFF_DESIGN_MATRIX,
        "03_storyboard/edit_boundary_matrix.md": EDIT_BOUNDARY_MATRIX,
        "03_storyboard/seedance_segments.md": SEEDANCE_SEGMENTS,
        "03_storyboard/transition_matrix.md": TRANSITION_MATRIX,
        "04_prompts/img2_zh.md": IMG2_ZH,
        "04_prompts/img2_en.md": IMG2_EN,
        "04_prompts/scenedance_shot_prompts.md": SCENEDANCE_SHOT_PROMPTS,
        "04_prompts/scenedance_clip_prompts.md": SCENEDANCE_CLIP_PROMPTS,
        "04_prompts/seedance_prompts.md": SEEDANCE_PROMPTS,
        "04_prompts/transition_prompts.md": TRANSITION_PROMPTS,
        "04_prompts/negative_prompts.md": NEGATIVE_PROMPTS,
        "06_delivery/scenedance_usage_list.md": SCENEDANCE_USAGE,
        "06_delivery/seedance_usage_list.md": SCENEDANCE_USAGE,
        "06_delivery/edit_continuity_notes.md": EDIT_NOTES,
        "06_delivery/post_edit_plan.md": POST_EDIT_PLAN,
        "06_delivery/risk_fallback_plan.md": RISK_FALLBACK_PLAN,
        "06_delivery/jianying_edit_list.md": JIANYING_EDIT_LIST,
        "final_image_package/image_manifest.md": IMAGE_MANIFEST,
    }
    for relative_path, content in files.items():
        write_file(project_dir / relative_path, content, args.force)

    print(project_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
