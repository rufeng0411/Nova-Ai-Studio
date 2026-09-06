// PD-SAAS-FORK: cross-process promo.mp4 render lock (Gateway + Bridge)
import { open, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

const STALE_MS = 15 * 60 * 1000;

export function promoLockPath(taskDir: string): string {
  const normalized = String(taskDir || "").replace(/\\/g, "/").replace(/\/+$/, "");
  return path.join(normalized, "promo.mp4.lock");
}

export type PromoRenderLock = {
  ok: true;
  release: () => Promise<void>;
} | {
  ok: false;
  error: string;
  detail?: string;
};

export async function acquirePromoRenderLock(
  taskDir: string,
  owner = "gateway",
): Promise<PromoRenderLock> {
  const lockFile = promoLockPath(taskDir);
  const payload = JSON.stringify({
    owner,
    pid: process.pid,
    ts: new Date().toISOString(),
  });
  try {
    const handle = await open(lockFile, "wx");
    await handle.writeFile(payload, "utf8");
    await handle.close();
    return {
      ok: true,
      release: async () => {
        await unlink(lockFile).catch(() => undefined);
      },
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "EEXIST") {
      return { ok: false, error: (error as Error)?.message ?? "lock_failed" };
    }
    try {
      const st = await stat(lockFile);
      if (Date.now() - st.mtimeMs > STALE_MS) {
        await unlink(lockFile).catch(() => undefined);
        return acquirePromoRenderLock(taskDir, owner);
      }
      const existing = await readFile(lockFile, "utf8").catch(() => "");
      return { ok: false, error: "render_in_progress", detail: existing };
    } catch {
      return { ok: false, error: "render_in_progress" };
    }
  }
}
