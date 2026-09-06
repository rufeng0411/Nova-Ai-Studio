import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AgentSession,
  createAgentSessionStateFromReplay,
} from '../../src/agent/session/AgentSession.ts';
import { TurnRunner } from '../../src/agent/turn/TurnRunner.ts';
import { InMemoryTranscriptWriter } from '../../src/session/transcript/InMemoryTranscriptWriter.ts';
import { JsonlTranscriptWriter } from '../../src/session/transcript/JsonlTranscriptWriter.ts';
import { replayTranscriptEntries } from '../../src/session/transcript/TranscriptReplay.ts';
import {
  buildAcceptedInputIdentity,
  buildAcceptedInputIdentityFromUi,
} from '../../src/session/transcript/acceptedInputIdentity.ts';
import { InProcessGateway } from '../../src/gateway/client/InProcessGateway.ts';
import { SessionRouter } from '../../src/gateway/SessionRouter.ts';
import { GatewayWsConnection } from '../../src/gateway/server/GatewayWsConnection.ts';
import { PILOTDECK_GATEWAY_PROTOCOL_VERSION } from '../../src/gateway/protocol/version.ts';
import { getPilotProjectChatDir } from '../../src/pilot/paths.ts';
import { readWebSessionMessages } from '../../src/web/server/readSessionMessages.ts';
import {
  shouldSkipGatewayAcceptedInputWrite,
} from '../../src/session/transcript/acceptedInputDedup.ts';
import {
  appendTranscriptEntriesLocked,
} from '../../src/session/transcript/lockedTranscriptAppend.ts';
import { catalogStore } from '../../ui/server/saas/conversation/CatalogStore.js';
import { normalizeSessionId } from '../../ui/server/saas/conversation/normalizeSessionId.js';
import { saasRequestStore } from '../../ui/server/saas/context.js';
import {
  acceptTurn,
  registerTurnQueueBridgeDeps,
} from '../../ui/server/saas/concurrency/turnAcceptanceService.js';
import {
  hydrateAndPumpAllQueuedOnStartup,
  onTurnExecutionFinished,
  pumpUserQueue,
  registerTurnQueuePump,
} from '../../ui/server/saas/concurrency/turnQueuePump.js';
import {
  enqueueTurn,
  getQueueLength,
  resetTurnQueueForTests,
} from '../../ui/server/saas/concurrency/turnQueueManager.js';
import {
  clearTurnSlotsForUser,
  releaseTurnSlot,
  resetTurnSlotRegistryForTests,
  tryAcquireTurnSlot,
} from '../../ui/server/saas/concurrency/turnSlotRegistry.js';
import { resolveUserTurnLimit } from '../../ui/server/saas/concurrency/turnQueueConfig.js';
import { appendQueuedUserTranscript } from '../../ui/server/saas/concurrency/turnQueueTranscript.js';

const FIXED_NOW = '2026-07-18T01:00:00.000Z';
const GATEWAY_RUN_ID = '550e8400-e29b-41d4-a716-446655440000';
const ENV_KEYS = [
  'PILOTDECK_SAAS_MODE',
  'PILOTDECK_TURN_QUEUE',
  'SAAS_CONVERSATION_CATALOG',
  'SAAS_CONVERSATION_CATALOG_SHADOW',
  'REDIS_URL',
  'DATA_ROOT',
];
const originalEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

process.env.PILOTDECK_SAAS_MODE = '1';
process.env.PILOTDECK_TURN_QUEUE = '1';
process.env.SAAS_CONVERSATION_CATALOG = '1';
process.env.SAAS_CONVERSATION_CATALOG_SHADOW = '1';
delete process.env.REDIS_URL;

test.after(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('A. immediate execution persists one stable ref through Bridge, Gateway, AgentSession, and TurnRunner', async (t) => {
  await resetQueueState('tenant-immediate', 101);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-immediate-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const catalog = installCatalogStub();
  t.after(catalog.restore);

  let submittedOptions;
  let acceptedWrites = -1;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => 'web:s_immediate',
    abortViaGateway: async () => true,
    runChatViaGateway: async (_command, options) => {
      submittedOptions = options;
      const transcriptPath = resolveCatalogTranscriptPath(
        pilotHome,
        catalog.calls.upserts[0]?.transcriptRelPath,
      );
      acceptedWrites = await runTurnRunner({
        transcriptPath,
        acceptedInputRef: options.acceptedInputRef,
        inputFingerprint: options.acceptedInputFingerprint,
        attachmentDescriptors: options.acceptedInputAttachmentDescriptors,
        sessionId: options.sessionId,
        gatewayRunId: GATEWAY_RUN_ID,
      });
    },
  });

  const result = await saasRequestStore.run({
    tenantId: 'tenant-immediate',
    tenantPilotHome: pilotHome,
    userId: 101,
  }, () => acceptTurn({
    command: '立即执行 accepted_input 去重',
    options: { projectPath: projectKey },
    writer: { send() {} },
    userId: 101,
    tenantId: 'tenant-immediate',
    consumeCredit: async () => {},
    sessionStates: [],
  }));

  assert.equal(result.executionStatus, 'running');
  assertAcceptedInputRef(submittedOptions?.acceptedInputRef);
  assert.equal(acceptedWrites, 0, 'TurnRunner must not append a second accepted_input');

  const upsertRef = acceptedRefFromQueuedPayloadJson(
    catalog.calls.upserts[0]?.queuedPayloadJson,
  );
  const runningRef = acceptedRefFromQueuedPayloadJson(
    catalog.calls.updates.find((call) => call.executionStatus === 'running')?.queuedPayloadJson,
  );
  assert.deepEqual(upsertRef, submittedOptions.acceptedInputRef);
  assert.deepEqual(runningRef, submittedOptions.acceptedInputRef);

  const bridgeSource = await readFile(
    path.resolve('ui/server/pilotdeck-bridge.js'),
    'utf8',
  );
  const submitStart = bridgeSource.indexOf('stream = gw.submitTurn({');
  const submitEnd = bridgeSource.indexOf('});', submitStart);
  assert.ok(submitStart >= 0 && submitEnd > submitStart);
  assert.match(
    bridgeSource.slice(submitStart, submitEnd),
    /acceptedInputRef/,
    'pilotdeck-bridge submit frame must carry acceptedInputRef',
  );
});

test('A2. Gateway WebSocket and in-process adapters preserve acceptedInputRef while runId remains independent', async () => {
  const acceptedInputRef = makeAcceptedInputRef(1);
  let websocketInput;
  const fakeGateway = {
    async describeServer() {
      return { mode: 'in_process' };
    },
    async *submitTurn(input) {
      websocketInput = input;
      yield {
        type: 'turn_completed',
        usage: {},
        finishReason: 'completed',
      };
    },
    async abortTurn() {},
  };
  const fakeWs = createFakeTextWebSocket();
  new GatewayWsConnection(fakeWs.connection, {
    gateway: fakeGateway,
    token: 'test-token',
    serverVersion: 'test',
  });
  fakeWs.receive({
    type: 'hello',
    protocolVersion: PILOTDECK_GATEWAY_PROTOCOL_VERSION,
    clientName: 'test',
    clientVersion: 'test',
    token: 'test-token',
  });
  await waitFor(() => fakeWs.sent.some((frame) => frame.type === 'hello_ok'));
  fakeWs.receive({
    type: 'request',
    id: 'submit-1',
    method: 'submit_turn',
    params: {
      sessionKey: 'web:s_ws',
      channelKey: 'web',
      message: 'hello',
      runId: GATEWAY_RUN_ID,
      acceptedInputRef,
    },
  });
  await waitFor(() => websocketInput !== undefined);
  assert.deepEqual(websocketInput.acceptedInputRef, acceptedInputRef);
  assert.equal(websocketInput.runId, GATEWAY_RUN_ID);

  let agentSubmitOptions;
  const fakeSession = {
    async *submit(_input, options) {
      agentSubmitOptions = options;
      yield {
        type: 'turn_completed',
        sessionId: 'web:s_ws',
        turnId: GATEWAY_RUN_ID,
        result: successResult('web:s_ws', GATEWAY_RUN_ID),
      };
    },
    abort() {},
    snapshot() {
      return { sessionId: 'web:s_ws', messages: [] };
    },
  };
  const inProcess = new InProcessGateway(new SessionRouter({
    createSession: async () => fakeSession,
  }), {
    uuid: () => GATEWAY_RUN_ID,
  });
  for await (const _event of inProcess.submitTurn({
    sessionKey: 'web:s_ws',
    channelKey: 'web',
    message: 'hello',
    runId: GATEWAY_RUN_ID,
    acceptedInputRef,
    attachments: [{
      type: 'image',
      name: 'same.png',
      mimeType: 'image/png',
      content: 'YQ==',
      bytes: 1,
    }],
  })) {
    // drain
  }
  assert.deepEqual(agentSubmitOptions.acceptedInputRef, acceptedInputRef);
  assert.equal(agentSubmitOptions.turnId, GATEWAY_RUN_ID);
  const expectedIdentity = buildAcceptedInputIdentity('hello', [{
    type: 'image',
    name: 'same.png',
    mimeType: 'image/png',
    content: 'YQ==',
    bytes: 1,
  }]);
  assert.equal(
    agentSubmitOptions.acceptedInputFingerprint,
    expectedIdentity.inputFingerprint,
  );
  assert.deepEqual(
    agentSubmitOptions.acceptedInputAttachmentDescriptors,
    expectedIdentity.attachmentDescriptors,
  );

  let turnRunnerOptions;
  const fakeTurnRunner = {
    async *run(options) {
      turnRunnerOptions = options;
      return {
        result: successResult(options.sessionId, options.turnId),
        messages: options.messages,
      };
    },
    snapshotForRuntimeReload() {
      return { runtimeContext: { cwd: process.cwd(), transcriptPath: '' } };
    },
    snapshotFileState() {
      return {};
    },
  };
  const session = new AgentSession({
    sessionId: 'web:s_ws',
    turnRunner: fakeTurnRunner,
  });
  for await (const _event of session.submit(
    { type: 'text', text: 'hello' },
    { turnId: GATEWAY_RUN_ID, acceptedInputRef },
  )) {
    // drain
  }
  assert.deepEqual(turnRunnerOptions.acceptedInputRef, acceptedInputRef);
  assert.equal(turnRunnerOptions.turnId, GATEWAY_RUN_ID);
});

