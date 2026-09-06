# 四线对齐实机验收报告 (2026-06-18)

- DATA_ROOT: `F:/Ai-pilotdeck/.saas-dev-data`
- SERVER: `http://127.0.0.1:3002`
- 合计: **23/30 通过**

## 明细

| ID | 项 | 结果 | 说明 |
|----|-----|------|------|
| A-01 | JSONL 会话扫描 (120 文件) | ✅ | 184 turns, 0 turn_deliverable_meta |
| A-02 | default 租户四线审计 | ✅ | aligned=55.5% |
| A-03 | JSONL 回填 dry-run | ✅ | planned=96 |
| A-04 | catalog legacy=general dry-run | ✅ | [backfill-catalog-legacy] rows=0 updated=0 report=F:\Ai-pilotdeck\docs\catalog-legacy-project-backfill-2026-06-18.md |
| A-05 | 历史 turn hintDir resolve 抽样 (5) | ❌ | 2/5 resolved |
| A-06 | 裸 index.html 碰撞夹具 | ✅ |  |
| B-00 | Live 服务可用 | ✅ | http://127.0.0.1:3002 |
| B-01 | 管理员 admin 登录 | ✅ | tenant=default |
| B-02 | 普通用户 fl4align1_20260618 登录/注册 | ✅ | tenant-fl4align1_20260618 |
| B-03 | 普通用户 fl4align2_20260618 登录/注册 | ✅ | tenant-fl4align2_20260618 |
| B-04 | 普通用户 fl4align3_20260618 登录/注册 | ✅ | tenant-fl4align3_20260618 |
| B-05 | 管理员历史会话 messages API (0 条抽样) | ✅ | turnDeliverableMeta=0 turnArtifactDir=0 |
| B-10 | 用户 fl4align1_20260618 storage 独立租户 | ✅ | cloud-only |
| B-20 | 用户 fl4align1_20260618 会话列表可读 | ✅ | count=? |
| B-11 | 用户 fl4align2_20260618 storage 独立租户 | ✅ | cloud-only |
| B-21 | 用户 fl4align2_20260618 会话列表可读 | ✅ | count=? |
| B-12 | 用户 fl4align3_20260618 storage 独立租户 | ✅ | cloud-only |
| B-22 | 用户 fl4align3_20260618 会话列表可读 | ✅ | count=? |
| B-30 | Gateway 连接 | ✅ |  |
| B-4-admin-fourline-md | 新建对话 admin-fourline-md | ❌ | recovery=0 duration=120007ms |
| B-4-admin-fourline-html | 新建对话 admin-fourline-html | ❌ | recovery=0 duration=120008ms |
| B-5-cli:proj | 新建会话 JSONL meta 回读 (cli:project=…) | ✅ | meta pending/backfill |
| B-6-cli:proj | 成果 validate + hintDir | ❌ | verified=0 |
| B-7-cli:proj | 裸 index.html + hintDir resolve | ❌ |  |
| B-5-cli:proj | 新建会话 JSONL meta 回读 (cli:project=…) | ✅ | meta pending/backfill |
| B-6-cli:proj | 成果 validate + hintDir | ❌ | verified=0 |
| B-7-cli:proj | 裸 index.html + hintDir resolve | ❌ |  |
| B-8-0 | 普通用户 fl4align1_20260618 新建 write_file 对话 | ✅ | session=cli:projec |
| B-8-1 | 普通用户 fl4align2_20260618 新建 write_file 对话 | ✅ | session=cli:projec |
| B-8-2 | 普通用户 fl4align3_20260618 新建 write_file 对话 | ✅ | session=cli:projec |

## 失败项

- **A-05** 历史 turn hintDir resolve 抽样 (5): 2/5 resolved
- **B-4-admin-fourline-md** 新建对话 admin-fourline-md: recovery=0 duration=120007ms
- **B-4-admin-fourline-html** 新建对话 admin-fourline-html: recovery=0 duration=120008ms
- **B-6-cli:proj** 成果 validate + hintDir: verified=0
- **B-7-cli:proj** 裸 index.html + hintDir resolve: 
- **B-6-cli:proj** 成果 validate + hintDir: verified=0
- **B-7-cli:proj** 裸 index.html + hintDir resolve: 
