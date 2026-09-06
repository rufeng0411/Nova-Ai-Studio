# 四线对齐实机验收报告 (2026-06-22)

- DATA_ROOT: `.saas-dev-data`
- SERVER: `http://127.0.0.1:3001`
- 合计: **24/24 通过**

## 明细

| ID | 项 | 结果 | 说明 |
|----|-----|------|------|
| A-01 | JSONL 会话扫描 (90 文件) | ✅ | 136 turns, 87 turn_deliverable_meta |
| A-02 | default 租户四线审计 | ✅ | aligned=69.4% |
| A-03 | JSONL 回填 dry-run | ✅ | planned=0 |
| A-04 | catalog legacy=general dry-run | ✅ | [backfill-catalog-legacy] rows=0 updated=0 report=F:\Ai-pilotdeck\docs\catalog-legacy-project-backfill-2026-06-22.md |
| A-05 | 历史 turn hintDir resolve 抽样 (5) | ✅ | 4/5 resolved |
| A-06 | 裸 index.html 碰撞夹具 | ✅ |  |
| B-00 | Live 服务可用 | ✅ | http://127.0.0.1:3001 |
| B-01 | 管理员 admin 登录 | ✅ | tenant=default |
| B-01b | general workspace cwd | ✅ | ts\default\cloud-storage\users\1\workspaces\9a498782-6cab-4ca0-b3c7-796926e9af34 |
| B-02 | 普通用户 fl4align1_20260622 登录/注册 | ✅ | tenant-fl4align1_20260622 |
| B-03 | 普通用户 fl4align2_20260622 登录/注册 | ✅ | tenant-fl4align2_20260622 |
| B-04 | 普通用户 fl4align3_20260622 登录/注册 | ✅ | tenant-fl4align3_20260622 |
| B-05 | 管理员历史会话 messages API (5 条抽样) | ✅ | turnDeliverableMeta=5 turnArtifactDir=5 |
| B-10 | 用户 fl4align1_20260622 storage 独立租户 | ✅ | cloud-only |
| B-20 | 用户 fl4align1_20260622 会话列表可读 | ✅ | count=0 |
| B-11 | 用户 fl4align2_20260622 storage 独立租户 | ✅ | cloud-only |
| B-21 | 用户 fl4align2_20260622 会话列表可读 | ✅ | count=0 |
| B-12 | 用户 fl4align3_20260622 storage 独立租户 | ✅ | cloud-only |
| B-22 | 用户 fl4align3_20260622 会话列表可读 | ✅ | count=0 |
| B-4-fixture | 预置成果文件（fixture） | ✅ | F:\Ai-pilotdeck\.saas-dev-data\tenants\default\cloud-storage\users\1\workspaces\9a498782-6cab-4ca0-b3c7-796926e9af34\artifacts\four-line-accept-admin |
| B-5-fixture | fixture validate + meta | ✅ | verified=2 |
| B-6-fixture | fixture hintDir validate | ✅ | verified=2 |
| B-7-fixture | 裸 index.html + hintDir resolve | ✅ | artifacts/four-line-accept-admin/index.html |
| B-8 | 普通用户 Gateway 对话 | ✅ | SKIP fixture mode |
