// PD-SAAS-FORK: Goal Loop P2 Step-I — detect follow-up deliverable kind changes within a session.
import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import {
  buildTaskGoalContract,
  type TaskGoalContract,
} from "./taskGoalContract.js";
import { matchesExplicitAddPattern } from "./detectGoalMutation.js";

export type DetectGoalPivotInput = {
  previousContract?: TaskGoalContract;
  newUserText: string;
  capabilitySlug?: string;
  majorCategory?: string;
  profileId?: string;
};

export type DetectGoalPivotResult = {
  pivot: boolean;
  reason?: "continuation_only" | "new_deliverable_kinds" | "profile_change" | "required_files_expanded";
  nextContract?: TaskGoalContract;
};

function kindSet(contract: TaskGoalContract): Set<string> {
  return new Set(contract.expectedKinds.map((kind) => kind));
}

/** True when a new user message introduces incompatible deliverable expectations. */
export function detectGoalPivot(input: DetectGoalPivotInput): DetectGoalPivotResult {
  const text = String(input.newUserText ?? "").trim();
  if (!text) return { pivot: false };
  if (isContinuationOnlyUserText(text)) {
    return { pivot: false, reason: "continuation_only" };
  }
  // PD-SAAS-FORK: 用户粘贴成果清单/追问未完成项不是 pivot
  if (
    /标准成果清单|成果清单|文件链接|校验中|未完成/i.test(text)
    && text.length > 80
  ) {
    return { pivot: false, reason: "continuation_only" };
  }
  // PD-SAAS-FORK (ROG Phase 5): short vague follow-ups are not pivots; explicit deliverable kinds still are.
  if (
    text.length < 40
    && !matchesExplicitAddPattern(text)
    && !/(?:ppt|pptx|html|pdf|docx|markdown|md|png|jpg)/i.test(text)
  ) {
    return { pivot: false, reason: "continuation_only" };
  }
  if (!input.previousContract) {
    return { pivot: false };
  }

  const nextContract = buildTaskGoalContract({
    userGoal: text,
    previousContract: input.previousContract,
    capabilitySlug: input.capabilitySlug,
    majorCategory: input.majorCategory,
    profileId: input.profileId,
  });

  const prevKinds = kindSet(input.previousContract);
  const nextKinds = kindSet(nextContract);
  const introducedKinds = [...nextKinds].filter((kind) => !prevKinds.has(kind));
  if (introducedKinds.length > 0) {
    const onlyKindOnlyHtml = introducedKinds.length === 1
      && introducedKinds[0] === "html"
      && input.previousContract.requiredFiles.length > 0
      && !matchesExplicitAddPattern(text);
    if (onlyKindOnlyHtml) {
      return { pivot: false, reason: "continuation_only" };
    }
    return { pivot: true, reason: "new_deliverable_kinds", nextContract };
  }

  if (
    nextContract.profileId
    && input.previousContract.profileId
    && nextContract.profileId !== input.previousContract.profileId
  ) {
    return { pivot: true, reason: "profile_change", nextContract };
  }

  const prevRequired = new Set(input.previousContract.requiredFiles);
  const expandedRequired = nextContract.requiredFiles.filter((file) => !prevRequired.has(file));
  if (expandedRequired.length > 0 && nextContract.requiredFiles.length > input.previousContract.requiredFiles.length) {
    return { pivot: true, reason: "required_files_expanded", nextContract };
  }

  return { pivot: false };
}

export function rebuildTaskGoalContractOnPivot(input: DetectGoalPivotInput): TaskGoalContract | undefined {
  const pivot = detectGoalPivot(input);
  return pivot.pivot ? pivot.nextContract : undefined;
}
