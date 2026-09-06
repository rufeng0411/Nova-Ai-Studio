// PD-SAAS-FORK: N2 Bot β shared types (ops / route / peek).

export type N2OpsStatus = "need" | "run" | "queue" | "plan" | "done";
export type N2RouteTier = "T0" | "T1" | "T2" | "T3";

export type N2UtteranceKind =
  | "wake"
  | "chat"
  | "identity"
  | "thanks"
  | "status"
  | "progress"
  | "delegate"
  | "schedule"
  | "quality_feedback"
  | "continue_blocked"
  | "open"
  | "peek_close"
  | "peek_next"
  | "peek_prev"
  | "peek_switch"
  | "save"
  | "share"
  | "send"
  | "allow"
  | "pause"
  | "resume"
  | "stopall"
  | "retry"
  | "close"
  | "lock"
  | "unlock"
  | "complete_task"
  | "uncomplete_task"
  | "delete_record"
  | "confirm_delete";

export type N2OpsFile = {
  path: string;
  kind: string;
  label: string;
};

export type N2OpsItem = {
  workerSessionId: string;
  title: string;
  status: N2OpsStatus;
  step: string;
  done?: number;
  total?: number;
  wait?: string;
  issue?: "quota" | "send" | "preview" | "";
  files?: N2OpsFile[];
  ownerUserId?: number;
  sessionKind?: string | null;
  greetingIdle?: boolean;
  delegatedBy?: string | null;
  /** Catalog project key; general sessions use "general". */
  projectKey?: string;
  /** User-facing folder name: 通用 or a project displayName. */
  projectLabel?: string;
  isGeneral?: boolean;
  lastActivityAt?: string;
  /** Count of verified / bound result files. */
  outcomeCount?: number;
  hasOutcomes?: boolean;
};

export type N2OpsRailSection =
  | { kind: "live"; id: "live"; label: string; items: N2OpsItem[] }
  | { kind: "general"; id: "general"; label: string; items: N2OpsItem[] }
  | { kind: "project"; id: string; label: string; items: N2OpsItem[] };

export type N2ElicitOption = {
  id: string;
  label: string;
  recommended?: boolean;
};

export type N2ElicitCard = {
  id: string;
  kind: "confirm_delete" | "allow_send" | "unlock_then_delete" | "choose" | "need_file";
  title: string;
  body: string;
  options: N2ElicitOption[];
  confirmToken?: string;
  sessionIds?: string[];
};

export type N2ChatRole = "user" | "nova";

export type N2ChatMessage = {
  id: string;
  role: N2ChatRole;
  text: string;
  via?: "text" | "voice";
};
