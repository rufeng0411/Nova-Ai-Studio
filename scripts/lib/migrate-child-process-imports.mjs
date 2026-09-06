#!/usr/bin/env node
/**
 * One-shot: migrate child_process imports to patched wrappers (UTF-8 safe).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

const jobs = [
  { file: 'ui/server/cli.js', from: "from 'child_process'", to: "from './utils/childProcess.js'" },
  { file: 'ui/server/routes/agent.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/capabilities.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/commands.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/config.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/git.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/mcp.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/projects.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/skills.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/update.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/routes/user.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/services/cron-daemon-startup.js', from: "from 'child_process'", to: "from '../utils/childProcess.js'" },
  { file: 'ui/server/utils/commandParser.js', from: "from 'child_process'", to: "from './childProcess.js'" },
  { file: 'ui/server/utils/gitConfig.js', from: "from 'child_process'", to: "from './childProcess.js'" },
  { file: 'ui/server/utils/globalChrome.js', from: "from 'child_process'", to: "from './childProcess.js'" },
  { file: 'ui/server/utils/plugin-process-manager.js', from: "from 'child_process'", to: "from './childProcess.js'" },
  {
    file: 'src/adapters/channel/whatsapp/WhatsAppChannel.ts',
    from: 'from "node:child_process"',
    to: 'from "../../../util/childProcess.js"',
  },
];

for (const { file, from, to } of jobs) {
  const abs = join(repoRoot, file);
  let text = readFileSync(abs, 'utf8');
  const next = text.replaceAll(from, to);
  if (next === text) {
    console.warn(`[skip] no change: ${file}`);
    continue;
  }
  writeFileSync(abs, next, 'utf8');
  console.log(`[ok] ${file}`);
}

// mcp.js dynamic imports
const mcpPath = join(repoRoot, 'ui/server/routes/mcp.js');
let mcp = readFileSync(mcpPath, 'utf8');
const mcpNext = mcp.replaceAll("await import('child_process')", "await import('../utils/childProcess.js')");
if (mcpNext !== mcp) {
  writeFileSync(mcpPath, mcpNext, 'utf8');
  console.log('[ok] mcp.js dynamic imports');
}
