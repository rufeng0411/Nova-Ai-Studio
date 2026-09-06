# GEO 多轮交付行为契约

## 范围

同一会话内 GEO 长任务：初始 profile 编译 → 用户取消部分交付 → 追加多份 HTML → 验收与路径守卫一致。

## 单会话单主任务目录（Primary Task Root）

- 默认：**add / remove / replace** 不新建 `artifacts/task-*`。
- 仅 **pivot**、manifest 清空 `taskArtifactDir`、或用户显式「新开任务/新文件夹」时分配新根。
- 特性开关：`PILOTDECK_STDA_ADD_PRESERVE_ROOT=1`（dev / pack 默认开）。

## SDM 变更

| 用户表述 | SDM 动作 |
|----------|----------|
| 小红书/知乎/公众号 + 不用/不做/取消 | remove `profile_geo_platform` |
| 三份报告 + HTML | add 3× `report-{n}-{slug}.html` slot（先于 generic index.html add） |
| 操作手册/白皮书 | add markdown slot，`geo-operation-manual.md` / `gep-operation-manual.md` 别名 |

`removed` slot 不进 `requiredFiles` / `missingPaths`。

## 写路径守卫

- Agent 显式写入 session 内已知 `artifacts/task-*` 路径时 **禁止** taskPathGuard 改道。
- 裸文件名仍重定向到 **primary**（非 latest STDA）。

## HTML 软匹配（过渡）

- Flag：`PILOTDECK_SDM_HTML_SLOT_FUZZY=1`
- 历史 jsonl 若仍留单 `index.html` slot，同 primary 目录下 `report-*.html` 数量 ≥ 活跃 html slot 数 → 视为 satisfied。

## 副作用门控

- 删除类风险仅匹配用户目标中的祈使/将来式；助手「已删除」叙述不拦截。
- 工作区 `artifacts/` / `task-*` 删除描述不拦截。

## 运维补救（可选）

```bash
node scripts/remediate-session-task-dirs.mjs --session web-s_xxx --dry-run
node scripts/remediate-session-task-dirs.mjs --session web-s_xxx --apply
```

将误分裂目录下的 `report-*.html` 合并到 primary，并更新 catalog 最新 manifest slot binding（不改历史 jsonl）。

## 验收

- `npm run test:sdm:replay` — WC-07 fixture
- `node scripts/replay-task-fixture.mjs tests/fixtures/task-recovery/geo-multi-turn-html.json`
- `npm run test:deliverable-paths`
