// PD-SAAS-FORK: spawn helpers for import scripts (capture stdout)
import { spawn } from '../../util/childProcess.js';

export type ScriptRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function runOnce(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<ScriptRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export async function runPythonImportScript(
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<ScriptRunResult> {
  const preferred = env.PILOTDECK_PYTHON?.trim();
  const candidates: Array<{ cmd: string; args: string[] }> = preferred
    ? [{ cmd: preferred, args: [scriptPath, ...args] }]
    : [
        { cmd: "python", args: [scriptPath, ...args] },
        { cmd: "python3", args: [scriptPath, ...args] },
        { cmd: "py", args: ["-3", scriptPath, ...args] },
      ];
  let last: ScriptRunResult | undefined;
  for (const candidate of candidates) {
    try {
      const result = await runOnce(candidate.cmd, candidate.args, env);
      last = result;
      if (result.exitCode === 0) return result;
    } catch {
      continue;
    }
  }
  return last ?? { exitCode: 1, stdout: "", stderr: "No Python interpreter found" };
}

export async function isPythonAvailable(): Promise<boolean> {
  const script = process.platform === "win32" ? "python" : "python3";
  try {
    const r = await runOnce(script, ["--version"], process.env);
    return r.exitCode === 0;
  } catch {
    return false;
  }
}
