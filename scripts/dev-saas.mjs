#!/usr/bin/env node
/**
 * SaaS dev launcher (default `npm run dev`): same port probing as dev-launcher,
 * plus SaaS env injection.
 *
 *   PILOTDECK_SAAS_MODE=1
 *   PILOTDECK_DISABLE_LOCAL_AUTH=0
 *   DATA_ROOT=<repo>/.saas-dev-data
 *
 * Skills/capabilities still read ~/.pilotdeck (Legacy Bridge).
 */
import './lib/patchHiddenConsole.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSaasDevRuntime, printSaasDevBanner } from './lib/devLauncherCore.mjs';
import { runDevStack } from './lib/spawnDevStack.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

async function main() {
  const runtime = await prepareSaasDevRuntime(repoRoot);
  printSaasDevBanner(runtime);

  const stack = await runDevStack(repoRoot, runtime.env);

  const forward = () => stack.kill();
  process.on('SIGINT', () => forward());
  process.on('SIGTERM', () => forward());

  stack.onExit((code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
