# 0709-Test-2 UDC 六案实机总结（reconcile 修复后）

**生成时间**：2026-07-09  
**状态**：实机测试已终止，不再追加未跑项  
**项目**：admin → `workspaces-0709-Test-2`  
**产物**：`artifacts/0709-Test-2/logs/*.json`、`0709-udc-live.jsonl`、6 张截图  

---

## 1. 测试轮次说明

| 轮次 | 内容 | 结果 |
|------|------|------|
| **R0** | 初跑（10min timeout，无 reconcile 修复） | 6 partial；C1 三文件已产出但 Harness 低估 |
| **R1** | C4/C5 专项（20min + reconcile 修复） | C4 **converged**（14 行已完成）；C5 仍 20min 超时 |
| **R2** | 六案全量（20min GEO/增长，15min 监测，workers=2） | **全部执行完毕** exit 0；0 pass / 6 partial |

**代码修复（R1 前落地）**  
- `DeliverableSummaryTable`：`mergeFolderItemsIntoDockRows` + 会话级 `collectSessionFolderItems`  
- `MessageRowV2`：`summaryTableFolderItems` 合并会话文件夹  
- Playwright：timeout 20min、识别「已完成/已交付」、单项目预创建  

---

## 2. R2 六案结果总表

| 案例 | 历史痛点 | outcome | 耗时 | 汇总表 | 文件夹/Dock | UDC检查 | 判定 |
|------|----------|---------|------|--------|-------------|---------|------|
| **C1** battlecard | 首回合停 | **converged** | 3m | 3/3 **已完成** | 3/3 一致 | 1/2 | **✅ 实质通过** |
| **C4** 雷蛇 GEO | 17 行假绿 | still_thinking | 20m | 未展开(0行) | 进度 3/10，已写 checklist/keywords | 0/3 | ⚠️ 进行中 |
| **C5** Pro Click | slot_1 未绑 | still_thinking | 20m | 7 行，**3 已完成** | 7/9 阶段 | 1/3 | ⚠️ reconcile 部分生效 |
| **C6** 监测三步 | 跨目录 | still_thinking | 15m | 3 行全未完成 | 0/3，在读旧文件 | 2/3 | ⚠️ 未交付 |
| **C7** 视频 mp4 | 无真 mp4 | still_thinking | 20m | 未展开 | 卡 **render_html_video**；有 storyboard/png | 0/2 | ❌ 未交付 mp4 |
| **C8** 增长八步 | 误绑 geo | still_thinking | 20m | 8 行全未完成 | 1/8；folder 有 checklist **已完成** | 2/3 | ⚠️ 结构对、reconcile 仍裂 |

**共性问题（六案一致）**  
- `sessionDeliverableManifest` / `contractHash` 在 messages API **均为 null**（SDM 写盘或 tail-read 不可见）  
- 长任务（GEO/增长/视频）**20min 仍不够**跑完 auto-continue 链  
- **汇总表 vs 文件夹**：C1/C5 改善明显；C8 仍「folder 绿、表灰」  

---

## 3. reconcile 修复效果评估

| 维度 | 修复前 (R0) | 修复后 (R2) |
|------|-------------|-------------|
| C1 汇总表 vs 文件夹 | 一致但 Harness 只计「已交付」 | **3/3 已完成，一致** |
| C5 汇总表可见行 | 0 行 | **7 行，3 行已完成** |
| C4 假绿 17 行 | 7 行结构（无 17 假绿） | 仍为 7 槽结构；R1 曾 14 行收敛 |
| C8 geo 误绑 | 已守卫 | **profileNotGeo ✅ 保持** |
| C8 表/夹同步 | 表 0 行 | **8 行结构正确**；folder 有文件但表仍灰 |

**结论**：reconcile **对短任务（C1）和中等进度（C5）有效**；对 **槽 label 与磁盘 basename 不一致**（C8：`02-execution-checklist.md` vs「市场洞察」）仍须加强 `pathSatisfiesSdmSlot` / enrich 时机。

---

## 4. 分案要点（可人工复查 session）

### C1 ✅ [`web-s_253ac526…`](http://127.0.0.1:8081/session/web-s_253ac526-48f5-4bae-b3ce-99c48d34f61b)
- intel / battlecard / talk-track 三文件 **汇总表与文件夹均为已完成**
- 历史「首回合停」**已解决**，可作为 UDC 短任务标杆

### C4 ⚠️ [`web-s_2d9f38c4…`](http://127.0.0.1:8081/session/web-s_2d9f38c4-457a-4abb-ac30-4a2c16faa2a7)
- R1 同案曾 **converged + 14 已完成**（`web-s_71f6b27d…`）；R2 换 session 后 20min 仍在 3/10
- 根因：**任务耗时长 + 并行 workers 争用模型/Gateway**，非 reconcile 单点

