// PD-SAAS-FORK P0-5: process-wide bounded Playwright reuse for local rendering.
import {
  chromium,
  type Browser,
} from "playwright";

import { playwrightLaunchOptions } from "./playwrightLaunch.js";

const MAX_PLAYWRIGHT_CONCURRENCY = 2;

export class PlaywrightSemaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private maxConcurrent: number;

  constructor(size = 1) {
    this.maxConcurrent = normalizePoolSize(size);
  }

  configure(size: number): void {
    this.maxConcurrent = normalizePoolSize(size);
    this.pump();
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.active = Math.max(0, this.active - 1);
      this.pump();
    }
  }

  get stats(): { active: number; queued: number; max: number } {
    return {
      active: this.active,
      queued: this.queue.length,
      max: this.maxConcurrent,
    };
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.pump();
    });
  }

  private pump(): void {
    while (
      this.active < this.maxConcurrent
      && this.queue.length > 0
    ) {
      const next = this.queue.shift();
      if (!next) return;
      this.active += 1;
      next();
    }
  }
}

let browserPromise: Promise<Browser> | null = null;
const playwrightSemaphore = new PlaywrightSemaphore();

function normalizePoolSize(size: number): number {
  if (!Number.isFinite(size)) return 1;
  return Math.max(
    1,
    Math.min(Math.floor(size), MAX_PLAYWRIGHT_CONCURRENCY),
  );
}

export function configurePlaywrightPool(size: number): void {
  playwrightSemaphore.configure(size);
}

export function getPlaywrightPoolStats(): {
  active: number;
  queued: number;
  max: number;
} {
  return playwrightSemaphore.stats;
}

export async function closePlaywrightPool(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => undefined);
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch(playwrightLaunchOptions());
  }
  return browserPromise;
}

export async function withPlaywrightBrowserSlot<T>(
  operation: (browser: Browser) => Promise<T>,
): Promise<T> {
  return playwrightSemaphore.run(async () =>
    operation(await getBrowser())
  );
}

export async function renderHtmlFileToPdf(options: {
  htmlAbsolutePath: string;
  pdfAbsolutePath: string;
  landscape?: boolean;
}): Promise<void> {
  await withPlaywrightBrowserSlot(async (browser) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const fileUrl =
        `file:///${options.htmlAbsolutePath.replace(/\\/g, "/")}`;
      await page.goto(fileUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(
        playwrightSemaphore.stats.max > 1 ? 400 : 800,
      );
      await page.pdf({
        path: options.pdfAbsolutePath,
        format: "A4",
        landscape: options.landscape ?? false,
        printBackground: true,
        margin: {
          top: "14mm",
          bottom: "14mm",
          left: "12mm",
          right: "12mm",
        },
      });
    } finally {
      await context.close();
    }
  });
}
