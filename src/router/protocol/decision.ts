export type RouterScenarioType =
  | "default"
  | "subagent"
  | "explicit";

export type RouterDecisionResolution =
  | "explicit"
  | "scenario"
  | "tokenSaver"
  | "custom"
  | "fallback";

export type RouterMutationsLog = {
  systemPromptSlim?: { from: number; to: number; preservedKeywords: string[] };
  toolsStripped?: { before: number; after: number; mode?: "allowlist" | "blocklist"; patterns: string[] };
  orchestrationPromptInjected?: { tier: string; chars: number };
  asyncAgentLaunchedRewritten?: boolean;
  subagentTagStripped?: boolean;
  subagentModelOverride?: boolean;
};

export type RouterRequestPatch = Pick<
  import("../../model/protocol/canonical.js").CanonicalModelRequest,
  "messages" | "tools" | "systemPrompt"
>;

export type RouterDecision = {
  provider: string;
  model: string;
  scenarioType: RouterScenarioType;
  tokenSaverTier?: string;
  isSubagent: boolean;
  orchestrating: boolean;
  resolvedFrom: RouterDecisionResolution;
  mutations: RouterMutationsLog;
  requestPatch?: Partial<RouterRequestPatch>;
};

export type SessionRoutingState = {
  sessionId: string;
  isSubagent: boolean;
  tokenSaverTier?: string;
  stickyProvider?: string;
  stickyModel?: string;
  orchestrating: boolean;
  lastUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  updatedAt: number;
};

export type RouterDecisionInputUsageHint = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type RouterDecisionInput = {
  request: import("../../model/protocol/canonical.js").CanonicalModelRequest;
  sessionId: string;
  isMainAgent: boolean;
  metadata?: {
    lastUsage?: RouterDecisionInputUsageHint;
    explicitProvider?: string;
    explicitModel?: string;
    /** Tier from the previous turn; fed to the judge for context-aware classification. */
    previousTier?: string;
    /** PD-SAAS-FORK: Hub「试一下」绑定的能力 slug；设计类跳过 orchestrator 工具剥离 */
    capabilitySlug?: string;
    /** PD-SAAS-FORK: 能力大类（如 brainstorming）用于编排 bypass */
    majorCategory?: string;
    /** PD-SAAS-FORK: correlates TTFT stage spans with the active turn */
    runId?: string;
  };
};

export type RouterExecuteContext = {
  sessionId: string;
  turnId: string;
  projectPath?: string;
  abortSignal?: AbortSignal;
};