### C5 ⚠️ [`web-s_55cc8d8d…`](http://127.0.0.1:8081/session/web-s_55cc8d8d-849f-4a7e-82bd-5f8a0c7c0ef4)
- 汇总表 **7 行对齐七步**，3 行已完成（t4/t5/t6）
- slot_1 `01-aeo-audit-checklist.md` 仍 **未完成**；`task-folder-snapshot` 空（scopeDir 无文件索引）

### C6 ⚠️ [`web-s_084312ca…`](http://127.0.0.1:8081/session/web-s_084312ca-a6ce-4152-bfdd-5c1384807d50)
- 15min 超时；Agent 在读历史 mention/html，**未写出新 csv/md/html**

### C7 ❌ [`web-s_9d3525db…`](http://127.0.0.1:8081/session/web-s_9d3525db-8b80-4948-b4c4-31b18f12e9d9)
- **卡在 render_html_video**；交付 storyboard.html + keyframe png，**无 commercial.mp4**
- 需 Key/Seedance 或 UserActionRequired，勿长期「MP4 未完成」

### C8 ⚠️ [`web-s_a20b2ecc…`](http://127.0.0.1:8081/session/web-s_a20b2ecc-56aa-4b7d-b865-a1325c4bbdc7)
- **8 槽结构 + profile 未误绑 geo** ✅
- 已写 `01-master-report.md`、`02-execution-checklist.md`；**汇总表 8 行仍全未完成** → reconcile 下一优先级

---

## 5. 优化方案（按优先级）

### P0 — 必须做

1. **SDM 写盘 + messages 可读**  
   - turn 末写入 `sessionDeliverableManifest`、`turn_acceptance_meta.slotBindings`、`contractHash`  
   - 确保 tail-read `/messages` **保留 metadata**（现六案全 null，三分取证失效）

2. **C8/C4 类 label↔basename reconcile**  
   - `enrichRowsWithDiskSnapshot` / `mergeFolderItemsIntoDockRows` 在 **write_file 后同 turn** 触发 UI 刷新  
   - 槽 label「市场洞察」须能绑 `01-master-report.md`、`02-execution-checklist.md`（扩展 pathHints / fuzzy basename）

3. **长任务 auto-continue 与 Harness 对齐**  
   - GEO/增长/视频：引擎侧跑满 auto-continue；Harness 改为「进度 N/M 连续 2min 不变 + 无 still_thinking」或 **30min 上限**  
   - 避免 20min 截断时 folder 已有文件但汇总表未刷新（C4 R2）

4. **C7 视频硬失败路径**  
   - `render_html_video` 多次失败后：**UserActionRequired**（缺 Key/配额）或降级占位 mp4 说明  
   - 禁止无限「MP4 未完成」+ 过程 html/png 占满 folder

### P1 — 应做

5. **task-folder-snapshot 与 scopeDir**  
   - C5 `artifacts/razer-pro-click-geo/` snapshot 返回空 → 修复 API 索引或 Agent 落盘路径

6. **Harness 采集**  
   - 截图前强制展开 `[data-testid="deliverable-summary-table"]`（C4/C7 tableVisible=false 低估）  
   - 同时读 **folder 面板** 行状态作交叉验证

7. **DeliverableSummaryTable acceptance**  
   - i18n 为「已完成」、测试期望「已交付」→ 统一；unblock `test:sdm:acceptance`

### P2 — 观察项

8. **并行 workers=2** 与 Gateway 负载：长任务建议 **workers=1** 或分时段跑 GEO  
9. 将 C1 session 纳入 `analyze:task-completion --gate` 作短任务基线  

---

## 6. 测试终止声明

- **不再启动**新一轮 Playwright 实机（用户要求终止未测/追加项）  
- 已保留 **0709-Test-2** 全部会话、成果、JSONL、截图，供侧栏人工复核  
- 单元门禁：`DeliverableSummaryTable.folder-reconcile.test.tsx` **2/2 PASS**；`test:deliverable-triple-unify` **PASS**

---

## 7. 总体结论

| 维度 | 结论 |
|------|------|
| **UDC reconcile 修复** | 短任务 **C1 达标**；C5 汇总表可见度 **明显改善**；C8 结构正确但 **表/夹仍裂** |
| **六案 strict UDC 通过** | **0/6**（SDM metadata 缺失 + 长任务超时） |
| **业务可交付** | **C1 可交付**；C4/C5 有中间产物需续跑；C7 未交付 mp4 |
| **下一步** | 优先 **P0-1 SDM 写盘** + **P0-2 label/basename reconcile（C8）** + **P0-4 视频失败路径** |
