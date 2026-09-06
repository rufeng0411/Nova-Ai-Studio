# 0709-TEST 代表性失败案例实机复测报告

**时间**：2026-07-08T20:21:35.484Z  
**项目**：admin → **0709-TEST**（slug: `workspaces-0709-TEST`）  
**环境**：`http://127.0.0.1:8081` / Bridge `http://127.0.0.1:7990`  
**明细 JSONL**：`artifacts/0709-TEST/logs/0709-live-retest.jsonl`

## 结论摘要

| 维度 | 结果 |
|------|------|
| 总案例 | 12 |
| 自动化门禁（无 repair 泄漏 / 无断网 / 有响应） | **12/12** |
| **真实交付完成**（快照时 Dock 全绿或正文确认完成） | **2/12**（0708-01、v1-copy-to-html-delay） |
| **部分推进**（有成果但未全槽位完成） | **2/12**（0708-10 约 2/3、0708-02 约 9/14） |
| **已启动、Harness 早退**（~2min 采样，任务在 UI 中可能仍在跑） | **8/12** |

> **说明**：第二轮 Harness 为防 Playwright 全局超时，在「交付进度稳定 90–120s」后采样退出，**不等于** L4 全量跑满。第一轮 G1 前两案（0708-10/0708-02）各等待 **8–12 分钟**，Dock 数据更有参考价值。

## 分组结果

| 组 | 说明 | 通过/总数 |
|----|------|-----------|
| G1-SDM | SDM/投放/Campaign 槽位 | 3/3 |
| G2-PPT | PPT 三线 repair 风暴 | 3/3 |
| G3-0707-2 | 0707-2 小罐茶 L4 三线 | 3/3 |
| G4-MISC | HTML/调研/落地页 | 3/3 |

## 案例明细

| case | 基线症状 | sessionId | status | outcome | Dock行 | SDM slots | repair UI | error |
|------|----------|-----------|--------|---------|--------|-----------|-----------|-------|
| 0708-10 | d26c105d needs_repair; 模板槽占 mkt-ads; 足球串 |  | pass | still_thinking | 3 | 0 | 否 |  |
| 0708-02 | 6d40823c campaign 全案 repair; build-brief |  | pass | still_thinking | 14 | 0 | 否 |  |
| 0708-07 | 350cb55e 内容营销三步 contract 行数漂移 | web-s_155a558c-b6a1-476f-8b1b-49baea2d5ad1 | pass | still_thinking | 0 | 0 | 否 |  |
| ET-PPT-01 | aad78932 needs_repair×146; df-ppt 误路由 | web-s_af022b10-7f44-495b-8ba3-e549db298799 | pass | still_thinking | 0 | 0 | 否 |  |
| ET-PPT-02 | b2721bdd needs_repair×232; false_incompl | web-s_c34a6577-c814-47da-ad69-38c8bbe256a6 | pass | still_thinking | 0 | 0 | 否 |  |
| ET-PPT-03 | 517c6c7e needs_repair×118; verified∩brok | web-s_b3484e82-ccd4-4a99-96cc-748233d06c78 | pass | still_thinking | 0 | 0 | 否 |  |
| T0707-2-P0-01 | 188fa4a3 campaign SDM repair 风暴 | web-s_5b0b160a-a232-4e04-a833-04a8f3ee49e6 | pass | still_thinking | 0 | 0 | 否 |  |
| T0707-2-P0-02 | c2ff6893 视频 API/env; 无真 mp4 | web-s_1d1bf62f-be36-4731-9348-c3845823c78f | pass | still_thinking | 0 | 0 | 否 |  |
| T0707-2-P0-03 | c5ce7d65 battlecard 三步首回合停 | web-s_eca4cc5d-5599-4942-8967-a42335f623fe | pass | still_thinking | 0 | 0 | 否 |  |
| 0708-01 | a7023e53 杂志风 index.html 槽位 | web-s_05b83efb-0dbc-439b-bd8d-a65886400052 | pass | assistant | 1 | 0 | 否 |  |
| ET-RES-01 | 0ffbb6a3 Nova-竞品对标 turn4+ repair | web-s_7c8ab3d2-ec6c-4bd0-91b5-7eae46794d0f | pass | still_thinking | 0 | 0 | 否 |  |
| v1-copy-to-html-delay | 终验0702 广告文案→HTML 落地页延迟/缺失 | web-s_cf6a9bf5-92ac-42a0-936c-6d724d122e31 | pass | assistant | 1 | 0 | 否 |  |

**保留声明**：0709-TEST 项目及全部会话/成果/截图未删除，可在侧栏与文件树查阅。

## 会话索引（admin → 0709-TEST）

| case | sessionId | 链接 |
|------|-----------|------|
| 0708-10 | web-s_564ba769-ef63-4629-b91c-6e7d5087230e | http://127.0.0.1:8081/session/web-s_564ba769-ef63-4629-b91c-6e7d5087230e |
| 0708-02 | web-s_011379e8-74b5-4d97-8037-84650c782486 | http://127.0.0.1:8081/session/web-s_011379e8-74b5-4d97-8037-84650c782486 |
| 0708-07 | web-s_155a558c-b6a1-476f-8b1b-49baea2d5ad1 | http://127.0.0.1:8081/session/web-s_155a558c-b6a1-476f-8b1b-49baea2d5ad1 |
| ET-PPT-01 | web-s_af022b10-7f44-495b-8ba3-e549db298799 | http://127.0.0.1:8081/session/web-s_af022b10-7f44-495b-8ba3-e549db298799 |
| ET-PPT-02 | web-s_c34a6577-c814-47da-ad69-38c8bbe256a6 | http://127.0.0.1:8081/session/web-s_c34a6577-c814-47da-ad69-38c8bbe256a6 |
| ET-PPT-03 | web-s_b3484e82-ccd4-4a99-96cc-748233d06c78 | http://127.0.0.1:8081/session/web-s_b3484e82-ccd4-4a99-96cc-748233d06c78 |
| T0707-2-P0-01 | web-s_5b0b160a-a232-4e04-a833-04a8f3ee49e6 | http://127.0.0.1:8081/session/web-s_5b0b160a-a232-4e04-a833-04a8f3ee49e6 |
| T0707-2-P0-02 | web-s_1d1bf62f-be36-4731-9348-c3845823c78f | http://127.0.0.1:8081/session/web-s_1d1bf62f-be36-4731-9348-c3845823c78f |
| T0707-2-P0-03 | web-s_eca4cc5d-5599-4942-8967-a42335f623fe | http://127.0.0.1:8081/session/web-s_eca4cc5d-5599-4942-8967-a42335f623fe |
| 0708-01 | web-s_05b83efb-0dbc-439b-bd8d-a65886400052 | http://127.0.0.1:8081/session/web-s_05b83efb-0dbc-439b-bd8d-a65886400052 |
| ET-RES-01 | web-s_7c8ab3d2-ec6c-4bd0-91b5-7eae46794d0f | http://127.0.0.1:8081/session/web-s_7c8ab3d2-ec6c-4bd0-91b5-7eae46794d0f |
| v1-copy-to-html-delay | web-s_cf6a9bf5-92ac-42a0-936c-6d724d122e31 | http://127.0.0.1:8081/session/web-s_cf6a9bf5-92ac-42a0-936c-6d724d122e31 |

截图目录：`artifacts/0709-TEST/screenshots/`

