import { ProcessSupervisor } from '../dist-main/main/supervisor.js';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
process.env.NOVA_REPO_ROOT = repoRoot;

const supervisor = new ProcessSupervisor(repoRoot);
await supervisor.init();
console.log('[smoke] starting stack…');
const result = await supervisor.startOrRestart();
console.log('[smoke] result:', result);
if (!result.ok) process.exit(1);
console.log('[smoke] OK — shutting down in 5s');
await new Promise((r) => setTimeout(r, 5000));
await supervisor.shutdownAll();
console.log('[smoke] done');
