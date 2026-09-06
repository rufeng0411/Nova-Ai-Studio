// PD-SAAS-FORK: session durability — pin optimistic new-session rows across refresh/reconnect

const STORAGE_KEY = 'pilotdeck:pendingSessionIntents';
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_INTENTS = 20;

export type PendingSessionIntent = {
  optimisticId: string;
  projectKey: string;
  projectName?: string;
  firstPrompt?: string;
  realSessionId?: string;
  executionStatus?: 'queued' | 'running' | 'paused' | 'idle';
  ts: number;
};

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readAllIntentsRaw(): PendingSessionIntent[] {
  const store = safeLocalStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter((item): item is PendingSessionIntent => Boolean(item?.optimisticId && item?.projectKey))
      .filter((item) => now - (item.ts ?? 0) <= MAX_AGE_MS)
      .slice(0, MAX_INTENTS);
  } catch {
    return [];
  }
}

function writeAllIntents(intents: PendingSessionIntent[]): void {
  const store = safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(intents.slice(0, MAX_INTENTS)));
  } catch {
    // quota / private mode
  }
}

export function savePendingSessionIntent(intent: Omit<PendingSessionIntent, 'ts'> & { ts?: number }): void {
  const payload: PendingSessionIntent = {
    ...intent,
    ts: intent.ts ?? Date.now(),
  };
  const intents = readAllIntentsRaw().filter((item) => item.optimisticId !== payload.optimisticId);
  intents.unshift(payload);
  writeAllIntents(intents);
}

export function readPendingSessionIntents(): PendingSessionIntent[] {
  return readAllIntentsRaw();
}

/** @deprecated single-slot compat */
export function readPendingSessionIntent(): PendingSessionIntent | null {
  return readPendingSessionIntents()[0] ?? null;
}

export function clearPendingSessionIntent(optimisticId?: string): void {
  if (!optimisticId) {
    writeAllIntents([]);
    return;
  }
  writeAllIntents(
    readAllIntentsRaw().filter(
      (item) => item.optimisticId !== optimisticId && item.realSessionId !== optimisticId,
    ),
  );
}

export function stampPendingSessionRealId(realSessionId: string, optimisticId?: string): void {
  const intents = readAllIntentsRaw();
  if (intents.length === 0) return;
  const updated = intents.map((item) => {
    if (optimisticId && item.optimisticId !== optimisticId) return item;
    if (!optimisticId || item.optimisticId === optimisticId) {
      return { ...item, realSessionId };
    }
    return item;
  });
  writeAllIntents(updated);
}

export function updatePendingSessionExecutionStatus(
  sessionId: string,
  executionStatus: PendingSessionIntent['executionStatus'],
): void {
  const intents = readAllIntentsRaw();
  const updated = intents.map((item) => {
    if (item.realSessionId === sessionId || item.optimisticId === sessionId) {
      return { ...item, realSessionId: item.realSessionId ?? sessionId, executionStatus };
    }
    return item;
  });
  writeAllIntents(updated);
}

export function prunePendingSessionIntentsPresentInProjects(
  projects: Array<{ sessions?: Array<{ id: string }> }>,
): void {
  const intents = readAllIntentsRaw();
  if (intents.length === 0) return;

  const serverIds = new Set<string>();
  for (const project of projects) {
    for (const session of project.sessions ?? []) {
      serverIds.add(session.id);
      serverIds.add(session.id.replace(/^web:s_/, 'web-s_'));
    }
  }

  const pruned = intents.filter((intent) => {
    const candidates = [intent.realSessionId, intent.optimisticId].filter(Boolean) as string[];
    return !candidates.some(
      (id) => serverIds.has(id) || serverIds.has(id.replace(/^web:s_/, 'web-s_')),
    );
  });
  if (pruned.length !== intents.length) {
    writeAllIntents(pruned);
  }
}

export function mergePendingSessionIntentIntoProjects<T extends {
  name: string;
  sessions?: Array<{ id: string; title?: string; created_at?: string; updated_at?: string; lastActivity?: string; messageCount?: number; __projectName?: string; executionStatus?: string }>;
}>(projects: T[]): T[] {
  const intents = readPendingSessionIntents();
  if (intents.length === 0) return projects;

  return projects.map((project) => {
    const relevant = intents.filter((intent) => {
      const projectName = (intent.projectName || intent.projectKey || '').trim();
      return projectName === project.name;
    });
    if (relevant.length === 0) return project;

    let sessions = project.sessions ?? [];
    for (const intent of relevant) {
      const sessionId = intent.realSessionId || intent.optimisticId;
      const now = new Date(intent.ts).toISOString();
      const exists = sessions.some(
        (s) => s.id === sessionId || s.id.replace(/^web:s_/, 'web-s_') === sessionId.replace(/^web:s_/, 'web-s_'),
      );
      if (exists) continue;
      const placeholder = {
        id: sessionId,
        title: intent.firstPrompt?.slice(0, 80) || 'New session',
        created_at: now,
        updated_at: now,
        lastActivity: now,
        messageCount: 0,
        __projectName: project.name,
        executionStatus: intent.executionStatus ?? 'queued',
      };
      sessions = [placeholder, ...sessions];
    }
    return { ...project, sessions };
  });
}
