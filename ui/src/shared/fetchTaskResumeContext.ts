// PD-SAAS-FORK: fetch structured task-resume XML from session transcript API

import { api } from '../utils/api';

export type SessionResumeContextResponse = {
  resumeContext: string | null;
  incomplete?: {
    turnId: string;
    userGoal?: string;
    lastCompletedStep?: number;
    blockedOn?: string;
  } | null;
};

export async function fetchTaskResumeContext(
  sessionId: string,
  projectName?: string,
  projectPath?: string,
): Promise<string | null> {
  const response = await api.sessionResumeContext(sessionId, { projectName, projectPath });
  if (!response.ok) return null;
  const payload = (await response.json()) as SessionResumeContextResponse;
  return typeof payload?.resumeContext === 'string' && payload.resumeContext.trim()
    ? payload.resumeContext.trim()
    : null;
}
