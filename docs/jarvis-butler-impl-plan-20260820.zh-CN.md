# 贾维斯管家 · 实现计划（细则）

> **Build 入口**：Cursor 计划卡 `jarvis_butler_design_eecd8bdf.plan.md`。本文是路径/接口对照，不是点 Build 的入口。  
> 视觉权威：`artifacts/saas-design/jarvis-butler/index.html`（设计已确认）。  
> 产品权威：`docs/jarvis-butler-design-20260820.zh-CN.md`。

未听到「可以开发」或未点 Build：**禁止**写 React / Gateway。

## 锁死

- 每用户一条管家。`sessionKind: jarvis_steward`。代码名 `jarvisButler`。
- 唯一布局：左沟通 / 右手头。不做 v1/v2/v3。Beta 首页不要三栏会话列表。
- 管家零 SDM / STDA / `deliverable_repair` / 成果清单 sticky。右侧叫「手头」。
- Hub「试一下」禁止把 `capabilityContext` 绑到管家。口令进管家，再开工人。
- 工人走现有 `acceptTurn`（`ui/server/saas/concurrency/turnAcceptanceService.js`）→ Gateway `submitTurn` → SDM → 验收。Turn Queue 默认 7。
- 「再出个 HTML」打到**已有工人** `detectGoalMutation` ADD（`src/saas/taskState/sessionDeliverableManifest.ts`）。
- 完成权威：`turn_acceptance_meta` + 证书 `complete`。
- UI 只上 `/app-1.1-beta`。禁止改现网 `/app`。禁止改 AgentLoop 核心仲裁。
- 中文「贾维斯」，英文 UI「Steward」。禁止 PilotDeck、交付物、金色、Sir、主人。
- Flag `PILOTDECK_JARVIS_BUTLER=off|shadow|enforce`。`scripts/release/pack.mjs` + `scripts/release/apply-cloud-perf-env.sh` + `scripts/lib/devLauncherCore.mjs` 三处同步。pack 默认 `off`。dev 可注入 `shadow`。回滚：三处改回 `off`。
- 改上游核心加 `PD-SAAS-FORK`，登记 `config/pilotdeck-core-fork.manifest.json`。
- 禁止 commit / pull / merge 除非用户明示。Step 0 只打 `restore-point/pre-jarvis-butler-*` 标签。

## 灰度

| 档 | 行为 |
|----|------|
| off | Beta 仍是现网三栏对话。无管家会话。 |
| shadow | HUD 可进（Beta 内入口）；委派走工人；管家 turn 打 telemetry；默认首页仍可是旧欢迎页。 |
| enforce | Beta 首页就是 HUD。无会话列表当首页。 |

## 模块

新逻辑只放：

- `src/saas/jarvisButler/`
- `ui/server/saas/jarvis/`
- `ui/src/saas/jarvis-butler/`

视觉 token 抄 `ui/src/saas/workbench-beta/theme/workbenchBetaTokens.css` + Demo `artifacts/saas-design/jarvis-butler/tokens.css`（电蓝 217°，完成 `--success`）。

## 关键接口（后任务必须同名）

```ts
export type JarvisButlerMode = "off" | "shadow" | "enforce";
export type JarvisSessionKind = "jarvis_steward";
export type JarvisOpsStatus = "need" | "run" | "queue" | "plan" | "done";
export type JarvisUtteranceKind =
  | "status" | "progress" | "delegate" | "schedule"
  | "open" | "save" | "share" | "send" | "allow"
  | "pause" | "resume" | "stopall" | "retry" | "close";

export function isJarvisButlerMode(raw: string | undefined): JarvisButlerMode;
export function isJarvisStewardSession(kind?: string | null): boolean;
export function shouldSkipDeliverableContract(kind?: string | null): boolean;
export function classifyJarvisUtterance(text: string): JarvisUtteranceKind;

export type JarvisOpsItem = {
  workerSessionId: string;
  title: string;
  status: JarvisOpsStatus;
  kind?: string;
  step: string;
  done?: number;
  total?: number;
  wait?: string;
  issue?: "quota" | "send" | "preview" | "";
  files?: string[];
};

export type JarvisDelegateBody = {
  utterance: string;
  attachmentNames?: string[];
  capabilitySlug?: string;
  followUpWorkerSessionId?: string;
};
```

`POST /api/saas/jarvis/delegate`：在工人会话上 `acceptTurn`，**禁止**对管家会话 `acceptTurn` 出成果 turn。

`GET /api/saas/jarvis/ops`：手头列表。数据源 catalog 队列态 + `turn_acceptance_meta` + 证书 `complete`。不要 glob 扫盘增槽。

## 验收分级

- **L0**：单测（零契约、分类、Hub 不绑管家、flag parse）
- **L1**：`npm run check:saas-fork` + `npm run brand:check`
- **L2**：Gateway 进程 `PILOTDECK_JARVIS_BUTLER=enforce`：委派开工人；管家 jsonl 无 `session_deliverable_manifest`
- **L3**：Playwright `/app-1.1-beta` HUD：左圆徽右手头；外发有允许；`/app` 三栏不变
- **L4**：telemetry `jarvis_delegate` / `jarvis_ops_status` / `jarvis_contract_skipped`（shadow 只记不改路径）

KPI（有命令才算数）：`false_incomplete=0`（管家会话）；工人会话仍走现网验收；Hub 试一下不给管家写 `capabilityContext`。