test('A2b. WebSocket ignores malformed or extra-field acceptedInputRef values', async () => {
  const submitted = [];
  const fakeGateway = {
    async describeServer() {
      return { mode: 'in_process' };
    },
    async *submitTurn(input) {
      submitted.push(input);
      yield {
        type: 'turn_completed',
        usage: {},
        finishReason: 'completed',
      };
    },
    async abortTurn() {},
  };
  const fakeWs = createFakeTextWebSocket();
  new GatewayWsConnection(fakeWs.connection, {
    gateway: fakeGateway,
    token: 'test-token',
    serverVersion: 'test',
  });
  fakeWs.receive({
    type: 'hello',
    protocolVersion: PILOTDECK_GATEWAY_PROTOCOL_VERSION,
    clientName: 'test',
    clientVersion: 'test',
    token: 'test-token',
  });
  await waitFor(() => fakeWs.sent.some((frame) => frame.type === 'hello_ok'));
  for (const [index, acceptedInputRef] of [
    { entryId: 'x', turnId: 'turn-1', sequence: '1', createdAt: FIXED_NOW },
    { ...makeAcceptedInputRef(1), attackerControlled: true },
    { entryId: 'x', turnId: 'turn-1', sequence: 1.5, createdAt: 'not-a-date' },
  ].entries()) {
    fakeWs.receive({
      type: 'request',
      id: `invalid-ref-${index}`,
      method: 'submit_turn',
      params: {
        sessionKey: `web:s_invalid_${index}`,
        channelKey: 'web',
        message: 'hello',
        runId: `${GATEWAY_RUN_ID}-${index}`,
        acceptedInputRef,
      },
    });
  }
  await waitFor(() => submitted.length === 3);
  assert.deepEqual(
    submitted.map((input) => input.acceptedInputRef),
    [undefined, undefined, undefined],
  );
});

test('A3. cold replay replaces the exact prewrite with one rich current input before model execution', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-cold-replay-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const sessionId = 'web-s_cold_replay';
  const acceptedInputRef = makeAcceptedInputRef(1);
  const inputFingerprint = 'sha256:cold-rich-input';
  const entry = {
    type: 'accepted_input',
    sessionId,
    ...acceptedInputRef,
    synthetic: true,
    inputFingerprint,
    attachmentDescriptors: [{
      type: 'image',
      name: 'brief.png',
      mimeType: 'image/png',
      bytes: 1,
      contentHash: 'sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    }],
    messages: [{ role: 'user', content: [{ type: 'text', text: '分析附件' }] }],
  };
  await writeFile(transcriptPath, `${JSON.stringify(entry)}\n`, 'utf8');
  const replay = replayTranscriptEntries([entry]);
  assert.deepEqual(
    replay.messages[0]?.metadata?.acceptedInput?.attachmentDescriptors,
    entry.attachmentDescriptors,
    'cold replay must recover safe attachment references from durable metadata',
  );
  const replayText = replay.messages
    .flatMap((message) => message.content)
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  assert.match(replayText, /brief\.png/);
  assert.doesNotMatch(replayText, /contentHash|base64/i);
  let modelMessages;
  const loop = {
    async *run(options) {
      modelMessages = options.messages;
      return {
        result: successResult(options.sessionId, options.turnId),
        messages: options.messages,
      };
    },
  };
  const runner = new TurnRunner(
    loop,
    new InMemoryTranscriptWriter(),
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    { cwd: base, transcriptPath },
  );
  const session = new AgentSession({
    sessionId,
    turnRunner: runner,
    initialState: createAgentSessionStateFromReplay(sessionId, replay),
  });

  for await (const _event of session.submit({
    type: 'blocks',
    content: [
      { type: 'text', text: '分析附件' },
      {
        type: 'image',
        source: 'base64',
        data: 'YQ==',
        mimeType: 'image/png',
        bytes: 1,
      },
    ],
  }, {
    turnId: GATEWAY_RUN_ID,
    acceptedInputRef,
    acceptedInputFingerprint: inputFingerprint,
    acceptedInputAttachmentDescriptors: entry.attachmentDescriptors,
  })) {
    // drain
  }

  const userMessages = modelMessages.filter((message) => message.role === 'user');
  assert.equal(userMessages.length, 1, 'model must receive one logical current input after cold replay');
  assert.equal(
    userMessages[0].content.filter((block) => block.type === 'image').length,
    1,
    'the one model input must keep the rich attachment block',
  );
});

test('A4. cold fallback replaces only the unresolved trailing legacy prewrite with the current rich input', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-cold-fallback-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const sessionId = 'web-s_cold_fallback';
  const currentIdentity = buildAcceptedInputIdentity('重复输入', []);
  const completedInput = acceptedEntry(
    sessionId,
    1,
    'gateway-completed',
    '重复输入',
    FIXED_NOW,
    { inputFingerprint: currentIdentity.inputFingerprint },
  );
  const assistant = {
    type: 'assistant_message',
    sessionId,
    turnId: 'gateway-completed',
    sequence: 2,
    createdAt: FIXED_NOW,
    entryId: 'assistant-completed',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: '第一轮已完成' }],
    },
  };
  const completed = {
    type: 'turn_result',
    sessionId,
    turnId: 'gateway-completed',
    sequence: 3,
    createdAt: FIXED_NOW,
    entryId: 'result-completed',
    result: successResult(sessionId, 'gateway-completed'),
  };
  const pendingInput = acceptedEntry(
    sessionId,
    4,
    'turn-4',
    '重复输入',
    '2026-07-18T00:00:04.000Z',
    { synthetic: true },
  );
  const entries = [completedInput, assistant, completed, pendingInput];
  await writeFile(
    transcriptPath,
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );
  const replay = replayTranscriptEntries(entries);
  const transcript = new JsonlTranscriptWriter({ path: transcriptPath });
  transcript.restoreState(4, pendingInput.entryId);
  let modelMessages;
  const runner = new TurnRunner(
    {
      async *run(options) {
        modelMessages = options.messages;
        return {
          result: successResult(options.sessionId, options.turnId),
          messages: options.messages,
        };
      },
    },
    transcript,
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    { cwd: base, transcriptPath },
  );
  const session = new AgentSession({
    sessionId,
    turnRunner: runner,
    initialState: createAgentSessionStateFromReplay(sessionId, replay),
  });

  for await (const _event of session.submit(
    { type: 'text', text: '重复输入' },
    {
      turnId: GATEWAY_RUN_ID,
      queueItemId: 'legacy-queue-item',
      acceptedInputFingerprint: currentIdentity.inputFingerprint,
      acceptedInputAttachmentDescriptors: [],
    },
  )) {
    // drain
  }

  const userMessages = modelMessages.filter((message) => message.role === 'user');
  assert.equal(userMessages.length, 2, 'completed prior input remains and only pending prewrite is replaced');
  const durableAccepted = (await readJsonl(transcriptPath))
    .filter((entry) => entry.type === 'accepted_input');
  assert.equal(durableAccepted.length, 3);
  assert.equal(
    durableAccepted.at(-1).logicalInputEntryId,
    pendingInput.entryId,
    'fallback Gateway row must explicitly link to the replaced legacy prewrite',
  );
});

test('A5. interleaved receipt resolves A while replayed B is replaced exactly once', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-interleaved-receipt-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const sessionId = 'web-s_interleaved_receipt';
  const identityA = buildAcceptedInputIdentity('输入 A', []);
  const identityB = buildAcceptedInputIdentity('输入 B', []);
  const acceptedA = acceptedEntry(
    sessionId,
    1,
    'turn-a',
    '输入 A',
    '2026-07-18T00:00:01.000Z',
    { synthetic: true, inputFingerprint: identityA.inputFingerprint },
  );
  const acceptedB = acceptedEntry(
    sessionId,
    2,
    'turn-b',
    '输入 B',
    '2026-07-18T00:00:02.000Z',
    { synthetic: true, inputFingerprint: identityB.inputFingerprint },
  );
  const resultA = {
    type: 'turn_result',
    sessionId,
    turnId: 'gateway-result-a',
    sequence: 3,
    createdAt: '2026-07-18T00:00:03.000Z',
    entryId: 'result-a',
    result: {
      ...successResult(sessionId, 'gateway-result-a'),
      acceptedInputReceipt: {
        version: 1,
        entryId: acceptedA.entryId,
      },
    },
  };
  const entries = [acceptedA, acceptedB, resultA];
  await writeFile(
    transcriptPath,
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );
  const replay = replayTranscriptEntries(entries);
  assert.deepEqual(
    replay.messages.map((message) => message.metadata?.acceptedInput?.unresolved),
    [false, true],
    'receipt A must not resolve the later accepted B',
  );
  const transcript = new JsonlTranscriptWriter({ path: transcriptPath });
  transcript.restoreState(resultA.sequence, resultA.entryId);
  let modelMessages;
  const runner = new TurnRunner(
    {
      async *run(options) {
        modelMessages = options.messages;
        return {
          result: successResult(options.sessionId, options.turnId),
          messages: options.messages,
        };
      },
    },
    transcript,
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    { cwd: base, transcriptPath },
  );
  const session = new AgentSession({
    sessionId,
    turnRunner: runner,
    initialState: createAgentSessionStateFromReplay(sessionId, replay),
  });

  for await (const _event of session.submit(
    { type: 'text', text: '输入 B' },
    {
      turnId: GATEWAY_RUN_ID,
      queueItemId: 'legacy-b',
      acceptedInputFingerprint: identityB.inputFingerprint,
      acceptedInputAttachmentDescriptors: [],
    },
  )) {
    // drain
  }

  assert.deepEqual(modelUserTexts(modelMessages), ['输入 A', '输入 B']);
});

