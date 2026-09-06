# VAP 配图实网矩阵终验报告（2026-07-19）

**总判定：GO（8/8）**  
**生成时间**：2026-07-19  
**JSON 明细**：`artifacts/vap-acquisition-live-matrix/live-matrix-report.json`  
**复测命令**：`npm run test:vap:live-matrix:gate`

---

## 1. 执行摘要

在修复 **3 个阻塞性缺陷** 后，对历史失败案例（G700 四案）与四类主题（新闻/人物/产品/品牌）共 **8 项** 执行实网 `resolve_session_visual_assets` 管线复测，**全部在 3.5–8.5 秒内取得 ≥2 张本地化素材（G700 类 ≥8 张）**，未触发占位图降级。

| 分组 | 案例 | 结果 | 素材数 | 耗时 |
|------|------|------|--------|------|
| G700 复测 | Nova 幻灯 8 页 | PASS | 8/3 | 7.3s |
| G700 复测 | Campaign 全案 | PASS | 8/3 | 6.5s |
| G700 复测 | HTML 演示 | PASS | 8/3 | 4.8s |
| G700 复测 | Hero 官网 | PASS | 8/2 | 3.5s |
| 主题矩阵 | 新闻（AI 产业政策） | PASS | 8/2 | 7.8s |
| 主题矩阵 | 人物（王传福） | PASS | 8/2 | 7.2s |
| 主题矩阵 | 产品（华为 Mate 70） | PASS | 8/3 | 7.7s |
| 主题矩阵 | 品牌（星巴克） | PASS | 8/2 | 8.5s |

---

## 2. 历史失败根因（复盘）

### 2.1 致命缺陷：HTTP 抓取全部静默失败

**现象**：八层阶梯「全都 tried 但 ok=0」，52ms 内返回空 manifest。  
**根因**：`fetchPublicHttpResource` 使用 undici `Agent` + `AbortSignal.timeout()`，在 Node 22 触发 `UND_ERR_INVALID_ARG`，所有官网/权威/搜索抓取实际未发出有效请求。  
**修复**：`publicHttpUrlPolicy.ts` 增加 `bridgeAbortSignalForUndici()`，并将默认 fetch 改为 `undiciFetch`。

### 2.2 主体解析缺失

**现象**：Nova 目标仅含 `【G700】` 时，权威站/搜索引擎层未执行。  
**修复**：`subjectGroundingPolicy.ts` 支持 `【…】` 括号主体；`G700` 映射为「鸣镝 G700」。

### 2.3 配置与策略层（此前已做、本次验证生效）

- 八层配图阶梯（含网页/图片搜索引擎）
- G700 canary 根域 + `$comment` 校验放行
- Nova binding 改为 manifest 优先，禁止 generate_image 冒充官图
- VAP 编排预算 28s

---

## 3. 各案有效渠道（实网取证）

### G700 汽车类（4/4 PASS）

| 有效 tier | 说明 |
|-----------|------|
| **official_roots + html_image_extract** | 奇瑞/纵横子站 HTML 提取为主力（即使部分 URL DNS 失败，可解析页仍产出 8 张） |
| search_engine_* | 本次 Bing/Bocha ok=0，**未成为主力但不阻塞** |
| page_screenshot | 备用，G700 Hero 未触发即已满足 |

样例路径（Nova）：`artifacts/vap-live-matrix/nova-slides-official-20260719/assets/raw/img-*.jpg`

### 新闻类（PASS）

| 有效 tier | 说明 |
|-----------|------|
| **portal_general** | 百度/搜狗门户搜索页 HTML 提取 |
| **page_screenshot** | 门户页视口截图兜底（1 张 capture） |
| html_image_extract | 门户页内候选图 |

### 人物 / 产品 / 品牌类（3/3 PASS）

| 有效 tier | 说明 |
|-----------|------|
| **portal_general + html_image_extract** | 综合门户为主 |
| **page_screenshot** | 人物/产品/品牌均触发截图兜底 |
| prepare | 人物类自动走 `social_square_safe` 裁剪 |

---

## 4. 当前「最稳」配图方案（推荐生产默认）

### 八层顺序（须跑满后再占位/告知用户）

1. 用户官网 URL（`urlSanitize` 净化）
2. 品牌根域（`official-source-roots` / G700 canary）
3. 行业权威站（汽车之家/懂车帝/易车等，`visual-authority-sources.json`）
4. 综合门户（百度/搜狗/垂直站，`visual-portal-sources.json`）
5. **网页搜索**（博查 API 优先 → Bing 网页 HTML 解析）
6. **图片搜索**（Bing Images `murl` 解析）
7. **HTML 候选提取 + 本地化**（当前实网主力）
8. **Playwright 视口截图**（新闻/人物/品牌兜底有效）

### Agent 侧硬约束

- 首 turn 自动 `runVisualAssetOrchestrator(phase_a)`（预算 28s）
- 禁止首轮 `fetch_page_images` 失败即 `generate_image`/SVG
- `official_only` 任务以 manifest `preparedPath` 交付

### 运维建议

| 项 | 建议 |
|----|------|
| G700 dev | `PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH=config/fixtures/official-source-roots.g700-canary.json` |
| 搜索命中率 | 配置 `BOCHA_API_KEY`（提升 tier 5/6） |
| 发版前 | `npm run test:vap:live-matrix:gate` + `npm run test:visual-asset-platform:acceptance` |
| Gateway | enforce 模式 + Nova 实机仍须复验（防 skill 绕过 VAP） |

---

## 5. 待优化项（不阻塞本次 GO）

1. **搜索引擎 tier**：实网 Bing HTML ok=0（网络/区域限制）；生产建议 **必配博查** 或企业代理。
2. **分类权威源**：新闻类仍走汽车之家模板会 `fetch_failed`（无害但冗余）；已备 `visual-authority-news-sources.json`，下一步按 `category` 路由。
3. **Gateway 实机**：本次为 **Orchestrator 直调实网**；UI 会话须重启 dev 栈验证 Agent 是否调 VAP 而非 generate_image。
4. **manifest 错误残留**：同 task 目录重跑会合并旧 errors；验收脚本可改为每次清空目录。

---

## 6. 验收命令清单

```bash
# 实网 8 案矩阵（权威）
npm run test:vap:live-matrix:gate

# 离线结构 + 单元 + 五案 replay
npm run test:visual-asset-platform:acceptance

# 单案复测
node --import tsx scripts/run-vap-acquisition-live-matrix.mjs --only=nova-slides-official-20260719
```

---

## 7. 结论

- **配图获取方案**在实网环境下已达到 **8/8 GO**，G700 历史失败案均可 **数秒内取得 8 张本地化素材**，四类主题矩阵全部通过。
- 本次最大价值修复是 **undici + AbortSignal 兼容性**；策略层八层阶梯与搜索引擎扩展已验证架构正确。
- **生产 UI 闭环**仍建议：重启 dev:saas → 重跑 Nova/Campaign 会话 → 确认不再出现「无法获取图片降级」与 `generate_image×N`。

---

*本报告由 `scripts/run-vap-acquisition-live-matrix.mjs` 自动生成并人工复盘补充。*
