# SDM Phase 3 冲突矩阵

| 对立方 | 冲突点 | SDM 处置 | 结论 |
|--------|--------|----------|------|
| Goal Loop Phase 1 | continuationOwner 语义 | SDM 只供 missing 集合，不改 owner | ✅ |
| Phase 2 detectGoalPivot | 重复实现 | 复用模块 + AgentLoop 接线 | ✅ |
| 脑爆 chat-first | 强制 SDM | `userGoalImpliesDeliverable` 门控 | ✅ |
| GEO/Nova deck | profile 双命中 | SDM 从 profile 编译 slots | ✅ |
| extractDeliverableSessionUserGoal 末条 | sessionGoalAnchor 首条 | repair 读 SDM；resume 用 anchor | ✅ |
| TAIL_READ | SDM 头丢失 | head scan 64KB fallback | ✅ |
| Bridge turnDeliverableMetaWriter | 双写 manifest | engine meta 优先；SDM 仅引擎 | ✅ |
| frozen/active 表 | 多表 validate | 仅最新 active；上文 frozen 含 manifestVersion | ✅ |
| PILOTDECK_PLAN_LEDGER OFF | dock 无进度 | SDM 自算 done/total | ✅ |
| 历史 JSONL | 无 SDM 行 | 降级 turn manifest | ✅ |
| STDA add preserve-root | Goal Loop goalVersion+1 新建 task-* | add/remove/replace 复用 primary；仅 pivot forceNew | ✅ WC-07 |
| taskPathGuard 跨目录 | 显式写旧 task 根被改道 | knownTaskDirs 命中则保留原路径 | ✅ WC-07 |
| SDM 平台取消 | profile 仍 missing 社媒 | remove profile_geo_platform + filter missing | ✅ WC-07 |