test('A5b. explicit receipt resolves its accepted input instead of consuming FIFO', () => {
  const sessionId = 'web-s_out_of_order_receipt';
  const acceptedA = acceptedEntry(
    sessionId,
    1,
    'turn-a',
    '输入 A',
    '2026-07-18T00:00:01.000Z',
    { inputFingerprint: buildAcceptedInputIdentity('输入 A', []).inputFingerprint },
  );
  const acceptedB = acceptedEntry(
    sessionId,
    2,
    'turn-b',
    '输入 B',
    '2026-07-18T00:00:02.000Z',
    { inputFingerprint: buildAcceptedInputIdentity('输入 B', []).inputFingerprint },
  );
  const resultB = {
    type: 'turn_result',
    sessionId,
    turnId: 'gateway-result-b',
    sequence: 3,
    createdAt: '2026-07-18T00:00:03.000Z',
    entryId: 'result-b',
    result: {
      ...successResult(sessionId, 'gateway-result-b'),
      acceptedInputReceipt: {
        version: 1,
        entryId: acceptedB.entryId,
      },
    },
  };

  const replay = replayTranscriptEntries([acceptedA, acceptedB, resultB]);
  assert.deepEqual(
    replay.messages.map((message) => message.metadata?.acceptedInput?.unresolved),
    [true, false],
  );
});

test('A5c. queue item receipt resolves the accepted row carrying that stable queue id', () => {
  const sessionId = 'web-s_queue_receipt';
  const acceptedA = acceptedEntry(
    sessionId,
    1,
    'turn-a',
    '输入 A',
    '2026-07-18T00:00:01.000Z',
    { queueItemId: 'queue-a' },
  );
  const acceptedB = acceptedEntry(
    sessionId,
    2,
    'turn-b',
    '输入 B',
    '2026-07-18T00:00:02.000Z',
    { queueItemId: 'queue-b' },
  );
  const resultB = {
    type: 'turn_result',
    sessionId,
    turnId: 'gateway-result-b',
    sequence: 3,
    createdAt: '2026-07-18T00:00:03.000Z',
    entryId: 'result-b',
    result: {
      ...successResult(sessionId, 'gateway-result-b'),
      acceptedInputReceipt: {
        version: 1,
        queueItemId: 'queue-b',
      },
    },
  };

  const replay = replayTranscriptEntries([acceptedA, acceptedB, resultB]);
  assert.deepEqual(
    replay.messages.map((message) => message.metadata?.acceptedInput?.unresolved),
    [true, false],
  );
});

test('A5d. accepted entry receipt takes priority over a conflicting queue id', () => {
  const sessionId = 'web-s_receipt_priority';
  const acceptedA = acceptedEntry(
    sessionId,
    1,
    'turn-a',
    '输入 A',
    '2026-07-18T00:00:01.000Z',
    { queueItemId: 'queue-a' },
  );
  const acceptedB = acceptedEntry(
    sessionId,
    2,
    'turn-b',
    '输入 B',
    '2026-07-18T00:00:02.000Z',
    { queueItemId: 'queue-b' },
  );
  const resultB = {
    type: 'turn_result',
    sessionId,
    turnId: 'gateway-result-b',
    sequence: 3,
    createdAt: '2026-07-18T00:00:03.000Z',
    entryId: 'result-b',
    result: {
      ...successResult(sessionId, 'gateway-result-b'),
      acceptedInputReceipt: {
        version: 1,
        entryId: acceptedB.entryId,
        queueItemId: 'queue-a',
      },
    },
  };

  const replay = replayTranscriptEntries([acceptedA, acceptedB, resultB]);
  assert.deepEqual(
    replay.messages.map((message) => message.metadata?.acceptedInput?.unresolved),
    [true, false],
  );
});

test('A6. legacy FIFO results resolve A and B while queued C is replaced exactly once', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-interleaved-fifo-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const sessionId = 'web-s_interleaved_fifo';
  const identities = ['输入 A', '输入 B', '输入 C']
    .map((text) => buildAcceptedInputIdentity(text, []));
  const acceptedInputs = ['输入 A', '输入 B', '输入 C'].map((text, index) => (
    acceptedEntry(
      sessionId,
      index + 1,
      `turn-${index + 1}`,
      text,
      `2026-07-18T00:00:0${index + 1}.000Z`,
      {
        synthetic: true,
        inputFingerprint: identities[index].inputFingerprint,
      },
    )
  ));
  const legacyResults = [0, 1].map((index) => ({
    type: 'turn_result',
    sessionId,
    turnId: `legacy-result-${index + 1}`,
    sequence: index + 4,
    createdAt: `2026-07-18T00:00:0${index + 4}.000Z`,
    entryId: `legacy-result-${index + 1}`,
    result: successResult(sessionId, `legacy-result-${index + 1}`),
  }));
  const replayAfterA = replayTranscriptEntries([...acceptedInputs, legacyResults[0]]);
  assert.deepEqual(
    replayAfterA.messages.map((message) => message.metadata?.acceptedInput?.unresolved),
    [false, true, true],
    'after only result A, queued B and C must both remain unresolved',
  );
  const entries = [...acceptedInputs, ...legacyResults];
  await writeFile(
    transcriptPath,
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );
  const replay = replayTranscriptEntries(entries);
  assert.deepEqual(
    replay.messages.map((message) => message.metadata?.acceptedInput?.unresolved),
    [false, false, true],
    'two legacy terminal results must consume only the first two FIFO accepted inputs',
  );
  const lastResult = legacyResults.at(-1);
  const transcript = new JsonlTranscriptWriter({ path: transcriptPath });
  transcript.restoreState(lastResult.sequence, lastResult.entryId);
  let modelMessages;
  const runner = new TurnRunner(
    {
      async *run(options) {
        modelMessages = options.messages;
        return {
          result: successResult(options.sessionId, options.turnId),
          messages: options.messages,
        };
      },
    },
    transcript,
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    { cwd: base, transcriptPath },
  );
  const session = new AgentSession({
    sessionId,
    turnRunner: runner,
    initialState: createAgentSessionStateFromReplay(sessionId, replay),
  });

  for await (const _event of session.submit(
    { type: 'text', text: '输入 C' },
    {
      turnId: GATEWAY_RUN_ID,
      queueItemId: 'legacy-c',
      acceptedInputFingerprint: identities[2].inputFingerprint,
      acceptedInputAttachmentDescriptors: [],
    },
  )) {
    // drain
  }

  assert.deepEqual(modelUserTexts(modelMessages), ['输入 A', '输入 B', '输入 C']);
});

test('B0. Bridge prewrite persists a safe shared fingerprint and deterministic transcript path', async (t) => {
  const tenantId = 'tenant-fingerprint';
  const userId = 111;
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-fingerprint-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const catalog = installCatalogStub();
  t.after(catalog.restore);
  let submittedOptions;
  const contentHash = 'sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
  const uiImages = [{
    name: 'brief.png',
    data: 'data:image/png;base64,YQ==',
    size: 1,
    sha256: contentHash,
  }];
  assert.deepEqual(
    buildAcceptedInputIdentityFromUi('分析附件', uiImages, undefined),
    buildAcceptedInputIdentity('分析附件', [{
      type: 'image',
      name: 'brief.png',
      mimeType: 'image/png',
      content: 'YQ==',
      bytes: 1,
      metadata: { sha256: contentHash },
    }]),
    'UI and Gateway attachment shapes must produce one canonical fingerprint',
  );
  registerTurnQueueBridgeDeps({
    newSessionKey: () => 'web:s_fingerprint',
    abortViaGateway: async () => true,
    runChatViaGateway: async (_command, options) => {
      submittedOptions = options;
    },
  });

  await saasRequestStore.run({
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  }, () => acceptTurn({
    command: '分析附件',
    options: {
      projectPath: projectKey,
      images: uiImages,
    },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {},
    sessionStates: [],
  }));

  const transcriptRelPath = catalog.calls.upserts[0]?.transcriptRelPath;
  const transcriptPath = resolveCatalogTranscriptPath(pilotHome, transcriptRelPath);
  const raw = await readFile(transcriptPath, 'utf8');
  const [prewrite] = await readJsonl(transcriptPath);
  assert.equal(prewrite.synthetic, true);
  assert.match(prewrite.inputFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(prewrite.attachmentDescriptors, [{
    type: 'image',
    name: 'brief.png',
    mimeType: 'image/png',
    bytes: 1,
    contentHash,
  }]);
  assert.equal(raw.includes('YQ=='), false, 'Bridge transcript must not persist attachment base64');
  assert.equal(submittedOptions.acceptedInputFingerprint, prewrite.inputFingerprint);
  assert.deepEqual(
    submittedOptions.acceptedInputAttachmentDescriptors,
    prewrite.attachmentDescriptors,
  );
  assert.equal(submittedOptions.transcriptRelPath, transcriptRelPath);
  assert.equal(
    acceptedRefFromQueuedPayloadJson(catalog.calls.upserts[0]?.queuedPayloadJson).entryId,
    prewrite.entryId,
  );
  assert.equal(
    firstQueuedPayloadItem(catalog.calls.upserts[0].queuedPayloadJson).transcriptRelPath,
    transcriptRelPath,
  );
});

test('B0b. accept-time attachment identity hashes real bounded file content', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-file-hash-'));
  const filePath = path.join(base, 'same.bin');
  const identityModule = await import('../../src/session/transcript/acceptedInputIdentity.ts');
  assert.equal(
    typeof identityModule.buildAcceptedInputIdentityFromUiResolved,
    'function',
    'resolved UI identity builder must exist',
  );

  await writeFile(filePath, 'AAAA', 'utf8');
  const first = await identityModule.buildAcceptedInputIdentityFromUiResolved(
    '读取附件',
    undefined,
    [{ name: 'same.bin', path: filePath, size: 4, mimeType: 'application/octet-stream' }],
    { allowedRoot: base, maxFileBytes: 1024 },
  );
  await writeFile(filePath, 'BBBB', 'utf8');
  const second = await identityModule.buildAcceptedInputIdentityFromUiResolved(
    '读取附件',
    undefined,
    [{ name: 'same.bin', path: filePath, size: 4, mimeType: 'application/octet-stream' }],
    { allowedRoot: base, maxFileBytes: 1024 },
  );

  assert.notEqual(first.inputFingerprint, second.inputFingerprint);
  assert.notEqual(
    first.attachmentDescriptors[0]?.contentHash,
    second.attachmentDescriptors[0]?.contentHash,
  );
  assert.doesNotMatch(JSON.stringify(first), /AAAA|base64/i);
  assert.doesNotMatch(JSON.stringify(second), /BBBB|base64/i);
});

