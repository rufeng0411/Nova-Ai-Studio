/**
 * PD-SAAS-FORK: Gate evaluation for three-case speed RCA live harness.
 */

/**
 * @param {string} caseId
 * @param {import('./threeCaseSpeedRcaLiveCases.mjs').ThreeCaseLiveSpec} spec
 * @param {{
 *   firstWriteFileMs?: number | null;
 *   repairCount?: number;
 *   tmpWorkspaceCount?: number;
 *   footerProgress?: { done: number; total: number };
 * }} kpis
 */
export function evaluateThreeCaseGate(caseId, spec, kpis) {
  const reasons = [];
  const g = spec.gate;
  if (kpis.firstWriteFileMs != null && kpis.firstWriteFileMs > g.firstWriteFileMs) {
    reasons.push(`firstWriteFileMs ${kpis.firstWriteFileMs} > ${g.firstWriteFileMs}`);
  }
  if ((kpis.repairCount ?? 0) > g.repairCount) {
    reasons.push(`repairCount ${kpis.repairCount} > ${g.repairCount}`);
  }
  if ((kpis.tmpWorkspaceCount ?? 0) > g.tmpWorkspaceCount) {
    reasons.push(`tmpWorkspaceCount ${kpis.tmpWorkspaceCount} > ${g.tmpWorkspaceCount}`);
  }
  const fp = kpis.footerProgress ?? { done: 0, total: 0 };
  if (fp.done < g.footerProgressMin.done || fp.total < g.footerProgressMin.total) {
    reasons.push(
      `footerProgress ${fp.done}/${fp.total} < ${g.footerProgressMin.done}/${g.footerProgressMin.total}`,
    );
  }
  return { pass: reasons.length === 0, reasons, caseId };
}
