// PD-SAAS-FORK P0-A′: scope-filter missing/broken/verified acceptance paths to current task dir.
import { filterVerifiedForContractBinding } from "./filterVerifiedForContractBinding.js";
import { normalizeSdmPath } from "./sdmSlotMatching.js";

export function pathUnderAcceptanceScope(path: string, scopeDir: string | null | undefined): boolean {
  const scopeNorm = scopeDir
    ? normalizeSdmPath(scopeDir).replace(/\/+$/, "").toLowerCase()
    : null;
  if (!scopeNorm) return true;
  const normalized = normalizeSdmPath(path);
  if (!normalized || !normalized.includes("/")) return true;
  const dir = normalized.replace(/\/[^/]+$/, "").toLowerCase();
  return dir === scopeNorm || dir.startsWith(`${scopeNorm}/`);
}

export function filterAcceptancePathsForScope(
  paths: readonly string[],
  scopeDir: string | null | undefined,
): string[] {
  if (!scopeDir) return [...paths];
  return paths.filter((raw) => pathUnderAcceptanceScope(String(raw ?? ""), scopeDir));
}

export function filterVerifiedPathsForScope(
  verifiedPaths: readonly string[],
  scopeDir: string | null | undefined,
): string[] {
  return filterVerifiedForContractBinding([...verifiedPaths], {
    scopeDir: scopeDir ?? undefined,
  });
}