test('B0c. normal Gateway durability keeps rich attachments in model input but not JSONL', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-no-base64-jsonl-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  let modelMessages;
  const transcript = new JsonlTranscriptWriter({ path: transcriptPath });
  const runner = new TurnRunner(
    {
      async *run(options) {
        modelMessages = options.messages;
        return {
          result: successResult(options.sessionId, options.turnId),
          messages: options.messages,
        };
      },
    },
    transcript,
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    { cwd: base, transcriptPath },
  );
  const session = new AgentSession({
    sessionId: 'web-s_no_base64',
    turnRunner: runner,
  });
  const identity = buildAcceptedInputIdentity('查看图片', [{
    type: 'image',
    name: 'safe.png',
    mimeType: 'image/png',
    content: 'YQ==',
    bytes: 1,
  }]);

  for await (const _event of session.submit({
    type: 'blocks',
    content: [
      { type: 'text', text: '查看图片' },
      { type: 'image', source: 'base64', data: 'YQ==', mimeType: 'image/png', bytes: 1 },
    ],
  }, {
    turnId: GATEWAY_RUN_ID,
    queueItemId: 'no-base64-item',
    acceptedInputFingerprint: identity.inputFingerprint,
    acceptedInputAttachmentDescriptors: identity.attachmentDescriptors,
  })) {
    // drain
  }

  assert.equal(
    modelMessages.flatMap((message) => message.content).filter((block) => block.type === 'image').length,
    1,
  );
  const raw = await readFile(transcriptPath, 'utf8');
  assert.doesNotMatch(raw, /YQ==|"source":"base64"|"data":/i);
  const accepted = (await readJsonl(transcriptPath)).find((entry) => entry.type === 'accepted_input');
  assert.deepEqual(accepted.attachmentDescriptors, identity.attachmentDescriptors);
  assert.equal(accepted.queueItemId, 'no-base64-item');
});

test('B. queued execution persists and pumps the same ref without a second transcript row', async (t) => {
  const tenantId = 'tenant-queued';
  const userId = 102;
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-queued-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const catalog = installCatalogStub();
  t.after(catalog.restore);

  const blockers = await fillUserTurnSlots(tenantId, userId);
  let acceptGatewayCalls = 0;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => 'web:s_queued',
    abortViaGateway: async () => true,
    runChatViaGateway: async () => {
      acceptGatewayCalls += 1;
    },
  });

  const accepted = await saasRequestStore.run({
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  }, () => acceptTurn({
    command: '排队后执行 accepted_input 去重',
    options: { projectPath: projectKey },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {},
    sessionStates: [],
  }));
  assert.equal(accepted.executionStatus, 'queued');
  assert.equal(acceptGatewayCalls, 0);

  const queuedCall = catalog.calls.updates.find((call) => call.executionStatus === 'queued');
  const queuedRef = acceptedRefFromQueuedPayloadJson(queuedCall?.queuedPayloadJson);
  assertAcceptedInputRef(queuedRef);
  assert.deepEqual(
    acceptedRefFromQueuedPayloadJson(catalog.calls.upserts[0]?.queuedPayloadJson),
    queuedRef,
  );

  for (const sessionKey of blockers) {
    await releaseTurnSlot({ tenantId, userId, sessionKey });
  }

  let pumpedOptions;
  let acceptedWrites = -1;
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async (_command, options) => {
      pumpedOptions = options;
      acceptedWrites = await runTurnRunner({
        transcriptPath: resolveCatalogTranscriptPath(
          pilotHome,
          catalog.calls.upserts[0]?.transcriptRelPath,
        ),
        acceptedInputRef: options.acceptedInputRef,
        inputFingerprint: options.acceptedInputFingerprint,
        attachmentDescriptors: options.acceptedInputAttachmentDescriptors,
        sessionId: options.sessionId,
        gatewayRunId: GATEWAY_RUN_ID,
      });
    },
  });
  await pumpUserQueue({ tenantId, userId });

  assert.deepEqual(pumpedOptions.acceptedInputRef, queuedRef);
  assert.equal(acceptedWrites, 0);
  const transcriptEntries = await readJsonl(resolveCatalogTranscriptPath(
    pilotHome,
    catalog.calls.upserts[0]?.transcriptRelPath,
  ));
  assert.equal(
    transcriptEntries.filter((entry) => entry.type === 'accepted_input').length,
    1,
  );
});

test('B2. retrying the same accepted ref returns queued status without re-execution or quota charge', async (t) => {
  const tenantId = 'tenant-ref-retry';
  const userId = 116;
  const sessionId = 'web:s_ref_retry';
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-ref-retry-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const blockers = await fillUserTurnSlots(tenantId, userId);
  const catalog = installCatalogStub({ stateful: true });
  t.after(catalog.restore);
  let gatewayRuns = 0;
  let abortCalls = 0;
  let credits = 0;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => sessionId,
    abortViaGateway: async () => {
      abortCalls += 1;
      return true;
    },
    runChatViaGateway: async () => {
      gatewayRuns += 1;
    },
  });
  const requestContext = { tenantId, tenantPilotHome: pilotHome, userId };
  const first = await saasRequestStore.run(requestContext, () => acceptTurn({
    command: '同一请求',
    options: { projectPath: projectKey, sessionId },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {
      credits += 1;
    },
    sessionStates: [],
  }));
  const durableItem = firstQueuedPayloadItem(catalog.calls.updates.at(-1)?.queuedPayloadJson);
  const retry = await saasRequestStore.run(requestContext, () => acceptTurn({
    command: '同一请求',
    options: {
      projectPath: projectKey,
      sessionId,
      queueItemId: durableItem.itemId,
      acceptedInputRef: durableItem.acceptedInputRef,
    },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {
      credits += 1;
    },
    sessionStates: [],
  }));

  assert.equal(first.executionStatus, 'queued');
  assert.equal(retry.executionStatus, 'queued');
  assert.equal(retry.idempotent, true);
  assert.equal(gatewayRuns, 0);
  assert.equal(abortCalls, 0);
  assert.equal(credits, 1);
  assert.equal(getQueueLength({ tenantId, userId }), 1);
  assert.equal(
    (await readJsonl(resolveCatalogTranscriptPath(
      pilotHome,
      catalog.calls.upserts[0].transcriptRelPath,
    ))).filter((entry) => entry.type === 'accepted_input').length,
    1,
  );
  for (const blocker of blockers) {
    await releaseTurnSlot({ tenantId, userId, sessionKey: blocker });
  }
});

test('B3. consecutive identical text without a stable retry id creates two durable turns', async (t) => {
  const tenantId = 'tenant-identical-inputs';
  const userId = 114;
  const sessionId = 'web:s_identical_inputs';
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-identical-inputs-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const catalog = installCatalogStub({ stateful: true });
  t.after(catalog.restore);
  const blockers = await fillUserTurnSlots(tenantId, userId);
  t.after(async () => {
    for (const blocker of blockers) {
      await releaseTurnSlot({ tenantId, userId, sessionKey: blocker });
    }
  });
  registerTurnQueueBridgeDeps({
    newSessionKey: () => sessionId,
    abortViaGateway: async () => true,
    runChatViaGateway: async () => {
      throw new Error('queued identical inputs must not execute in this test');
    },
  });
  let creditCount = 0;
  const submit = () => saasRequestStore.run({
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  }, () => acceptTurn({
    command: '完全相同的输入',
    options: { sessionId, projectPath: projectKey, projectName: path.basename(projectKey) },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {
      creditCount += 1;
    },
    sessionStates: [],
  }));

  const first = await submit();
  const second = await submit();

  assert.equal(first.idempotent, undefined);
  assert.equal(second.idempotent, undefined);
  assert.equal(creditCount, 2);
  assert.equal(catalog.calls.upserts.length, 2);
  const finalEnvelope = JSON.parse(catalog.calls.upserts.at(-1).queuedPayloadJson);
  assert.equal(finalEnvelope.items.length, 2);
  assert.notEqual(finalEnvelope.items[0].itemId, finalEnvelope.items[1].itemId);
  const transcriptPath = resolveCatalogTranscriptPath(
    pilotHome,
    catalog.calls.upserts.at(-1).transcriptRelPath,
  );
  assert.equal(
    (await readJsonl(transcriptPath)).filter((entry) => entry.type === 'accepted_input').length,
    2,
  );
});

test('C0. concurrent different inputs in one session serialize FIFO without aborting or overwriting', async (t) => {
  const tenantId = 'tenant-same-session';
  const userId = 112;
  const sessionId = 'web:s_same_session';
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-same-session-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const catalog = installCatalogStub({ stateful: true });
  t.after(catalog.restore);
  const gatewayCommands = [];
  let releaseFirst;
  const firstBlocked = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let abortCalls = 0;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => sessionId,
    abortViaGateway: async () => {
      abortCalls += 1;
      return true;
    },
    runChatViaGateway: async (command) => {
      gatewayCommands.push(command);
      if (command === '第一条') await firstBlocked;
    },
  });

  const requestContext = {
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  };
  const makeInput = (command) => ({
    command,
    options: { projectPath: projectKey, sessionId },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {},
    sessionStates: [],
  });
  const concurrent = Promise.all([
    saasRequestStore.run(requestContext, () => acceptTurn(makeInput('第一条'))),
    saasRequestStore.run(requestContext, () => acceptTurn(makeInput('第二条'))),
  ]);
  await waitFor(() => gatewayCommands.length >= 1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(gatewayCommands, ['第一条'], 'second input must not enter Gateway while the first runs');
  releaseFirst();
  const results = await concurrent;
  assert.deepEqual(
    results.map((result) => result.executionStatus).sort(),
    ['queued', 'running'],
  );
  assert.equal(abortCalls, 0);
  const durableQueue = catalog.calls.updates
    .map((call) => JSON.parse(call.queuedPayloadJson))
    .findLast((payload) => Array.isArray(payload.items) && payload.items.length === 2);
  assert.deepEqual(
    durableQueue.items.map((item) => item.command),
    ['第一条', '第二条'],
    'durable session queue must retain the running head and later FIFO input',
  );

  registerTurnQueuePump({
    clients: new Set(),
    runChat: async (command) => {
      gatewayCommands.push(command);
    },
  });
  await onTurnExecutionFinished({
    tenantId,
    userId,
    sessionKey: sessionId,
    queueItemId: durableQueue.items[0].itemId,
    success: true,
    final: true,
    receipt: {
      version: 1,
      entryId: durableQueue.items[0].acceptedInputRef.entryId,
      queueItemId: durableQueue.items[0].itemId,
    },
  });
  assert.deepEqual(gatewayCommands, ['第一条', '第二条']);
});

