/**
 * PD-SAAS-FORK: Compose parseable archive/diagnostic HTML from live API artifacts.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDeliverableRows(rows) {
  if (!rows?.length) {
    return '<tr><td>—</td><td>—</td><td>校验中…</td><td>—</td></tr>';
  }
  return rows.map((row) => (
    `<tr><td>${escapeHtml(row.label ?? '—')}</td>`
    + `<td>${escapeHtml(row.typeLabel ?? '—')}</td>`
    + `<td>${escapeHtml(row.statusLabel ?? '—')}</td>`
    + `<td>${escapeHtml(row.pathText ?? '—')}</td></tr>`
  )).join('\n');
}

function renderFolderRows(files) {
  if (!files?.length) {
    return '<tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';
  }
  return files.map((file, index) => (
    `<tr><td>${index + 1}</td>`
    + `<td>${escapeHtml(file.path ?? '—')}</td>`
    + `<td>${escapeHtml(file.basename ?? '—')}</td>`
    + `<td>${escapeHtml(file.source ?? 'disk')}</td>`
    + `<td>${escapeHtml(file.inContract ?? '—')}</td>`
    + `<td>${escapeHtml(file.slotId ?? '—')}</td>`
    + `<td>${escapeHtml(file.isProcessFile ?? 'false')}</td></tr>`
  )).join('\n');
}

/**
 * @param {{
 *   mode: 'user_archive' | 'diagnostic',
 *   sessionId: string,
 *   title: string,
 *   contractHash?: string | null,
 *   certificate?: object | null,
 *   snapshotEnvelope?: object | null,
 *   deliverableRows?: Array<{ label?: string, typeLabel?: string, statusLabel?: string, pathText?: string }>,
 *   folderFiles?: Array<Record<string, unknown>>,
 *   snapshotBanner?: string,
 *   completionState?: string,
 *   taskKind?: string,
 * }} input
 */
export function compose0717LiveExportHtml(input) {
  const manifest = {
    sessionId: input.sessionId,
    title: input.title,
    exportMode: input.mode,
    generatedAt: new Date().toISOString(),
    snapshotEnvelope: input.snapshotEnvelope ?? null,
    completionState: input.completionState ?? 'incomplete',
    taskKind: input.taskKind ?? 'deliverable',
    turnDeliverableSnapshots: [{
      acceptanceCertificate: input.certificate ?? null,
      slotBindings: input.certificate?.slots?.map((slot) => ({
        slotId: slot.slotId,
        resolvedPath: slot.resolvedPath ?? slot.resolvedPaths?.[0],
        status: slot.status,
        unitId: slot.unitId,
      })) ?? [],
    }],
    deliverables: (input.deliverableRows ?? []).map((row) => ({
      label: row.label,
      resolvedPath: row.pathText,
      status: row.statusLabel,
    })),
    folderFiles: input.folderFiles ?? [],
  };

  const manifestJson = escapeHtml(JSON.stringify(manifest, null, 2));
  const contractHash = input.contractHash ?? input.certificate?.contractHash ?? '0';
  const banner = input.snapshotBanner
    ?? (input.completionState === 'complete' ? '终态快照' : '进行中快照');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-session-id="${escapeHtml(input.sessionId)}" data-export-mode="${escapeHtml(input.mode)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)} · Nova Ai-Studio</title>
</head>
<body>
  <p class="export-snapshot-banner">${escapeHtml(banner)}</p>
  <section data-testid="deliverable-summary-table" data-contract-hash="${escapeHtml(contractHash)}">
    <table>
      <thead><tr><th>成果名称</th><th>文件类型</th><th>状态</th><th>文件链接</th></tr></thead>
      <tbody>
        ${renderDeliverableRows(input.deliverableRows)}
      </tbody>
    </table>
  </section>
  <section data-testid="folder-content-table">
    <p class="section-note">${escapeHtml(input.snapshotEnvelope?.truncated ? '文件夹快照可能不完整' : '文件夹快照')}</p>
    <table>
      <thead><tr><th>#</th><th>路径</th><th>文件名</th><th>来源</th><th>合同</th><th>槽位</th><th>过程文件</th></tr></thead>
      <tbody>
        ${renderFolderRows(input.folderFiles)}
      </tbody>
    </table>
  </section>
  <pre id="nova-session-export-index">${manifestJson}</pre>
</body>
</html>`;
}
