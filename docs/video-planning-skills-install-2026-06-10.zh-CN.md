# 创作·视频策划 Skills 安装报告（2026-06-10）

## 摘要

- **新装 9 项** vendor 至 `skills/vendor/creation-ecosystem/create-vid-*`
- **露出 2 项** 仓内 skill：`mkt-dmp-video-script`、`mkt-brand-video`（创作 + 营销双 Tab）
- **Catalog**：1233 项（+9）
- **Smoke**：`npm run smoke:video-planning` ✅、`npm run smoke:capability-hub` ✅

## 新装清单

| slug | 中文名 | 来源 | 路径 |
|------|--------|------|------|
| `create-vid-scriptwriting` | 程序化视频脚本 | [mkurman/zorai](https://github.com/mkurman/zorai) `skills/nontechnical/absolutelyskilled/video-scriptwriting` | `skills/vendor/creation-ecosystem/create-vid-scriptwriting/` |
| `create-vid-saas-demo-script` | SaaS 演示分镜 | [changxiyue1992-lang/ai-saas-demo-script-skill](https://github.com/changxiyue1992-lang/ai-saas-demo-script-skill) | `create-vid-saas-demo-script/` |
| `create-vid-seedance-prompt` | 即梦分镜提示 | [dexhunter/seedance2-skill](https://github.com/dexhunter/seedance2-skill) | `create-vid-seedance-prompt/` |
| `create-vid-seedance-codec` | 即梦相机分镜 | [MapleShaw/seedance2.0-prompt-skill](https://github.com/MapleShaw/seedance2.0-prompt-skill) | `create-vid-seedance-codec/` |
| `create-vid-visual-prompt` | 影视镜头策划 | [smixs/visual-skills](https://github.com/smixs/visual-skills) `video/` | `create-vid-visual-prompt/` |
| `create-vid-director` | AI 导演分镜 | [wuwangzhang1216/DirectorSKILL](https://github.com/wuwangzhang1216/DirectorSKILL) | `create-vid-director/` |
| `create-vid-storyboard-pack` | 连续性分镜包 | [TateZhouSiu/create-storyboard-skill](https://github.com/TateZhouSiu/create-storyboard-skill) | `create-vid-storyboard-pack/` |
| `create-vid-seedance-series` | 短剧分镜生成 | [liangdabiao/Seedance2-Storyboard-Generator](https://github.com/liangdabiao/Seedance2-Storyboard-Generator) | `create-vid-seedance-series/` |
| `create-vid-viral-copy` | 爆款视频文案 | [anbeime/skill](https://github.com/anbeime/skill) `skills/viral-video-copywriting/` | `create-vid-viral-copy/` |

> 注：`video-scriptwriting` 官方 AbsolutelySkilled 主仓当前仅含 `absolute` skill，故采用 zorai 镜像路径（同源 MIT skill 包）。

## 仓内双 Tab 露出

| slug | 创作·视频工程 | 营销 Tab | 变更 |
|------|---------------|----------|------|
| `mkt-dmp-video-script` | ✅ `secondary_categories: creation` + `create_video` | ✅ 策略·活动全案 | 中文 display + setup_hint |
| `mkt-brand-video` | ✅ 已有 secondary | ✅ 创意·视频 | `hidden_in_hub: false` 覆盖品牌包隐藏 |

## 双语 i18n

| 配置 | 说明 |
|------|------|
| [`config/capability-hub-zh.json`](../config/capability-hub-zh.json) | 11 项 zh-CN：display_name / task_summary / description / examples |
| [`scripts/generate-capabilities-i18n.mjs`](../scripts/generate-capabilities-i18n.mjs) `SKILL_EN` + `SKILL_PROMPT_EN` | 11 项 en 名称、说明、「试一下」英文 prompt |
| UI | [`ui/src/shared/capabilityLocale.ts`](../ui/src/shared/capabilityLocale.ts) 随系统语言切换 |

## 命令

```bash
npm run vendor:video-planning    # 拉取 9 项
npm run capabilities:gen         # catalog + i18n
npm run smoke:video-planning     # 本批次专项 smoke
npm run smoke:capability-hub     # taxonomy 回归
```

## 产物

- Vendor 报告：`artifacts/capabilities-smoke/vendor-video-planning.json`
- Smoke 报告：`artifacts/capabilities-smoke/video-planning-smoke.json`

## 备注

- `create-vid-viral-copy` 含可选 Python/yt-dlp 依赖（对标抖音链接）；纯口播文案可不装，Hub 已标 `needs_config` + setup_hint。
- 两个 Seedance prompt skill 在 Hub 中文简介上区分：dexhunter=平台 @引用语法；MapleShaw=相机编码/长片流水线。
