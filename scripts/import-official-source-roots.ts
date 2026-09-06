#!/usr/bin/env tsx
// PD-SAAS-FORK P0-3: validate and atomically import official source roots.

import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  resolveOfficialSourceRootsPath,
  validateOfficialSourceRoots,
  type OfficialSourceRootsRegistry,
} from "../src/saas/media/officialSourceRoots.js";

export async function validateOfficialSourceRootsFile(
  filePath: string,
): Promise<OfficialSourceRootsRegistry> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(filePath), "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read official source roots: ${message}`);
  }
  const validation = validateOfficialSourceRoots(parsed);
  if (!validation.ok) {
    throw new Error(
      `Invalid official source roots: ${validation.issues.join("; ")}`,
    );
  }
  return validation.registry;
}

export async function importOfficialSourceRootsFile(
  sourcePath: string,
  destinationPath = resolveOfficialSourceRootsPath(),
): Promise<OfficialSourceRootsRegistry> {
  const registry = await validateOfficialSourceRootsFile(sourcePath);
  const destination = resolve(destinationPath);
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(
      temporary,
      `${JSON.stringify(registry, null, 2)}\n`,
      "utf8",
    );
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return registry;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  tsx scripts/import-official-source-roots.ts --check [file]",
      "  tsx scripts/import-official-source-roots.ts --import <source> [destination]",
    ].join("\n"),
  );
}

async function main(args: string[]): Promise<void> {
  const [command, firstPath, secondPath] = args;
  if (command === "--check") {
    const filePath = firstPath ?? resolveOfficialSourceRootsPath();
    const registry = await validateOfficialSourceRootsFile(filePath);
    console.log(
      `[official-source-roots] valid version=${registry.version} roots=${registry.roots.length}`,
    );
    return;
  }
  if (command === "--import" && firstPath) {
    const registry = await importOfficialSourceRootsFile(
      firstPath,
      secondPath ?? resolveOfficialSourceRootsPath(),
    );
    console.log(
      `[official-source-roots] imported version=${registry.version} roots=${registry.roots.length}`,
    );
    return;
  }
  printUsage();
  process.exitCode = 1;
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryUrl) {
  void main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[official-source-roots] ${message}`);
    process.exitCode = 1;
  });
}
