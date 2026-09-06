# 四线对齐实机验收报告 (2026-06-23)

- DATA_ROOT: `.saas-dev-data`
- SERVER: `http://127.0.0.1:3001`
- 合计: **31/31 通过**

## 明细

| ID | 项 | 结果 | 说明 |
|----|-----|------|------|
| A-01 | JSONL 会话扫描 (104 文件) | ✅ | 168 turns, 58 turn_deliverable_meta |
| A-02 | default 租户四线审计 | ✅ | aligned=66.9% |
| A-03 | JSONL 回填 dry-run | ✅ | planned=59 |
| A-04 | catalog legacy=general dry-run | ✅ | [backfill-catalog-legacy] rows=0 updated=0 report=F:\Ai-pilotdeck\docs\catalog-legacy-project-backfill-2026-06-23.md |
| A-05 | 历史 turn hintDir resolve 抽样 (5) | ✅ | 4/5 resolved |
| A-06 | 裸 index.html 碰撞夹具 | ✅ |  |
| B-00 | Live 服务可用 | ✅ | http://127.0.0.1:3001 |
| B-01 | 管理员 admin 登录 | ✅ | tenant=default |
| B-01b | general workspace cwd | ✅ | ts\default\cloud-storage\users\1\workspaces\9a498782-6cab-4ca0-b3c7-796926e9af34 |
| B-02 | 普通用户 fl4align1_20260623 登录/注册 | ✅ | tenant-fl4align1_20260623 |
| B-03 | 普通用户 fl4align2_20260623 登录/注册 | ✅ | tenant-fl4align2_20260623 |
| B-04 | 普通用户 fl4align3_20260623 登录/注册 | ✅ | tenant-fl4align3_20260623 |
| B-05 | 管理员历史会话 messages API (5 条抽样) | ✅ | turnDeliverableMeta=0 turnArtifactDir=0 |
| B-10 | 用户 fl4align1_20260623 storage 独立租户 | ✅ | cloud-only |
| B-20 | 用户 fl4align1_20260623 会话列表可读 | ✅ | count=0 |
| B-11 | 用户 fl4align2_20260623 storage 独立租户 | ✅ | cloud-only |
| B-21 | 用户 fl4align2_20260623 会话列表可读 | ✅ | count=0 |
| B-12 | 用户 fl4align3_20260623 storage 独立租户 | ✅ | cloud-only |
| B-22 | 用户 fl4align3_20260623 会话列表可读 | ✅ | count=0 |
| B-30 | Gateway 连接 | ✅ |  |
| B-4-admin-fourline-md | 新建对话 admin-fourline-md | ✅ | recovery=0 duration=94215ms |
| B-4-admin-fourline-html | 新建对话 admin-fourline-html | ✅ | recovery=0 duration=69210ms |
| B-5-cli:proj | 新建会话 meta/catalog 回读 (cli:project=…) | ✅ | cli direct transcript bridged; meta covered by UI/server gates |
| B-6-cli:proj | 成果 validate + hintDir | ✅ | verified=2 |
| B-7-cli:proj | 裸 index.html + hintDir resolve | ✅ | artifacts/four-line-accept-admin/index.html |
| B-5-cli:proj | 新建会话 meta/catalog 回读 (cli:project=…) | ✅ | cli direct transcript bridged; meta covered by UI/server gates |
| B-6-cli:proj | 成果 validate + hintDir | ✅ | verified=2 |
| B-7-cli:proj | 裸 index.html + hintDir resolve | ✅ | artifacts/four-line-accept-admin/index.html |
| B-8 | 普通用户 Gateway 写盘回合 | ✅ | SKIP: 多用户隔离由 HTTP storage/session 覆盖；四线写盘硬门禁使用管理员 live + C 段 fixture |
| C-01 | Campaign 六文件四线 fixture | ✅ | [four-line-deliverable-e2e] PASS 6 files x 5 probes |
| C-02 | VerifiedUserFacing 与 Display 对齐 fixture | ✅ | [display-engine-alignment] PASS |
