#!/usr/bin/env node
/** PD-SAAS-FORK: offline resume-context route wiring check (P0-4) */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const messagesRoute = readFileSync(path.join(root, 'ui/server/routes/messages.js'), 'utf8');
const fetchHelper = readFileSync(path.join(root, 'ui/src/shared/fetchTaskResumeContext.ts'), 'utf8');
const resumeEngine = readFileSync(path.join(root, 'src/session/resume/buildTaskResumeContext.ts'), 'utf8');

assert.match(messagesRoute, /resume-context/);
assert.match(messagesRoute, /buildTaskResumeContextFromTranscript/);
assert.match(fetchHelper, /fetchTaskResumeContext/);
assert.match(resumeEngine, /buildTaskResumeContextFromTranscript/);
console.log('[integration-resume-context] ok');
