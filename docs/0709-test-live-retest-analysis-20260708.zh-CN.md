# 0709-TEST 实机复测深度分析

生成时间：2026-07-08T20:21:35.484Z

## 1. 与历史基线对照

### 0708-10
- **历史基线**：d26c105d needs_repair; 模板槽占 mkt-ads; 足球串台
- **本次 outcome**：still_thinking
- **Dock 行数**：3
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_564ba769-ef63-4629-b91c-6e7d5087230e

### 0708-02
- **历史基线**：6d40823c campaign 全案 repair; build-brief.mjs 过程文件
- **本次 outcome**：still_thinking
- **Dock 行数**：14
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_011379e8-74b5-4d97-8037-84650c782486

### 0708-07
- **历史基线**：350cb55e 内容营销三步 contract 行数漂移
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_155a558c-b6a1-476f-8b1b-49baea2d5ad1

### ET-PPT-01
- **历史基线**：aad78932 needs_repair×146; df-ppt 误路由
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_af022b10-7f44-495b-8ba3-e549db298799

### ET-PPT-02
- **历史基线**：b2721bdd needs_repair×232; false_incomplete
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_c34a6577-c814-47da-ad69-38c8bbe256a6

### ET-PPT-03
- **历史基线**：517c6c7e needs_repair×118; verified∩broken 重叠
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_b3484e82-ccd4-4a99-96cc-748233d06c78

### T0707-2-P0-01
- **历史基线**：188fa4a3 campaign SDM repair 风暴
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_5b0b160a-a232-4e04-a833-04a8f3ee49e6

### T0707-2-P0-02
- **历史基线**：c2ff6893 视频 API/env; 无真 mp4
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_1d1bf62f-be36-4731-9348-c3845823c78f

### T0707-2-P0-03
- **历史基线**：c5ce7d65 battlecard 三步首回合停
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_eca4cc5d-5599-4942-8967-a42335f623fe

### 0708-01
- **历史基线**：a7023e53 杂志风 index.html 槽位
- **本次 outcome**：assistant
- **Dock 行数**：1
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_05b83efb-0dbc-439b-bd8d-a65886400052

### ET-RES-01
- **历史基线**：0ffbb6a3 Nova-竞品对标 turn4+ repair
- **本次 outcome**：still_thinking
- **Dock 行数**：0
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_7c8ab3d2-ec6c-4bd0-91b5-7eae46794d0f

### v1-copy-to-html-delay
- **历史基线**：终验0702 广告文案→HTML 落地页延迟/缺失
- **本次 outcome**：assistant
- **Dock 行数**：1
- **SDM slots**：0
- **repair UI 泄漏**：否
- **会话 URL**：http://127.0.0.1:8081/session/web-s_cf6a9bf5-92ac-42a0-936c-6d724d122e31


## 2. 共性问题模式（自动归纳）

- **Dock 采样时未展开/未收敛**：0708-07、PPT 三线、0707-2 三线、ET-RES-01 在 ~2min 快照时 Dock 行数为 0，但 Composer 已显示「交付进度 N/M」——Harness 未点 📦 或任务尚未写完首屏汇总表。
- **历史 repair 风暴已消失**：12 案均未出现 `needs_repair` 用户可见文案、`<task-resume>` 泄漏、`fetch failed` 裸错误——相对 0706/0707 基线 **显著改善**。
- **英文过程泄漏**：0708-10/0708-02 过程区仍可见英文思考句（如 "Both files are verified…"），中文 UI 下应过滤。
- **视频 P0 仍卡 API**：T0707-2-P0-02 快照时 `generate_video` 失败，Agent 降级 `render_html_video`。
- **SDM API 回读为 0**：messages API 未取到 `sessionDeliverableManifest` metadata，与 UI Dock 不一致，需查 history 映射。

## 3. 真实完成度（人工对照快照 + 长等待案）

| case | 相对历史基线 | 真实完成度 | 关键证据 |
|------|-------------|-----------|----------|
| **0708-10** | ✅ 无足球串台；模板槽未占主交付 | **部分 2/3** | Dock：ads-plan.md + channel-matrix.md 已交付；brief 未完成；无 repair |
| **0708-02** | ✅ 无 repair 风暴；14 行 Dock | **部分 9/14** | Campaign 多 phase 文件已写；官网/监测等待完成 |
| **0708-07** | ⚠️ 早退 | **进行中 0/3** | 仅完成搜索起步；需回 UI 继续观察 |
| **ET-PPT-01~03** | ✅ 无 146/232/118 repair 步级风暴 | **进行中 0/4** | profile 路由正常、在装依赖/读 skill；未见 false_incomplete 翻转 |
| **T0707-2-P0-01** | ✅ 无 SDM repair 风暴 | **进行中 1/8** | 01-research.md、02-strategy.md 已生成 |
| **T0707-2-P0-02** | ⚠️ 视频 API | **进行中 0/1** | generate_video 失败，降级 HTML 视频 |
| **T0707-2-P0-03** | ✅ 首回合未停、无用户「继续」 | **进行中 1/3** | intel.md 已生成 |
| **0708-01** | ✅ | **完成 1/1** | index.html 已交付，自检通过 |
| **ET-RES-01** | ✅ 无 turn4+ repair | **进行中** | 13 次搜索进行中，无 repair UI |
| **v1-copy-to-html** | ✅ | **完成 1/1** | landing index.html 50s 交付 |

## 4. 下一步改进建议

### P0（发版前）

1. **L4 Harness 改为「槽位收敛」退出**：Playwright 应等 `交付进度 N/N` 或 Dock 全「已交付」再采样，或按 case `timeoutMs` 跑满；当前 90–120s 早退会高估通过率。
2. **0708-10 brief 假 incomplete**：2/3 已 verified 仍显示 brief 槽未完成——对照 `reconcileSlotsWithVerifiedPaths` + mkt_ads profile 补回归。
3. **generate_video /env**：T0707-2-P0-02 须确认 DashScope/Seedance Key 与 `applyDocumentToolsRuntimeEnv` 视频路由；失败时 UI 勿显示 0/1 长期卡住。
4. **过程英文过滤**：`stripLeakedToolMarkup`/思考区须剔除 "Both files are verified" 类英文旁白。

### P1（体验）

5. **Dock 采样**：E2E 先点 `[data-testid="composer-deliverables-button"]` 再读表；messages API 补 SDM metadata 回读门禁。
6. **Campaign 长任务 auto-continue**：0708-02 类 14 槽任务应引擎 owner 续跑至 14/14，避免 9/14 停住。
7. **PPT Windows 路径**：ET-PPT-01 bash/tail 失败应走 anth-pptx/python-pptx 单路径，减少装依赖绕路。

### P2（KPI）

8. 将上表 12 个 sessionId 纳入 `npm run analyze:task-completion --gate` 持续追踪。
9. 重跑命令：`npm run test:0709:live-retest`（已跑过的 pass 案会自动 skip，设 `O709_FRESH=1` 可清空重跑）。

