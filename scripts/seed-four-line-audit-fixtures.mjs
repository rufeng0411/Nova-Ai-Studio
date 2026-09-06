#!/usr/bin/env node

/**

 * PD-SAAS-FORK: Seed four-line audit session list (≥4 multi-slot jsonl paths).

 */

import fs from 'node:fs';

import path from 'node:path';

import { fileURLToPath } from 'node:url';



const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OUT = path.join(REPO_ROOT, 'tests', 'fixtures', 'four-line-audit-sessions.json');

const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'transcripts', 'four-line');

const WORKSPACE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'four-line-workspace');



function writeArtifact(relPath, body) {

  const abs = path.join(WORKSPACE_ROOT, relPath);

  fs.mkdirSync(path.dirname(abs), { recursive: true });

  fs.writeFileSync(abs, body, 'utf8');

}



function mkTurnJsonl(name, artifactPath, hintDir) {

  const sessionId = `web-s_fourline_${name}`;

  const turnId = 't-0';

  const lines = [

    {

      type: 'accepted_input',

      sessionId,

      turnId,

      sequence: 1,

      createdAt: '2026-06-20T00:00:01.000Z',

      entryId: 'e-1',

      messages: [{ role: 'user', content: [{ type: 'text', text: '生成交付物' }] }],

    },

    {

      type: 'assistant_message',

      sessionId,

      turnId,

      sequence: 2,

      createdAt: '2026-06-20T00:00:02.000Z',

      entryId: 'e-2',

      message: {

        role: 'assistant',

        content: [

          {

            type: 'tool_call',

            name: 'write_file',

            input: JSON.stringify({ file_path: artifactPath, content: 'ok' }),

          },

          { type: 'text', text: `已写入 ${artifactPath}` },

        ],

      },

    },

    {

      type: 'tool_result_message',

      sessionId,

      turnId,

      sequence: 3,

      createdAt: '2026-06-20T00:00:03.000Z',

      entryId: 'e-3',

      message: {

        role: 'user',

        content: [{

          type: 'tool_result',

          toolCallId: 'tool-1',

          isError: false,

          content: [{ type: 'text', text: `Created ${artifactPath}.` }],

        }],

      },

    },

    {

      type: 'turn_deliverable_meta',

      sessionId,

      turnId,

      sequence: 4,

      createdAt: '2026-06-20T00:00:04.000Z',

      entryId: 'e-4',

      turnArtifactDir: hintDir,

    },

    {

      type: 'turn_result',

      sessionId,

      turnId,

      sequence: 5,

      createdAt: '2026-06-20T00:00:05.000Z',

      entryId: 'e-5',

      result: { type: 'success', stopReason: 'end_turn' },

    },

  ];

  const p = path.join(FIXTURE_DIR, `${name}.jsonl`);

  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  fs.writeFileSync(p, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');

  return p;

}



const cases = [

  {

    name: 'multi-slot-dir',

    artifactPath: 'artifacts/campaign/social-matrix/README.md',

    hintDir: 'artifacts/campaign/social-matrix',

    body: '# social matrix\n',

  },

  {

    name: 'slide-multi',

    artifactPath: 'artifacts/slides-demo/slide-01.png',

    hintDir: 'artifacts/slides-demo',

    body: 'PNG',

    binary: true,

  },

  {

    name: 'single-md',

    artifactPath: 'artifacts/reports/report-a.md',

    hintDir: 'artifacts/reports',

    body: '# report\n',

  },

  {

    name: 'multi-md',

    artifactPath: 'artifacts/geo/report.md',

    hintDir: 'artifacts/geo',

    body: '# geo report\n',

  },

];



for (const item of cases) {

  if (item.binary) {

    const abs = path.join(WORKSPACE_ROOT, item.artifactPath);

    fs.mkdirSync(path.dirname(abs), { recursive: true });

    fs.writeFileSync(abs, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  } else {

    writeArtifact(item.artifactPath, item.body);

  }

}



const sessions = cases.map((item) => ({

  tenantId: 'default',

  projectKey: 'general',

  projectRoot: WORKSPACE_ROOT,

  jsonlPath: mkTurnJsonl(item.name, item.artifactPath, item.hintDir),

}));



fs.writeFileSync(OUT, `${JSON.stringify({ sessions, generatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');

console.log(`[seed-four-line-audit] ${sessions.length} sessions → ${OUT}`);