test('C0a. two Bridge module instances serialize same-session catalog envelope updates', async (t) => {
  const tenantId = 'tenant-multi-bridge';
  const userId = 115;
  const sessionId = 'web:s_multi_bridge';
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-multi-bridge-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const catalog = installCatalogStub({ stateful: true });
  t.after(catalog.restore);
  const blockers = await fillUserTurnSlots(tenantId, userId);
  t.after(async () => {
    for (const blocker of blockers) {
      await releaseTurnSlot({ tenantId, userId, sessionKey: blocker });
    }
  });
  const nonce = `${Date.now()}-${Math.random()}`;
  const [bridgeA, bridgeB] = await Promise.all([
    import(`../../ui/server/saas/concurrency/turnAcceptanceService.js?bridge=a-${nonce}`),
    import(`../../ui/server/saas/concurrency/turnAcceptanceService.js?bridge=b-${nonce}`),
  ]);
  for (const bridge of [bridgeA, bridgeB]) {
    bridge.registerTurnQueueBridgeDeps({
      newSessionKey: () => sessionId,
      abortViaGateway: async () => true,
      runChatViaGateway: async () => {
        throw new Error('full slot set must keep both multi-Bridge inputs queued');
      },
    });
  }
  const context = { tenantId, tenantPilotHome: pilotHome, userId };
  const input = (command) => ({
    command,
    options: { sessionId, projectPath: projectKey, projectName: path.basename(projectKey) },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {},
    sessionStates: [],
  });

  await Promise.all([
    saasRequestStore.run(context, () => bridgeA.acceptTurn(input('来自 Bridge A'))),
    saasRequestStore.run(context, () => bridgeB.acceptTurn(input('来自 Bridge B'))),
  ]);

  const finalEnvelope = JSON.parse(catalog.calls.upserts.at(-1).queuedPayloadJson);
  assert.deepEqual(
    finalEnvelope.items.map((item) => item.command).sort(),
    ['来自 Bridge A', '来自 Bridge B'].sort(),
  );
});

test('C0b. concurrent pump retries execute one stable queue item only once', async (t) => {
  const tenantId = 'tenant-pump-retry';
  const userId = 113;
  await resetQueueState(tenantId, userId);
  const acceptedInputRef = makeAcceptedInputRef(1);
  enqueueTurn({
    itemId: acceptedInputRef.entryId,
    sessionKey: 'web:s_pump_retry',
    tenantId,
    userId,
    command: '只执行一次',
    options: {},
    providerHint: 'pilotdeck',
    enqueuedAt: 1,
    acceptedInputRef,
  });
  const catalog = installCatalogStub({ stateful: true });
  t.after(catalog.restore);
  let runs = 0;
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  });

  await Promise.all([
    pumpUserQueue({ tenantId, userId }),
    pumpUserQueue({ tenantId, userId }),
  ]);
  assert.equal(runs, 1);
});

test('C0d. failed execution retains the queue head instead of acknowledging it', async (t) => {
  const tenantId = 'tenant-failed-head';
  const userId = 116;
  const sessionId = 'web:s_failed_head';
  const item = {
    itemId: 'failed-head-item',
    sessionKey: sessionId,
    tenantId,
    userId,
    command: '失败后保留',
    options: {},
    providerHint: 'pilotdeck',
    enqueuedAt: 1,
  };
  await resetQueueState(tenantId, userId);
  enqueueTurn(item);
  const catalog = installCatalogStub({
    stateful: true,
    queuedRows: [{
      tenantId,
      userId,
      sessionId,
      executionStatus: 'queued',
      queuedPayloadJson: JSON.stringify({ version: 2, items: [item] }),
    }],
  });
  t.after(catalog.restore);
  let runs = 0;
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async (_command, options) => {
      runs += 1;
      await onTurnExecutionFinished({
        tenantId,
        userId,
        sessionKey: sessionId,
        queueItemId: options.queueItemId,
        success: false,
        final: true,
      });
    },
  });

  await pumpUserQueue({ tenantId, userId });

  assert.equal(runs, 1);
  assert.equal(getQueueLength({ tenantId, userId }), 1);
  const lastUpdate = catalog.calls.updates.at(-1);
  assert.equal(lastUpdate.executionStatus, 'queued');
  assert.equal(JSON.parse(lastUpdate.queuedPayloadJson).items[0].itemId, item.itemId);
});

test('C0e. a new same-session input stays behind a failed head during backoff', async (t) => {
  const tenantId = 'tenant-failed-fifo';
  const userId = 119;
  const sessionId = 'web:s_failed_fifo';
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-failed-fifo-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const failedItem = {
    itemId: 'failed-fifo-head',
    command: '先失败的任务',
    options: { sessionId, sessionKey: sessionId, projectPath: projectKey },
    providerHint: 'pilotdeck',
    enqueuedAt: 1,
  };
  await resetQueueState(tenantId, userId);
  enqueueTurn({
    ...failedItem,
    sessionKey: sessionId,
    tenantId,
    userId,
  });
  assert.equal(await tryAcquireTurnSlot({ tenantId, userId, sessionKey: sessionId }), true);
  const catalog = installCatalogStub({
    stateful: true,
    queuedRows: [{
      tenantId,
      userId,
      sessionId,
      executionStatus: 'running',
      queuedPayloadJson: JSON.stringify({ version: 2, items: [failedItem] }),
    }],
  });
  t.after(catalog.restore);
  await onTurnExecutionFinished({
    tenantId,
    userId,
    sessionKey: sessionId,
    queueItemId: failedItem.itemId,
    success: false,
    final: true,
  });
  let gatewayRuns = 0;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => sessionId,
    abortViaGateway: async () => true,
    runChatViaGateway: async () => {
      gatewayRuns += 1;
    },
  });

  const result = await saasRequestStore.run({
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  }, () => acceptTurn({
    command: '后到的新输入',
    options: { sessionId, projectPath: projectKey, projectName: path.basename(projectKey) },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {},
    sessionStates: [],
  }));

  assert.equal(result.executionStatus, 'queued');
  assert.equal(gatewayRuns, 0);
  const envelope = JSON.parse(catalog.calls.updates.at(-1).queuedPayloadJson);
  assert.deepEqual(envelope.items.map((item) => item.command), ['先失败的任务', '后到的新输入']);
});

test('C0f. explicit same-id retry revives an exhausted recoverable queue head', async (t) => {
  const tenantId = 'tenant-retry-exhausted';
  const userId = 120;
  const sessionId = 'web:s_retry_exhausted';
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-retry-exhausted-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const item = {
    itemId: 'retry-exhausted-item',
    command: '恢复这个任务',
    options: { sessionId, sessionKey: sessionId, projectPath: projectKey },
    providerHint: 'pilotdeck',
    enqueuedAt: 1,
    retryCount: 3,
    retryExhausted: true,
  };
  await resetQueueState(tenantId, userId);
  enqueueTurn({
    ...item,
    sessionKey: sessionId,
    tenantId,
    userId,
  });
  const catalog = installCatalogStub({
    stateful: true,
    queuedRows: [{
      tenantId,
      userId,
      sessionId,
      executionStatus: 'queued',
      queuedPayloadJson: JSON.stringify({ version: 2, items: [item] }),
    }],
  });
  t.after(catalog.restore);
  let gatewayRuns = 0;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => sessionId,
    abortViaGateway: async () => true,
    runChatViaGateway: async () => {
      gatewayRuns += 1;
    },
  });
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async () => {
      gatewayRuns += 1;
    },
  });

  const result = await saasRequestStore.run({
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  }, () => acceptTurn({
    command: '恢复这个任务',
    options: { sessionId, projectPath: projectKey, queueItemId: item.itemId },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {
      throw new Error('explicit retry must not charge twice');
    },
    sessionStates: [],
  }));

  assert.equal(result.idempotent, true);
  assert.equal(gatewayRuns, 1);
  const runningEnvelope = JSON.parse(catalog.calls.updates.at(-1).queuedPayloadJson);
  assert.equal(runningEnvelope.items[0].retryExhausted, undefined);
});

test('C0g. restart pump schedules a persisted backoff item instead of stranding it', async (t) => {
  const tenantId = 'tenant-retry-wakeup';
  const userId = 121;
  const sessionId = 'web:s_retry_wakeup';
  await resetQueueState(tenantId, userId);
  const item = {
    itemId: 'retry-wakeup-item',
    command: '延迟恢复',
    options: { sessionId, sessionKey: sessionId },
    providerHint: 'pilotdeck',
    enqueuedAt: 1,
    retryCount: 1,
    retryAvailableAt: Date.now() + 30,
  };
  const catalog = installCatalogStub({
    stateful: true,
    queuedRows: [{
      tenantId,
      userId,
      sessionId,
      executionStatus: 'queued',
      queuedPayloadJson: JSON.stringify({ version: 2, items: [item] }),
    }],
  });
  t.after(catalog.restore);
  let runs = 0;
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async () => {
      runs += 1;
    },
  });

  await pumpUserQueue({ tenantId, userId });
  assert.equal(runs, 0);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(runs, 1);
});

