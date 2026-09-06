// PD-SAAS-FORK: spawn helper for export scripts
import { spawn } from '../../util/childProcess.js';
import { withHiddenConsole } from "../../util/withHiddenConsole.js";

export async function runNodeExportScript(
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], withHiddenConsole({
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Script exited with code ${code}`));
    });
  });
}

function isPythonSpawnMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function spawnPythonOnce(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onProgress?: (percent: number, stage?: string, page?: number, pageTotal?: number) => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, withHiddenConsole({
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stderr = "";
    let stdoutBuf = "";
    child.stdout?.on("data", (chunk) => {
      stdoutBuf += String(chunk);
      const lines = stdoutBuf.split(/\r?\n/);
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const payload = JSON.parse(trimmed) as {
            type?: string;
            percent?: number;
            stage?: string;
            page?: number;
            pageTotal?: number;
          };
          if (payload.type === "progress" && typeof payload.percent === "number" && onProgress) {
            void onProgress(
              payload.percent,
              payload.stage,
              typeof payload.page === "number" ? payload.page : undefined,
              typeof payload.pageTotal === "number" ? payload.pageTotal : undefined,
            );
          }
        } catch {
          // ignore non-json stdout
        }
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited ${code}`));
    });
  });
}

export async function runPythonExportScript(
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onProgress?: (percent: number, stage?: string, page?: number, pageTotal?: number) => void | Promise<void>,
): Promise<void> {
  const preferred = process.env.PILOTDECK_PYTHON?.trim();
  const candidates: Array<{ cmd: string; args: string[] }> = preferred
    ? [{ cmd: preferred, args: [scriptPath, ...args] }]
    : [
        { cmd: "python", args: [scriptPath, ...args] },
        { cmd: "python3", args: [scriptPath, ...args] },
        { cmd: "py", args: ["-3", scriptPath, ...args] },
      ];
  let missing: Error | undefined;
  for (const candidate of candidates) {
    try {
      await spawnPythonOnce(candidate.cmd, candidate.args, env, onProgress);
      return;
    } catch (error) {
      if (isPythonSpawnMissing(error)) {
        missing = error instanceof Error ? error : new Error(String(error));
        continue;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  throw missing ?? new Error("No Python interpreter found (tried python, python3, py -3)");
}
