import { spawn } from '../../../util/childProcess.js';
import { withHiddenConsole } from "../../../util/withHiddenConsole.js";
import { resolveHiddenShellSpawn } from "../../../util/winHiddenShell.js";
import type { PilotDeckHookInput } from "../protocol/input.js";
import type { PilotDeckHookCommand } from "../protocol/settings.js";
import { parseHookOutput } from "./parseHookOutput.js";
import type { PilotDeckHookOutput } from "../protocol/output.js";

export const PILOTDECK_HOOK_TIMEOUT_MS = 10 * 60 * 1000;
export const PILOTDECK_SESSION_END_HOOK_TIMEOUT_MS = 1500;

export type CommandHookExecutionOptions = {
  hook: Extract<PilotDeckHookCommand, { type: "command" }>;
  hookInput: PilotDeckHookInput;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CommandHookExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode?: number;
  outcome: "success" | "blocking" | "non_blocking_error" | "cancelled" | "timeout";
  output: PilotDeckHookOutput;
};

export class CommandHookExecutor {
  execute(options: CommandHookExecutionOptions): Promise<CommandHookExecutionResult> {
    const timeoutMs = options.timeoutMs ?? PILOTDECK_HOOK_TIMEOUT_MS;
    const resolved = resolveHiddenShellSpawn(options.hook.command, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const child =
      resolved.args.length > 0
        ? spawn(resolved.command, resolved.args, withHiddenConsole(resolved.options))
        : spawn(resolved.command, withHiddenConsole(resolved.options));

    const { stdout: childStdout, stderr: childStderr, stdin: childStdin } = child;
    if (!childStdout || !childStderr || !childStdin) {
      return Promise.reject(new Error('CommandHookExecutor: child stdio pipes unavailable'));
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    childStdout.setEncoding("utf8");
    childStderr.setEncoding("utf8");
    childStdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    childStderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    childStdin.end(JSON.stringify(options.hookInput));

    return new Promise((resolve) => {
      const finish = (result: Omit<CommandHookExecutionResult, "stdout" | "stderr" | "output">) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        resolve({
          ...result,
          stdout,
          stderr,
          output: parseHookOutput(stdout),
        });
      };

      const abort = () => {
        child.kill();
        finish({ outcome: "cancelled" });
      };

      const timer = setTimeout(() => {
        child.kill();
        finish({ outcome: "timeout" });
      }, timeoutMs);
      timer.unref();

      options.signal?.addEventListener("abort", abort, { once: true });
      child.on("error", (error) => {
        stderr += error instanceof Error ? error.message : String(error);
        finish({ outcome: "non_blocking_error" });
      });
      child.on("close", (code) => {
        const exitCode = code ?? undefined;
        finish({
          exitCode,
          outcome: exitCode === 0 ? "success" : exitCode === 2 ? "blocking" : "non_blocking_error",
        });
      });
    });
  }
}