test('C0c. a busy session head does not block another session from using an available user slot', async (t) => {
  const tenantId = 'tenant-cross-session';
  const userId = 117;
  await resetQueueState(tenantId, userId);
  assert.equal(await tryAcquireTurnSlot({
    tenantId,
    userId,
    sessionKey: 'web:s_busy',
  }), true);
  enqueueTurn({
    itemId: 'busy-next',
    sessionKey: 'web:s_busy',
    tenantId,
    userId,
    command: 'busy session next',
    options: {},
    providerHint: 'pilotdeck',
    enqueuedAt: 1,
  });
  enqueueTurn({
    itemId: 'free-session',
    sessionKey: 'web:s_free',
    tenantId,
    userId,
    command: 'different session',
    options: {},
    providerHint: 'pilotdeck',
    enqueuedAt: 2,
  });
  const catalog = installCatalogStub({ stateful: true });
  t.after(catalog.restore);
  const runs = [];
  registerTurnQueuePump({
    clients: new Set(),
    getBridgeSessionStates: () => [{
      active: true,
      ownerUserId: userId,
      sessionKey: 'web:s_busy',
    }],
    runChat: async (command) => {
      runs.push(command);
    },
  });

  await pumpUserQueue({ tenantId, userId });
  assert.deepEqual(runs, ['different session']);
  await releaseTurnSlot({ tenantId, userId, sessionKey: 'web:s_busy' });
});

test('C. Bridge restart hydrates the persisted ref and keeps transcript sequence monotonic', async (t) => {
  const tenantId = 'tenant-restart';
  const userId = 103;
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-restart-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web-s_restart';
  const firstWrite = await appendQueuedUserTranscript({
    pilotHome,
    projectKey,
    sessionId,
    command: '重启恢复',
  });
  assertAcceptedInputRef(firstWrite?.acceptedInputRef);

  const queuedPayload = {
    command: '重启恢复',
    options: { projectPath: projectKey, sessionId, sessionKey: sessionId },
    providerHint: 'pilotdeck',
    role: null,
    acceptedInputRef: firstWrite.acceptedInputRef,
    acceptedInputFingerprint: firstWrite.inputFingerprint,
    acceptedInputAttachmentDescriptors: firstWrite.attachmentDescriptors,
    transcriptRelPath: firstWrite.relPath,
  };
  const catalog = installCatalogStub({
    queuedRows: [{
      tenantId,
      userId,
      sessionId,
      executionStatus: 'queued',
      queuedPayloadJson: JSON.stringify(queuedPayload),
    }],
    pumpTargets: [{ tenantId, userId }],
  });
  t.after(catalog.restore);

  let restartOptions;
  let acceptedWrites = -1;
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async (_command, options) => {
      restartOptions = options;
      acceptedWrites = await runTurnRunner({
        transcriptPath: firstWrite.absPath,
        acceptedInputRef: options.acceptedInputRef,
        inputFingerprint: options.acceptedInputFingerprint,
        attachmentDescriptors: options.acceptedInputAttachmentDescriptors,
        sessionId: options.sessionId,
        gatewayRunId: GATEWAY_RUN_ID,
      });
    },
  });
  await hydrateAndPumpAllQueuedOnStartup();

  assert.deepEqual(restartOptions.acceptedInputRef, firstWrite.acceptedInputRef);
  assert.equal(acceptedWrites, 0);
  assert.equal(
    (await readJsonl(firstWrite.absPath)).filter((entry) => entry.type === 'accepted_input').length,
    1,
  );

  const secondWrite = await appendQueuedUserTranscript({
    pilotHome,
    projectKey,
    sessionId,
    command: '刷新后的新输入',
  });
  assert.equal(secondWrite.sequence, firstWrite.sequence + 1);
  assert.equal(secondWrite.acceptedInputRef.sequence, firstWrite.acceptedInputRef.sequence + 1);
});

test('C2. durable completion receipt prevents model re-execution after Bridge crashes before catalog ack', async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-receipt-restart-'));
  const previousDataRoot = process.env.DATA_ROOT;
  process.env.DATA_ROOT = base;
  t.after(() => {
    if (previousDataRoot === undefined) delete process.env.DATA_ROOT;
    else process.env.DATA_ROOT = previousDataRoot;
  });
  const tenantId = 'tenant-receipt-restart';
  const userId = 118;
  const sessionId = 'web-s_receipt_restart';
  const pilotHome = path.join(base, 'tenants', tenantId);
  const projectKey = path.join(base, 'project');
  const prewrite = await appendQueuedUserTranscript({
    pilotHome,
    projectKey,
    sessionId,
    command: '只执行一次的副作用',
  });
  const replay = replayTranscriptEntries(await readJsonl(prewrite.absPath));
  const transcript = new JsonlTranscriptWriter({ path: prewrite.absPath });
  transcript.restoreState(prewrite.sequence, prewrite.acceptedInputRef.entryId);
  let modelRuns = 0;
  const runner = new TurnRunner(
    {
      async *run(options) {
        modelRuns += 1;
        const result = successResult(options.sessionId, options.turnId);
        yield {
          type: 'turn_completed',
          sessionId: options.sessionId,
          turnId: options.turnId,
          result,
        };
        return { result, messages: options.messages };
      },
    },
    transcript,
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    { cwd: base, transcriptPath: prewrite.absPath },
  );
  const session = new AgentSession({
    sessionId,
    turnRunner: runner,
    initialState: createAgentSessionStateFromReplay(sessionId, replay),
  });
  const gateway = new InProcessGateway(new SessionRouter({
    createSession: async () => session,
  }), {
    uuid: () => GATEWAY_RUN_ID,
  });
  const gatewayEvents = [];
  for await (const event of gateway.submitTurn({
    sessionKey: sessionId,
    channelKey: 'web',
    projectKey,
    message: '只执行一次的副作用',
    runId: GATEWAY_RUN_ID,
    queueItemId: prewrite.acceptedInputRef.entryId,
    acceptedInputRef: prewrite.acceptedInputRef,
  })) {
    gatewayEvents.push(event);
  }

  assert.equal(modelRuns, 1);
  const completedEvent = gatewayEvents.find((event) => event.type === 'turn_completed');
  assert.deepEqual(completedEvent?.receipt, {
    version: 1,
    entryId: prewrite.acceptedInputRef.entryId,
    queueItemId: prewrite.acceptedInputRef.entryId,
  });
  const durableResult = (await readJsonl(prewrite.absPath))
    .findLast((entry) => entry.type === 'turn_result');
  assert.deepEqual(durableResult?.result?.acceptedInputReceipt, completedEvent.receipt);

  await resetQueueState(tenantId, userId);
  const queuedItem = {
    itemId: prewrite.acceptedInputRef.entryId,
    command: '只执行一次的副作用',
    options: { projectPath: projectKey, sessionId, sessionKey: sessionId },
    providerHint: 'pilotdeck',
    role: null,
    enqueuedAt: Date.now(),
    acceptedInputRef: prewrite.acceptedInputRef,
  };
  const catalog = installCatalogStub({
    stateful: true,
    queuedRows: [{
      tenantId,
      userId,
      sessionId,
      transcriptRelPath: prewrite.relPath,
      executionStatus: 'running',
      queuedPayloadJson: JSON.stringify({ version: 2, items: [queuedItem] }),
    }],
  });
  t.after(catalog.restore);
  let recoveryRuns = 0;
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async () => {
      recoveryRuns += 1;
    },
  });

  await pumpUserQueue({ tenantId, userId });

  assert.equal(recoveryRuns, 0, 'restart pump must acknowledge durable receipt without rerunning model');
  assert.equal(catalog.calls.updates.at(-1).executionStatus, 'idle');
  assert.equal(catalog.calls.updates.at(-1).queuedPayloadJson, null);
});

test('F. restart pump skips corrupt payloads and runs a later legacy payload without ref', async (t) => {
  const tenantId = 'tenant-corrupt-queue';
  const userId = 114;
  await resetQueueState(tenantId, userId);
  const catalog = installCatalogStub({
    queuedRows: [
      {
        tenantId,
        userId,
        sessionId: 'web-s_bad_json',
        executionStatus: 'queued',
        queuedPayloadJson: '{bad-json',
      },
      {
        tenantId,
        userId,
        sessionId: 'web-s_bad_schema',
        executionStatus: 'queued',
        queuedPayloadJson: JSON.stringify({ command: 42, options: [] }),
      },
      {
        tenantId,
        userId,
        sessionId: 'web-s_legacy_after_bad',
        executionStatus: 'queued',
        queuedPayloadJson: JSON.stringify({
          command: 'legacy after corrupt rows',
          options: {},
          providerHint: 'pilotdeck',
          acceptedInputRef: {
            ...makeAcceptedInputRef(1),
            injected: true,
          },
        }),
      },
    ],
    pumpTargets: [{ tenantId, userId }],
  });
  t.after(catalog.restore);
  const runs = [];
  registerTurnQueuePump({
    clients: new Set(),
    runChat: async (command, options) => {
      runs.push({ command, acceptedInputRef: options.acceptedInputRef });
    },
  });

  await hydrateAndPumpAllQueuedOnStartup();
  assert.deepEqual(runs, [{
    command: 'legacy after corrupt rows',
    acceptedInputRef: undefined,
  }]);
});

test('C2. concurrent Bridge prewrites allocate unique monotonic sequences', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-sequence-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web-s_sequence';
  const writes = await Promise.all(
    ['一', '二', '三', '四'].map((command) => appendQueuedUserTranscript({
      pilotHome,
      projectKey,
      sessionId,
      command,
    })),
  );
  assert.deepEqual(
    writes.map((write) => write.sequence).sort((a, b) => a - b),
    [1, 2, 3, 4],
  );
});

