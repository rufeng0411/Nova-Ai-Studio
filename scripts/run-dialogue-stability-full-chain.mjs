#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDialogueStabilityScenarios } from './lib/dialogueStabilityScenarioRunner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const scenariosPath = path.join(repoRoot, 'tests', 'fixtures', 'dialogue-stability', 'scenarios.json');
const suiteArg = process.argv.find((arg) => arg.startsWith('--suite='));
const suite = suiteArg ? suiteArg.slice('--suite='.length) : 'all';

const result = await runDialogueStabilityScenarios({ repoRoot, scenariosPath, suite });

console.log(`\n[dialogue-stability] report: ${path.relative(repoRoot, result.reportPath)}`);
if (!result.ok) {
  process.exit(1);
}
