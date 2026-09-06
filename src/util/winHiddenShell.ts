import type { SpawnOptions } from "node:child_process";

const WIN_COMSPEC = process.env.ComSpec || "cmd.exe";

/**
 * PD-SAAS-FORK: Windows hidden shell — no visible CMD, no detached console flash.
 */
export function resolveHiddenShellSpawn(
  command: string,
  base: SpawnOptions = {},
): { command: string; args: string[]; options: SpawnOptions } {
  if (process.platform !== "win32") {
    return {
      command,
      args: [],
      options: { ...base, shell: base.shell ?? true },
    };
  }
  return {
    command: WIN_COMSPEC,
    args: ["/d", "/s", "/c", command],
    options: {
      ...base,
      shell: false,
      windowsHide: true,
      detached: false,
    },
  };
}
