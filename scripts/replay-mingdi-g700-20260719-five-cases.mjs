/**
 * PD-SAAS-FORK VAP P0-E: offline replay for 2026-07-19 five-case goals.
 * Validates officialMediaRequirement compile + fixture KPIs (no live Gateway).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'mingdi-g700-vap-replay');

async function main() {
  const fixtureUrl = pathToFileURL(
    path.join(REPO_ROOT, 'tests/fixtures/mingdi-g700-20260719-five-case-goals.ts'),
  ).href;
  // Dynamic import of TS via tsx when runner uses --import tsx
  const { MINGDI_G700_20260719_FIVE_CASES } = await import(fixtureUrl);
  const { compileOfficialMediaRequirement } = await import(
    pathToFileURL(
      path.join(REPO_ROOT, 'src/saas/constraints/officialMediaRequirement.ts'),
    ).href
  );

  const rows = [];
  let pass = true;
  for (const fixture of MINGDI_G700_20260719_FIVE_CASES) {
    const req = compileOfficialMediaRequirement(fixture.userGoal);
    const officialOk = fixture.expectOfficialOnly
      ? req.officialMediaPolicy === 'official_only'
      : true;
    const forbidGenOk = fixture.expectOfficialOnly
      ? req.forbidGenerateImage === true
      : true;
    const row = {
      id: fixture.id,
      title: fixture.title,
      officialMediaPolicy: req.officialMediaPolicy,
      forbidGenerateImage: req.forbidGenerateImage,
      expectOfficialOnly: fixture.expectOfficialOnly,
      officialOk,
      forbidGenOk,
      historicalFailureTags: fixture.historicalFailureTags,
      pass: officialOk && forbidGenOk,
    };
    if (!row.pass) pass = false;
    rows.push(row);
    console.log(
      `[vap-replay] ${fixture.id} policy=${req.officialMediaPolicy} pass=${row.pass}`,
    );
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'five-case-replay-report.json');
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'replay',
    pass,
    cases: rows,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[vap-replay] report ${reportPath} pass=${pass}`);
  if (process.argv.includes('--gate') && !pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
