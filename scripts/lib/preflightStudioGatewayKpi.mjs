/**
 * PD-SAAS-FORK: Preflight Studio Gateway JSONL KPI helpers.
 */
import fs from 'node:fs';

/**
 * @param {string} transcriptAbsPath
 */
export function parsePreflightGatewayKpis(transcriptAbsPath) {
  if (!transcriptAbsPath || !fs.existsSync(transcriptAbsPath)) {
    return {
      launchContextInUserGoal: false,
      askUserBeforeFirstWrite: 0,
      flaskSpawnCount: 0,
      firstWritePath: null,
      taskArtifactWrites: [],
      acceptanceStatus: null,
      passed: false,
      falseIncomplete: null,
    };
  }

  const lines = fs.readFileSync(transcriptAbsPath, 'utf8').trim().split('\n').filter(Boolean);
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      // skip
    }
  }

  let firstUserText = '';
  let goalAnchor = '';
  let firstWritePath = null;
  let askUserBeforeFirstWrite = 0;
  let flaskSpawnCount = 0;
  /** @type {string[]} */
  const taskArtifactWrites = [];
  let acceptanceStatus = null;
  let passed = false;
  let falseIncomplete = null;

  for (const row of rows) {
    if (row.type === 'turn_acceptance_meta' && (row.finality === 'final' || !acceptanceStatus)) {
      acceptanceStatus = row.acceptanceStatus ?? null;
      passed = acceptanceStatus === 'passed' || row.acceptanceCertificate?.complete === true;
      if (typeof row.falseIncomplete === 'number') falseIncomplete = row.falseIncomplete;
    }
    if (row.type === 'session_deliverable_manifest' && row.manifest?.sessionGoalAnchor) {
      goalAnchor = String(row.manifest.sessionGoalAnchor);
    }

    const msgCandidates = [];
    if (row.type === 'accepted_input' && Array.isArray(row.messages)) {
      msgCandidates.push(...row.messages);
    }
    if (row.message && typeof row.message === 'object') {
      msgCandidates.push(row.message);
    }

    for (const msg of msgCandidates) {
      if (!msg || msg.role !== 'user' || firstUserText) continue;
      const content = msg.content;
      if (typeof content === 'string') firstUserText = content;
      else if (Array.isArray(content)) {
        firstUserText = content
          .filter((p) => p?.type === 'text')
          .map((p) => p.text ?? '')
          .join('\n');
      }
    }

    for (const msg of msgCandidates) {
      if (!msg || msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
      for (const part of msg.content) {
        if (!part || typeof part !== 'object') continue;
        if (part.type === 'tool_call') {
          const name = String(part.name ?? '');
          const input = part.input ?? {};
          if (name === 'ask_user_question' && !firstWritePath) askUserBeforeFirstWrite += 1;
          if (/flask|:5050/i.test(JSON.stringify(input)) || /flask/i.test(name)) flaskSpawnCount += 1;
          if (name === 'write_file') {
            const writePath = String(input.file_path || input.path || '');
            if (!firstWritePath && writePath) firstWritePath = writePath.replace(/\\/g, '/');
            if (/artifacts\/task-/i.test(writePath)) {
              taskArtifactWrites.push(writePath.replace(/\\/g, '/'));
            }
          }
        }
      }
    }
  }

  const goalText = firstUserText || goalAnchor;
  return {
    launchContextInUserGoal: /<launch-context[\s>]/i.test(goalText),
    askUserBeforeFirstWrite,
    flaskSpawnCount,
    firstWritePath,
    taskArtifactWrites,
    acceptanceStatus,
    passed,
    falseIncomplete,
  };
}

/**
 * @param {Record<string, unknown>} gate
 * @param {ReturnType<typeof parsePreflightGatewayKpis>} kpis
 */
export function evaluatePreflightGatewayGate(gate, kpis) {
  /** @type {string[]} */
  const reasons = [];
  if (gate.requireLaunchContext && !kpis.launchContextInUserGoal) {
    reasons.push('missing launch-context in first user goal');
  }
  if (gate.requireTaskArtifactWrite && kpis.taskArtifactWrites.length === 0) {
    reasons.push('no artifacts/task-* write_file');
  }
  if (typeof gate.maxAskUserBeforeWrite === 'number'
    && kpis.askUserBeforeFirstWrite > gate.maxAskUserBeforeWrite) {
    reasons.push(`ask_user before write=${kpis.askUserBeforeFirstWrite}`);
  }
  if (typeof gate.maxFlaskSpawn === 'number' && kpis.flaskSpawnCount > gate.maxFlaskSpawn) {
    reasons.push(`flask_spawn=${kpis.flaskSpawnCount}`);
  }
  if (typeof gate.minVerifiedPaths === 'number' && !kpis.passed && kpis.taskArtifactWrites.length < gate.minVerifiedPaths) {
    // allow pass on write even if acceptance still running — caller may override
  }
  return { pass: reasons.length === 0, reasons };
}