test('C3. a cached Gateway writer adopts the Bridge prewrite sequence before later durable rows', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-cached-writer-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web-s_cached_writer';
  const firstWrite = await appendQueuedUserTranscript({
    pilotHome,
    projectKey,
    sessionId,
    command: '首次输入',
  });
  assertAcceptedInputRef(firstWrite?.acceptedInputRef);

  const writer = new JsonlTranscriptWriter({ path: firstWrite.absPath });
  writer.restoreState(firstWrite.sequence, firstWrite.acceptedInputRef.entryId);
  const secondWrite = await appendQueuedUserTranscript({
    pilotHome,
    projectKey,
    sessionId,
    command: '缓存会话续聊',
  });
  assert.equal(secondWrite.sequence, firstWrite.sequence + 1);

  await runTurnRunnerWithWriter({
    transcriptPath: firstWrite.absPath,
    transcript: writer,
    acceptedInputRef: secondWrite.acceptedInputRef,
    inputFingerprint: secondWrite.inputFingerprint,
    attachmentDescriptors: secondWrite.attachmentDescriptors,
    sessionId,
    gatewayRunId: GATEWAY_RUN_ID,
  });

  const sequences = (await readJsonl(firstWrite.absPath)).map((entry) => entry.sequence);
  for (let index = 1; index < sequences.length; index += 1) {
    assert.ok(
      sequences[index] > sequences[index - 1],
      `sequence must increase strictly: ${sequences.join(',')}`,
    );
  }
});

test('E1. two independent JsonlTranscriptWriter instances allocate unique sequences under one file lock', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-writer-lock-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const writerA = new JsonlTranscriptWriter({ path: transcriptPath });
  const writerB = new JsonlTranscriptWriter({ path: transcriptPath });

  await Promise.all([
    writerA.recordAcceptedInput('web-s_lock', 'run-a', [
      { role: 'user', content: [{ type: 'text', text: 'A' }] },
    ]),
    writerB.recordAcceptedInput('web-s_lock', 'run-b', [
      { role: 'user', content: [{ type: 'text', text: 'B' }] },
    ]),
  ]);

  const entries = await readJsonl(transcriptPath);
  assert.deepEqual(
    entries.map((entry) => entry.sequence).sort((left, right) => left - right),
    [1, 2],
  );
  assert.equal(new Set(entries.map((entry) => entry.entryId)).size, 2);
});

test('E1b. Bridge prewrite and core writer share the same cross-process append protocol', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-bridge-core-lock-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web-s_bridge_core';
  const transcriptPath = path.join(
    getPilotProjectChatDir(projectKey, pilotHome),
    `${sessionId}.jsonl`,
  );
  const writer = new JsonlTranscriptWriter({ path: transcriptPath });

  await Promise.all([
    appendQueuedUserTranscript({
      pilotHome,
      projectKey,
      sessionId,
      command: 'Bridge',
    }),
    writer.recordAcceptedInput(sessionId, 'gateway-run', [
      { role: 'user', content: [{ type: 'text', text: 'Gateway' }] },
    ]),
  ]);

  assert.deepEqual(
    (await readJsonl(transcriptPath)).map((entry) => entry.sequence),
    [1, 2],
  );
});

test('E1c. batched Bridge metadata and the core writer allocate one contiguous sequence', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-batch-core-lock-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const writer = new JsonlTranscriptWriter({ path: transcriptPath });
  await Promise.all([
    appendTranscriptEntriesLocked(transcriptPath, (state) => (
      ['meta', 'ledger', 'acceptance'].map((entryId, index) => ({
        type: 'session_metadata',
        sessionId: 'web-s_batch_core',
        turnId: 'bridge-batch',
        sequence: state.nextSequence + index,
        createdAt: FIXED_NOW,
        entryId,
        metadata: { title: entryId },
      }))
    )),
    writer.recordAcceptedInput('web-s_batch_core', 'gateway-run', [
      { role: 'user', content: [{ type: 'text', text: 'Gateway' }] },
    ]),
  ]);

  const entries = await readJsonl(transcriptPath);
  assert.deepEqual(entries.map((entry) => entry.sequence), [1, 2, 3, 4]);
  assert.equal(new Set(entries.map((entry) => entry.sequence)).size, 4);
});

test('E2. stale transcript lock is recovered without unbounded waiting', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-stale-lock-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const lockPath = `${transcriptPath}.lock`;
  await writeFile(lockPath, JSON.stringify({ token: 'dead-owner' }), 'utf8');
  const old = new Date(Date.now() - 120_000);
  await utimes(lockPath, old, old);

  const writer = new JsonlTranscriptWriter({ path: transcriptPath });
  await writer.recordAcceptedInput('web-s_stale', 'run-a', [
    { role: 'user', content: [{ type: 'text', text: 'recover' }] },
  ]);

  assert.equal((await readJsonl(transcriptPath)).length, 1);
  await assert.rejects(access(lockPath), { code: 'ENOENT' });
});

test('E3. corrupt transcript state rejects Bridge prewrite instead of resetting sequence to one', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-corrupt-state-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web-s_corrupt';
  const transcriptDir = getPilotProjectChatDir(projectKey, pilotHome);
  const transcriptPath = path.join(transcriptDir, `${sessionId}.jsonl`);
  await mkdir(transcriptDir, { recursive: true });
  await writeFile(transcriptPath, '{"type":"accepted_input","sequence":', 'utf8');

  await assert.rejects(
    appendQueuedUserTranscript({
      pilotHome,
      projectKey,
      sessionId,
      command: '不可从零继续',
    }),
    /transcript|parse|invalid/i,
  );
  assert.equal(await readFile(transcriptPath, 'utf8'), '{"type":"accepted_input","sequence":');
});

test('E3b. JsonlTranscriptWriter isolates a failed write so the next append can recover', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-writer-recover-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  await writeFile(transcriptPath, '{corrupt-json\n', 'utf8');
  const writer = new JsonlTranscriptWriter({ path: transcriptPath });

  await assert.rejects(
    writer.recordAcceptedInput('web-s_writer_recover', 'turn-1', [{
      role: 'user',
      content: [{ type: 'text', text: 'first fails' }],
    }]),
  );
  await writeFile(transcriptPath, '', 'utf8');
  await writer.recordAcceptedInput('web-s_writer_recover', 'turn-2', [{
    role: 'user',
    content: [{ type: 'text', text: 'second succeeds' }],
  }]);

  const entries = await readJsonl(transcriptPath);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].turnId, 'turn-2');
});

test('E4. failed acceptance prewrite does not persist catalog state or consume quota', async (t) => {
  const tenantId = 'tenant-prewrite-rollback';
  const userId = 115;
  await resetQueueState(tenantId, userId);
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-prewrite-rollback-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web:s_prewrite_rollback';
  const normalizedSessionId = 'web-s_prewrite_rollback';
  const transcriptDir = getPilotProjectChatDir(projectKey, pilotHome);
  await mkdir(transcriptDir, { recursive: true });
  await writeFile(
    path.join(transcriptDir, `${normalizedSessionId}.jsonl`),
    '{"broken":',
    'utf8',
  );
  const catalog = installCatalogStub();
  t.after(catalog.restore);
  let credits = 0;
  let gatewayRuns = 0;
  registerTurnQueueBridgeDeps({
    newSessionKey: () => sessionId,
    abortViaGateway: async () => true,
    runChatViaGateway: async () => {
      gatewayRuns += 1;
    },
  });

  await assert.rejects(saasRequestStore.run({
    tenantId,
    tenantPilotHome: pilotHome,
    userId,
  }, () => acceptTurn({
    command: 'must reject',
    options: { projectPath: projectKey, sessionId },
    writer: { send() {} },
    userId,
    tenantId,
    consumeCredit: async () => {
      credits += 1;
    },
    sessionStates: [],
  })), /transcript|parse|invalid/i);

  assert.equal(catalog.calls.upserts.length, 0);
  assert.equal(credits, 0);
  assert.equal(gatewayRuns, 0);
});

test('D. missing, legacy, forged, or unreadable refs always keep one normal Gateway durable write', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-fallback-chain-'));
  const transcriptPath = path.join(base, 'session.jsonl');
  const acceptedInputRef = makeAcceptedInputRef(1, {
    turnId: GATEWAY_RUN_ID,
  });
  await writeFile(transcriptPath, `${JSON.stringify({
    type: 'accepted_input',
    sessionId: 'web-s_fallback',
    ...acceptedInputRef,
    messages: [{ role: 'user', content: [{ type: 'text', text: '旧 payload' }] }],
  })}\n`, 'utf8');

  assert.equal(await shouldSkipGatewayAcceptedInputWrite({
    transcriptPath,
    turnId: GATEWAY_RUN_ID,
  }), false);
  assert.equal(await shouldSkipGatewayAcceptedInputWrite({
    transcriptPath,
    turnId: GATEWAY_RUN_ID,
    acceptedInputRef: { ...acceptedInputRef, entryId: 'forged-entry' },
  }), false);
  assert.equal(await shouldSkipGatewayAcceptedInputWrite({
    transcriptPath: path.join(base, 'missing.jsonl'),
    turnId: GATEWAY_RUN_ID,
    acceptedInputRef,
  }), false);

  assert.equal(await runTurnRunner({
    transcriptPath,
    acceptedInputRef: undefined,
    gatewayRunId: GATEWAY_RUN_ID,
  }), 1);
  assert.equal(await runTurnRunner({
    transcriptPath,
    acceptedInputRef: { ...acceptedInputRef, sequence: 99 },
    gatewayRunId: GATEWAY_RUN_ID,
  }), 1);
});

