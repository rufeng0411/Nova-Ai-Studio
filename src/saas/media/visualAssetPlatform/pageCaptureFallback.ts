// PD-SAAS-FORK VAP: bounded Playwright viewport capture when CDN image URLs fail.

import { createHash } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { withPlaywrightBrowserSlot } from "../../document-export/playwrightPool.js";
import { resolveSessionDownloadsRelDir } from "./sessionDownloadPaths.js";

const MAX_CAPTURES_PER_RUN = 2;

export type PageCaptureInput = {
  workspaceRoot: string;
  sessionId: string;
  taskArtifactDir: string;
  pageUrl: string;
  html: string;
  captureIndex: number;
};

export type PageCaptureResult = {
  relPath: string;
  absPath: string;
} | null;

export function isPageCaptureEnabled(): boolean {
  const raw = process.env.PILOTDECK_VAP_PAGE_CAPTURE?.trim();
  if (raw === "0" || raw === "false") return false;
  return true;
}

/** PD-SAAS-FORK: live URL goto by default; set PILOTDECK_VAP_LIVE_CAPTURE=0 for file:// fallback. */
export function isVapLiveCaptureEnabled(): boolean {
  const raw = process.env.PILOTDECK_VAP_LIVE_CAPTURE?.trim().toLowerCase();
  if (raw === "0" || raw === "false") return false;
  return true;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function capturePageViewportPng(
  input: PageCaptureInput,
): Promise<PageCaptureResult> {
  if (!isPageCaptureEnabled()) return null;
  if (input.captureIndex >= MAX_CAPTURES_PER_RUN) return null;

  const relCaptureDir = path
    .join(input.taskArtifactDir, "assets", "_capture")
    .replace(/\\/gu, "/");
  const absCaptureDir = path.join(input.workspaceRoot, relCaptureDir);
  await mkdir(absCaptureDir, { recursive: true });

  const hash = createHash("sha256")
    .update(input.pageUrl)
    .digest("hex")
    .slice(0, 10);
  const htmlName = `page-${hash}.html`;
  const pngName = `capture-${hash}.png`;
  const absHtml = path.join(absCaptureDir, htmlName);
  const absPng = path.join(absCaptureDir, pngName);

  const sanitizedHtml = input.html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
    .slice(0, 2_000_000);

  await writeFile(absHtml, sanitizedHtml, "utf8");

  const useLive = isVapLiveCaptureEnabled() && isSafeHttpUrl(input.pageUrl);

  try {
    await withPlaywrightBrowserSlot(async (browser) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      });
      try {
        const page = await context.newPage();
        if (useLive) {
          await page.goto(input.pageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
        } else {
          const fileUrl = `file:///${absHtml.replace(/\\/gu, "/")}`;
          await page.goto(fileUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
        }
        await page.waitForTimeout(800);
        await page.screenshot({
          path: absPng,
          type: "png",
          fullPage: false,
        });
      } finally {
        await context.close().catch(() => undefined);
      }
    });
  } catch {
    return null;
  }

  const relRawDir = resolveSessionDownloadsRelDir(input.sessionId);
  const absRawDir = path.join(input.workspaceRoot, relRawDir);
  await mkdir(absRawDir, { recursive: true });
  const relPath = `${relRawDir}/${pngName}`.replace(/\\/gu, "/");
  const absDest = path.join(input.workspaceRoot, relPath.replace(/\//gu, path.sep));

  try {
    await copyFile(absPng, absDest);
  } catch {
    return null;
  }

  return { relPath, absPath: absDest };
}
