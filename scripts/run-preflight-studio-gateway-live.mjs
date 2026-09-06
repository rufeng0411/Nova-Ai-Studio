#!/usr/bin/env node
/** PD-SAAS-FORK: Preflight Studio Gateway live (L-OD-GW / L-PPT-GW) */
import fs from 'node:fs';
import path from 'node:path';
import { runPreflightStudioGatewayLive } from './lib/runPreflightStudioGatewayLive.mjs';
import { parsePreflightGatewayKpis, evaluatePreflightGatewayGate } from './lib/preflightStudioGatewayKpi.mjs';
import { PREFLIGHT_GATEWAY_CASES } from './lib/preflightStudioGatewayCases.mjs';

const gate = process.argv.includes('--gate');
const skipExport = process.argv.includes('--skip-export');
const rescoreOnly = process.argv.includes('--rescore');

const OUT = path.join(process.cwd(), 'artifacts/preflight-studio-gateway-20260730');

function rescoreExistingReport() {
  const reportPath = path.join(OUT, 'report.json');
  if (!fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  for (const c of report.cases ?? []) {
    const spec = PREFLIGHT_GATEWAY_CASES[c.caseId];
    if (!spec || !c.transcriptPath) continue;
    const preflightKpis = parsePreflightGatewayKpis(c.transcriptPath);
    const gateEval = evaluatePreflightGatewayGate(spec.gate, preflightKpis);
    c.preflightKpis = preflightKpis;
    c.gateEval = gateEval;
    c.ok = gateEval.pass
      && preflightKpis.taskArtifactWrites.length > 0
      && preflightKpis.askUserBeforeFirstWrite === 0;
  }
  report.passCount = report.cases.filter((x) => x.ok).length;
  report.total = report.cases.length;
  report.pass = report.passCount === report.total && report.total > 0;
  report.ts = new Date().toISOString();
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  if (rescoreOnly) {
    const report = rescoreExistingReport();
    if (!report) {
      console.error('[preflight:gateway:live] no report to rescore');
      process.exit(gate ? 1 : 0);
    }
    console.log(JSON.stringify({
      ts: report.ts,
      rescore: true,
      pass: report.pass,
      passCount: report.passCount,
      total: report.total,
    }, null, 2));
    if (gate && !report.pass) process.exit(1);
    return;
  }

  const result = await runPreflightStudioGatewayLive({ skipHtmlExport: skipExport });
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    skipped: result.skipped,
    pass: result.ok,
    passCount: result.passCount,
    total: result.total,
    outDir: result.outDir,
  }, null, 2));
  if (result.skipped) {
    console.error(`[preflight:gateway:live] SKIP: ${result.reason}`);
    if (gate) process.exit(1);
    return;
  }
  if (gate && !result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
