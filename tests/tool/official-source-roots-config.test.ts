import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  importOfficialSourceRootsFile,
  validateOfficialSourceRootsFile,
} from "../../scripts/import-official-source-roots.js";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const SCHEMA_PATH = join(
  REPO_ROOT,
  "config",
  "official-source-roots.schema.json",
);
const REGISTRY_PATH = join(
  REPO_ROOT,
  "config",
  "official-source-roots.json",
);

test("official source roots schema and default registry are bounded and generic", async () => {
  const schemaRaw = await readFile(SCHEMA_PATH, "utf8");
  const registryRaw = await readFile(REGISTRY_PATH, "utf8");
  const schema = JSON.parse(schemaRaw) as Record<string, unknown>;
  const registry = JSON.parse(registryRaw) as Record<string, unknown>;

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["version", "roots"]);
  assert.equal(registry.version, 1);
  assert.deepEqual(registry.roots, []);
  assert.doesNotMatch(`${schemaRaw}\n${registryRaw}`, /G700|mingdi|鸣镝/iu);

  const validated = await validateOfficialSourceRootsFile(REGISTRY_PATH);
  assert.deepEqual(validated, { version: 1, roots: [] });
});

test("official source roots import validates before atomic destination replacement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "official-source-roots-"));
  const source = join(directory, "source.json");
  const destination = join(directory, "destination.json");
  try {
    await writeFile(
      source,
      JSON.stringify({
        version: 1,
        roots: [{
          id: "sample-brand",
          rootUrl: "http://brand.sample-company.com/",
          sourceTier: "brand_official",
          includeSubdomains: true,
        }],
      }),
      "utf8",
    );
    await importOfficialSourceRootsFile(source, destination);
    const imported = JSON.parse(await readFile(destination, "utf8"));
    assert.equal(
      imported.roots[0]?.rootUrl,
      "https://brand.sample-company.com/",
    );

    await writeFile(
      source,
      JSON.stringify({
        version: 1,
        roots: [{
          id: "unsafe",
          rootUrl: "https://127.0.0.1/private",
          sourceTier: "brand_official",
        }],
      }),
      "utf8",
    );
    await assert.rejects(
      importOfficialSourceRootsFile(source, destination),
      /unsafe|non-public/iu,
    );
    const preserved = JSON.parse(await readFile(destination, "utf8"));
    assert.equal(preserved.roots[0]?.id, "sample-brand");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
