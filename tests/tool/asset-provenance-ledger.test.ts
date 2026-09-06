import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendAssetProvenanceEntry,
  ASSET_PROVENANCE_LEDGER_MAX_BYTES,
  ASSET_PROVENANCE_LEDGER_MAX_ENTRIES,
  readAssetProvenanceLedger,
} from "../../src/saas/media/assetProvenanceLedger.js";

test("asset provenance ledger retains at most 32 recent entries within 8 KiB without signed URLs", async () => {
  const taskRoot = await mkdtemp(
    path.join(os.tmpdir(), "asset-provenance-ledger-"),
  );
  try {
    for (let index = 0; index < 40; index += 1) {
      await appendAssetProvenanceEntry({
        taskRoot,
        entry: {
          candidateId: `candidate-${index}`,
          localPath: `artifacts/task-media/assets/hero-${index}.png`,
          sha256: String(index).padStart(64, "0"),
          assetUrlHash: String(index + 1).padStart(64, "0"),
          sourcePage:
            `https://brand.example.com/product/${index}?token=secret-${index}`,
          sourceLevel: "L0",
          sourceTier: "brand_official",
          mimeType: "image/png",
          width: 1600,
          height: 900,
          bytes: 4096,
          fetchedAt: "2026-07-19T00:00:00.000Z",
        },
      });
    }

    const ledger = await readAssetProvenanceLedger(taskRoot);
    const raw = await readFile(ledger.ledgerPath);
    assert.ok(
      ledger.entries.length <= ASSET_PROVENANCE_LEDGER_MAX_ENTRIES,
    );
    assert.ok(raw.byteLength <= ASSET_PROVENANCE_LEDGER_MAX_BYTES);
    assert.equal(ledger.entries.at(-1)?.candidateId, "candidate-39");
    assert.doesNotMatch(raw.toString("utf8"), /secret-|[?&]token=/iu);
  } finally {
    await rm(taskRoot, { recursive: true, force: true });
  }
});

test("asset provenance ledger rejects a reparse-point ledger directory", async () => {
  const taskRoot = await mkdtemp(
    path.join(os.tmpdir(), "asset-provenance-ledger-task-"),
  );
  const outsideRoot = await mkdtemp(
    path.join(os.tmpdir(), "asset-provenance-ledger-outside-"),
  );
  try {
    await symlink(
      outsideRoot,
      path.join(taskRoot, "assets"),
      process.platform === "win32" ? "junction" : "dir",
    );

    await assert.rejects(
      () =>
        appendAssetProvenanceEntry({
          taskRoot,
          entry: {
            candidateId: "candidate-reparse",
            localPath: "assets/hero.png",
            sha256: "a".repeat(64),
            assetUrlHash: "b".repeat(64),
            sourcePage: "https://brand.example.com/product",
            sourceLevel: "L0",
            sourceTier: "brand_official",
            mimeType: "image/png",
            width: 1,
            height: 1,
            bytes: 68,
            fetchedAt: "2026-07-19T00:00:00.000Z",
          },
        }),
      /reparse|symbolic|outside/iu,
    );
  } finally {
    await rm(taskRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});
