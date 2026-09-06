// PD-SAAS-FORK P0-D: ES9 repair-loop four-case anchors for L1 trust-copy replay.
export const ES9_REPAIR_LOOP_FOUR_CASES = [
  {
    id: "four-format-split",
    sessionIdPrefix: "web-s_34b7bf73",
    symptom: "quality passed + needs_repair split",
    forbiddenUserBubblePatterns: [/任务(?:已|全部)?完成.*needs_repair/is],
  },
  {
    id: "nova-academic-phantom-video",
    sessionIdPrefix: "web-s_b72fef48",
    symptom: "phantom promo-video cross task",
    scopeDir: "artifacts/task-20260722-be61b997",
    outOfScopePaths: [
      "artifacts/task-20260722-a7a1f199/promo-video.mp4",
    ],
  },
  {
    id: "academic-output-phantom",
    sessionIdPrefix: "web-s_81fc4eb1",
    symptom: "phantom promo-video + pdf/md mismatch",
    scopeDir: "artifacts/task-20260722-be61b997",
    outOfScopePaths: [
      "artifacts/task-20260722-a7a1f199/promo-video.mp4",
    ],
  },
  {
    id: "script-four-line-split",
    sessionIdPrefix: "web-s_582198d8",
    symptom: "footer vs debug progress split",
    forbiddenUserBubblePatterns: [/Failed tools:/i, /Something went wrong/i],
  },
] as const;

export type Es9RepairLoopCase = (typeof ES9_REPAIR_LOOP_FOUR_CASES)[number];