test('E. history projection folds only explicitly linked pairs and prefers visible duplicates over data loss', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'accepted-history-'));
  const pilotHome = path.join(base, 'pilot-home');
  const projectKey = path.join(base, 'project');
  const sessionId = 'web-s_history_dedup';
  const transcriptDir = getPilotProjectChatDir(projectKey, pilotHome);
  const transcriptPath = path.join(transcriptDir, `${sessionId}.jsonl`);
  await mkdir(transcriptDir, { recursive: true });
  const entries = [
    acceptedEntry(sessionId, 1, 'turn-1', '继续', '2026-07-18T00:00:00.000Z', {
      synthetic: true,
      inputFingerprint: 'sha256:continue',
    }),
    acceptedEntry(sessionId, 2, '550e8400-e29b-41d4-a716-446655440101', '继续', '2026-07-18T00:00:01.000Z', {
      inputFingerprint: 'sha256:continue',
      logicalInputEntryId: 'turn-1-1',
    }),
    acceptedEntry(sessionId, 3, 'turn-2', '继续', '2026-07-18T00:00:10.000Z', {
      synthetic: true,
      inputFingerprint: 'sha256:continue',
    }),
    acceptedEntry(sessionId, 4, '550e8400-e29b-41d4-a716-446655440102', '继续', '2026-07-18T00:00:11.000Z', {
      inputFingerprint: 'sha256:continue',
    }),
    acceptedEntry(sessionId, 5, 'turn-3', '超时', '2026-07-18T00:01:00.000Z', {
      synthetic: true,
      inputFingerprint: 'sha256:late',
    }),
    acceptedEntry(sessionId, 6, '550e8400-e29b-41d4-a716-446655440103', '超时', '2026-07-18T00:02:00.000Z', {
      inputFingerprint: 'sha256:late',
    }),
    acceptedEntry(sessionId, 7, '550e8400-e29b-41d4-a716-446655440104', '真实重复', '2026-07-18T00:05:00.000Z'),
    acceptedEntry(sessionId, 8, '550e8400-e29b-41d4-a716-446655440105', '真实重复', '2026-07-18T00:05:01.000Z'),
    acceptedEntry(sessionId, 9, 'turn-4', '跨会话', '2026-07-18T00:06:00.000Z', {
      synthetic: true,
      inputFingerprint: 'sha256:cross',
    }),
    acceptedEntry('web-s_other', 10, '550e8400-e29b-41d4-a716-446655440106', '跨会话', '2026-07-18T00:06:01.000Z', {
      inputFingerprint: 'sha256:cross',
    }),
    acceptedEntry(sessionId, 11, 'turn-11', '附件不同', '2026-07-18T00:07:00.000Z', {
      synthetic: true,
      inputFingerprint: 'sha256:file-a',
    }),
    acceptedEntry(sessionId, 12, '550e8400-e29b-41d4-a716-446655440107', '附件不同', '2026-07-18T00:07:01.000Z', {
      inputFingerprint: 'sha256:file-b',
    }),
  ];
  await writeFile(
    transcriptPath,
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );
  const before = await readFile(transcriptPath, 'utf8');

  for (let read = 0; read < 2; read += 1) {
    const projected = await readWebSessionMessages(
      { sessionKey: sessionId, projectKey },
      { projectRoot: projectKey, pilotHome },
    );
    const userTexts = projected.messages
      .filter((message) => message.role === 'user' && message.kind === 'text')
      .map((message) => message.text);
    assert.equal(userTexts.filter((text) => text === '继续').length, 3);
    assert.equal(userTexts.filter((text) => text === '超时').length, 2);
    assert.equal(userTexts.filter((text) => text === '真实重复').length, 2);
    assert.equal(userTexts.filter((text) => text === '跨会话').length, 2);
    assert.equal(userTexts.filter((text) => text === '附件不同').length, 2);
  }

  assert.equal(await readFile(transcriptPath, 'utf8'), before);
});

function installCatalogStub({ queuedRows = [], pumpTargets = [], stateful = false } = {}) {
  const methods = [
    'upsertAcceptTurn',
    'updateExecutionFields',
    'getBySessionId',
    'listByExecutionStatus',
    'listQueuedPumpTargets',
  ];
  const originals = new Map(methods.map((method) => [method, catalogStore[method]]));
  const calls = {
    upserts: [],
    updates: [],
  };
  const rows = new Map(
    queuedRows.map((row) => {
      const sessionId = normalizeSessionId(row.sessionId);
      return [`${row.tenantId}:${row.userId}:${sessionId}`, {
        ...structuredClone(row),
        sessionId,
      }];
    }),
  );
  const rowKey = (input) => `${input.tenantId}:${input.userId}:${normalizeSessionId(input.sessionId)}`;
  catalogStore.upsertAcceptTurn = async (input) => {
    calls.upserts.push(structuredClone(input));
    if (stateful) {
      const previous = rows.get(rowKey(input)) ?? {};
      rows.set(rowKey(input), {
        ...previous,
        ...structuredClone(input),
        sessionId: normalizeSessionId(input.sessionId),
        executionStatus: input.executionStatus ?? 'queued',
      });
    }
  };
  catalogStore.updateExecutionFields = async (input) => {
    calls.updates.push(structuredClone(input));
    if (stateful) {
      const previous = rows.get(rowKey(input)) ?? {
        tenantId: input.tenantId,
        userId: input.userId,
        sessionId: normalizeSessionId(input.sessionId),
      };
      rows.set(rowKey(input), {
        ...previous,
        executionStatus: input.executionStatus,
        queuePosition: input.queuePosition ?? null,
        queuedPayloadJson: input.queuedPayloadJson ?? null,
      });
    }
  };
  catalogStore.getBySessionId = async (input) => (
    stateful ? structuredClone(rows.get(rowKey(input)) ?? null) : null
  );
  catalogStore.listByExecutionStatus = async (input) => {
    if (!stateful) return structuredClone(queuedRows);
    return structuredClone([...rows.values()].filter((row) => (
      row.tenantId === input.tenantId
      && row.userId === input.userId
      && input.statuses.includes(row.executionStatus)
    )));
  };
  catalogStore.listQueuedPumpTargets = async () => structuredClone(pumpTargets);
  return {
    calls,
    restore() {
      for (const [method, implementation] of originals) {
        catalogStore[method] = implementation;
      }
    },
  };
}

async function resetQueueState(tenantId, userId) {
  resetTurnQueueForTests();
  resetTurnSlotRegistryForTests();
  await clearTurnSlotsForUser({ tenantId, userId });
}

async function fillUserTurnSlots(tenantId, userId) {
  const limit = resolveUserTurnLimit(null);
  assert.ok(Number.isFinite(limit) && limit > 0, 'test requires a finite user turn limit');
  const sessionKeys = [];
  for (let index = 0; index < limit; index += 1) {
    const sessionKey = `blocker-${index}`;
    assert.equal(await tryAcquireTurnSlot({
      tenantId,
      userId,
      sessionKey,
      role: null,
    }), true);
    sessionKeys.push(sessionKey);
  }
  return sessionKeys;
}

async function runTurnRunner({
  transcriptPath,
  acceptedInputRef,
  inputFingerprint,
  attachmentDescriptors,
  sessionId,
  gatewayRunId,
}) {
  const transcript = new InMemoryTranscriptWriter();
  await runTurnRunnerWithWriter({
    transcriptPath,
    transcript,
    acceptedInputRef,
    inputFingerprint,
    attachmentDescriptors,
    sessionId,
    gatewayRunId,
  });
  return transcript.entries.filter((entry) => entry.type === 'accepted_input').length;
}

async function runTurnRunnerWithWriter({
  transcriptPath,
  transcript,
  acceptedInputRef,
  inputFingerprint,
  attachmentDescriptors,
  sessionId = 'web-s_turn-runner',
  gatewayRunId,
}) {
  const loop = {
    async *run(options) {
      return {
        result: successResult(options.sessionId, options.turnId),
        messages: options.messages,
      };
    },
  };
  const runner = new TurnRunner(
    loop,
    transcript,
    undefined,
    () => new Date(FIXED_NOW),
    undefined,
    {
      cwd: path.dirname(transcriptPath),
      transcriptPath,
    },
  );
  for await (const _event of runner.run({
    sessionId,
    turnId: gatewayRunId,
    messages: [],
    input: { type: 'text', text: 'hello' },
    acceptedInputRef,
    acceptedInputFingerprint: inputFingerprint,
    acceptedInputAttachmentDescriptors: attachmentDescriptors,
  })) {
    // drain
  }
}

function successResult(sessionId, turnId) {
  return {
    type: 'success',
    sessionId,
    turnId,
    stopReason: 'completed',
    usage: {},
    permissionDenials: [],
    turns: 1,
    startedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  };
}

function makeAcceptedInputRef(sequence, overrides = {}) {
  return {
    entryId: `bridge-entry-${sequence}`,
    turnId: `turn-${sequence}`,
    sequence,
    createdAt: `2026-07-18T00:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides,
  };
}

function assertAcceptedInputRef(value) {
  assert.ok(value && typeof value === 'object');
  assert.equal(typeof value.entryId, 'string');
  assert.equal(typeof value.turnId, 'string');
  assert.equal(typeof value.sequence, 'number');
  assert.equal(typeof value.createdAt, 'string');
}

function acceptedRefFromQueuedPayloadJson(value) {
  return firstQueuedPayloadItem(value)?.acceptedInputRef;
}

function firstQueuedPayloadItem(value) {
  if (typeof value !== 'string') return undefined;
  const parsed = JSON.parse(value);
  return parsed?.version === 2 && Array.isArray(parsed.items)
    ? parsed.items[0]
    : parsed;
}

function resolveCatalogTranscriptPath(pilotHome, transcriptRelPath) {
  assert.equal(typeof transcriptRelPath, 'string');
  return path.join(pilotHome, ...transcriptRelPath.split('/'));
}

async function readJsonl(transcriptPath) {
  return (await readFile(transcriptPath, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function modelUserTexts(messages) {
  return (messages ?? [])
    .filter((message) => message.role === 'user')
    .map((message) => message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(''));
}

function acceptedEntry(sessionId, sequence, turnId, text, createdAt, metadata = {}) {
  return {
    type: 'accepted_input',
    sessionId,
    turnId,
    sequence,
    createdAt,
    entryId: `${turnId}-${sequence}`,
    ...metadata,
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  };
}

function createFakeTextWebSocket() {
  let messageHandler = () => {};
  const sent = [];
  return {
    sent,
    connection: {
      onMessage(handler) {
        messageHandler = handler;
      },
      onClose() {},
      sendText(message) {
        sent.push(JSON.parse(message));
      },
      close() {},
    },
    receive(frame) {
      messageHandler(JSON.stringify(frame));
    },
  };
}

async function waitFor(predicate, timeoutMs = 2_000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('timed out waiting for async frame');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
