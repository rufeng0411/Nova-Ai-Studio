/**
 * PD-SAAS-FORK: Mingdi G700 production-export structural audit.
 * This module intentionally emits only basenames, counts, and boolean evidence.
 */
import {
  parseExportHtmlFourLine,
} from './parseExportHtmlFourLine.mjs';

export const MINGDI_G700_METRIC_KEYS = [
  'scope_expansion',
  'cross_session_artifact',
  'passed_with_pending',
  'false_incomplete_loop',
  'official_media_violation',
  'forbidden_generate_image',
  'unreachable_hotlink',
  'unlabeled_degrade',
  'entity_misclassification',
  'slide_count_drift',
  'output_kind_mismatch',
  'deliverable_contract_mismatch',
  'content_assertion_failed',
  'snapshot_missing',
];

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function stripHtml(value) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function basename(value) {
  const normalized = String(value ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.split('/').pop() ?? '';
}

function kindFromBasename(value) {
  const name = basename(value).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : '';
}

function normalizeStatus(value) {
  const status = String(value ?? '');
  if (/已完成|已交付|完整|done|delivered/i.test(status)) return 'done';
  if (/校验中|进行中|checking|pending/i.test(status)) return 'pending';
  return 'missing';
}

function extractRoleMessages(html) {
  const messages = [];
  const articlePattern = /<article[^>]*class="[^"]*\brole-([a-z-]+)\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match;
  while ((match = articlePattern.exec(html)) !== null) {
    messages.push({
      role: match[1],
      text: stripHtml(match[2]),
    });
  }
  return messages;
}

function extractToolCalls(html) {
  const calls = {};
  const pattern = /<span[^>]*class="role"[^>]*>\s*工具调用:\s*([^<]+)<\/span>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = stripHtml(match[1]);
    if (!name) continue;
    calls[name] = (calls[name] ?? 0) + 1;
  }
  return calls;
}

function extractFilePathBasenames(decodedHtml) {
  const names = new Set();
  const pattern = /"(?:file_path|output_path|resolvedPath)"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(decodedHtml)) !== null) {
    const name = basename(match[1]);
    if (name && !/redacted/i.test(name)) names.add(name);
  }
  return names;
}

function completedBasenames(rows) {
  return rows
    .filter((row) => row.status === 'done' && row.basename)
    .map((row) => row.basename);
}

function normalizeExpectedFiles(qualityContract) {
  if (!Array.isArray(qualityContract?.expectedFiles)) {
    return {
      configured: false,
      files: [],
    };
  }
  return {
    configured: true,
    files: qualityContract.expectedFiles.map((file) => ({
      basename: basename(file?.basename),
      kind: String(file?.kind || kindFromBasename(file?.basename)).toLowerCase(),
      required: file?.required !== false,
    })),
  };
}

export function buildMingdiG700CaseContract(fixture) {
  if (!fixture || !Array.isArray(fixture.expectedFiles)) {
    throw new Error('鸣镝 G700 fixture 必须声明 expectedFiles');
  }
  const names = fixture.expectedFiles.map((file) => basename(file?.basename).toLowerCase());
  if (names.some((name) => !name)) {
    throw new Error(`鸣镝 G700 fixture expectedFiles basename 不能为空：${fixture.id ?? 'unknown'}`);
  }
  if (new Set(names).size !== names.length) {
    throw new Error(`鸣镝 G700 fixture expectedFiles basename 不得重复：${fixture.id ?? 'unknown'}`);
  }
  return {
    ...(fixture.qualityContract ?? {}),
    expectedFiles: fixture.expectedFiles.map((file) => ({ ...file })),
  };
}

function evaluateExpectedFiles(rows, qualityContract) {
  const normalized = normalizeExpectedFiles(qualityContract);
  const expectedNames = new Set(
    normalized.files.map((file) => file.basename.toLowerCase()),
  );
  const requiredFiles = normalized.files.filter((file) => file.required);
  const doneNames = new Set(
    completedBasenames(rows).map((name) => name.toLowerCase()),
  );
  const missingBasenames = requiredFiles
    .filter((file) => !doneNames.has(file.basename.toLowerCase()))
    .map((file) => file.basename);
  const unexpectedBasenames = normalized.configured
    ? [...doneNames]
      .filter((name) => !expectedNames.has(name))
      .sort((left, right) => left.localeCompare(right))
    : [];

  return {
    configured: normalized.configured,
    expectedBasenames: normalized.files.map((file) => file.basename),
    expectedKinds: [...new Set(
      requiredFiles.map((file) => file.kind).filter(Boolean),
    )],
    missingBasenames,
    unexpectedBasenames,
  };
}

function observedSlideCount(rows) {
  let highest = 0;
  for (const row of rows) {
    const label = String(row.label ?? '');
    const match = label.match(/(?:slide\s*|第\s*)(\d+)(?:\s*页)?/i);
    if (!match) continue;
    highest = Math.max(highest, Number(match[1]));
  }
  return highest > 0 ? highest : null;
}

function duplicateSlideBindingCount(rows) {
  const ownersByBasename = new Map();
  let duplicates = 0;
  for (const row of rows) {
    if (row.status !== 'done' || !row.basename) continue;
    if (!/(?:slide\s*\d+|第\s*\d+\s*页)/i.test(row.label)) continue;
    const key = row.basename.toLowerCase();
    if (ownersByBasename.has(key) && ownersByBasename.get(key) !== row.label) {
      duplicates += 1;
    }
    ownersByBasename.set(key, row.label);
  }
  return duplicates;
}

function countCrossSessionArtifacts(decodedHtml, fourLine, rows, qualityContract) {
  const completed = new Set(completedBasenames(rows).map((name) => name.toLowerCase()));
  const signatureCount = (qualityContract.crossSessionSignatures ?? [])
    .filter((name) => completed.has(name.toLowerCase()))
    .length;

  const exportedAt = String(fourLine.manifest?.exportedAt ?? '');
  const exportDate = exportedAt.slice(0, 10).replace(/-/g, '');
  const datedRoots = new Set();
  const artifactPattern = /\bartifacts\/([^\s"'`<>/]+)(?:\/|["'`\s<>])/gi;
  let match;
  while ((match = artifactPattern.exec(decodedHtml)) !== null) {
    const dateMatch = match[1].match(/20\d{6}/);
    if (dateMatch && exportDate && dateMatch[0] !== exportDate) {
      datedRoots.add(match[1].toLowerCase());
    }
  }

  return signatureCount + datedRoots.size;
}

function completionClaimFrom(messages) {
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const latest = assistantMessages.at(-1)?.text ?? '';
  return /全部交付完成|任务已完成|质量验收通过|全部完成|已完成并交付|无待办/.test(latest);
}

function degradeDisclosedFrom(messages) {
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  return assistantMessages.some((message) => (
    /降级说明|已降级|概念示意图[^。]*非官方|正式发布前.*替换/.test(message.text)
  ));
}

function countSyntheticPlaceholders(messages, filePathBasenames, unreachableHotlinkCount) {
  const processText = messages
    .filter((message) => message.role === 'assistant' || message.role === 'thinking')
    .map((message) => message.text)
    .join(' ');
  const hasExplicitPlaceholder = /SVG\s*占位|占位图|inline SVG placeholder/i
    .test(processText);
  if (!hasExplicitPlaceholder) return 0;

  const svgCount = [...filePathBasenames]
    .filter((name) => kindFromBasename(name) === 'svg')
    .length;
  if (svgCount > 0) return svgCount;
  return unreachableHotlinkCount > 0 ? 1 : 0;
}

function countForbiddenContentAssertions(decodedHtml, qualityContract) {
  let failures = 0;
  for (const pattern of qualityContract.contentAssertionForbiddenPatterns ?? []) {
    if (new RegExp(pattern, 'i').test(decodedHtml)) failures += 1;
  }
  return failures;
}

function deriveStructureEvidence(html, fourLine, qualityContract) {
  const decodedHtml = decodeHtmlEntities(html);
  const messages = extractRoleMessages(html);
  const rows = fourLine.deliverableTable.rows.map((row) => ({
    label: row.label,
    status: normalizeStatus(row.statusLabel),
    basename: row.pathText && row.pathText !== '—' ? basename(row.pathText) : null,
  }));
  const doneBasenames = completedBasenames(rows);
  const doneBasenameSet = new Set(doneBasenames.map((name) => name.toLowerCase()));
  const filePathBasenames = extractFilePathBasenames(decodedHtml);
  const filePathBasenameSet = new Set(
    [...filePathBasenames].map((name) => name.toLowerCase()),
  );
  const slideCount = observedSlideCount(rows);
  const expectedFiles = normalizeExpectedFiles(qualityContract);
  const expectedRequiredBasenames = expectedFiles.files
    .filter((file) => file.required)
    .map((file) => file.basename);
  const requiredTableBasenames = [
    ...new Set([
      ...(qualityContract.requiredTableBasenames ?? []),
      ...expectedRequiredBasenames,
    ]),
  ];
  const pendingRequiredWritten = requiredTableBasenames
    .filter((name) => (
      !doneBasenameSet.has(name.toLowerCase())
      && filePathBasenameSet.has(name.toLowerCase())
    ))
    .length;
  const expandedSlideContract = qualityContract.expectedSlideCount
    && slideCount
    && slideCount > qualityContract.expectedSlideCount
    && rows.some((row) => row.status === 'missing')
    ? 1
    : 0;
  const noFileIntentPending = expectedFiles.configured
    && expectedFiles.files.length === 0
    && rows.some((row) => row.status !== 'done')
    ? 1
    : 0;
  const allExpectedFilesDone = expectedRequiredBasenames.length > 0
    && expectedRequiredBasenames.every((name) => (
      doneBasenameSet.has(name.toLowerCase())
    ));
  const unexpectedPendingAfterCompletion = allExpectedFilesDone
    && rows.some((row) => row.status !== 'done')
    ? 1
    : 0;
  const toolCalls = extractToolCalls(html);
  const unreachableHotlinkCount = /图片都无法访问|全部\s*404|防盗链|远程图片[^。]*无法(?:访问|加载)/i
    .test(decodedHtml)
    ? 1
    : 0;
  const syntheticPlaceholderCount = countSyntheticPlaceholders(
    messages,
    filePathBasenames,
    unreachableHotlinkCount,
  );
  const entityMisclassificationCount = (qualityContract.forbiddenEntityTerms ?? [])
    .filter((term) => decodedHtml.includes(term))
    .length;
  const outputKinds = [...new Set(doneBasenames.map(kindFromBasename).filter(Boolean))];
  const hasStructuredOfficialMediaEvidence =
    /data-(?:official-)?media-source=|officialMediaProvenance|official_media_provenance/i
      .test(decodedHtml);

  return {
    deliverableRows: rows,
    toolCalls,
    snapshotPresent: Boolean(fourLine.snapshotEnvelope),
    completionClaim: completionClaimFrom(messages),
    crossSessionArtifactCount: countCrossSessionArtifacts(
      decodedHtml,
      fourLine,
      rows,
      qualityContract,
    ),
    falseIncompleteSignals:
      pendingRequiredWritten
      + expandedSlideContract
      + noFileIntentPending
      + unexpectedPendingAfterCompletion,
    unreachableHotlinkCount,
    syntheticPlaceholderCount,
    degradeDisclosed: degradeDisclosedFrom(messages),
    entityMisclassificationCount,
    observedContractSlideCount: slideCount,
    outputKinds,
    contentAssertionFailures:
      duplicateSlideBindingCount(rows)
      + countForbiddenContentAssertions(decodedHtml, qualityContract),
    officialMediaProvenanceComplete: hasStructuredOfficialMediaEvidence,
  };
}

export function computeMingdiG700Metrics(evidence, qualityContract) {
  const rows = Array.isArray(evidence.deliverableRows)
    ? evidence.deliverableRows
    : [];
  const doneBasenames = new Set(
    completedBasenames(rows).map((name) => name.toLowerCase()),
  );
  const pendingCount = rows.filter((row) => row.status === 'pending').length;
  const generateImageCalls = Number(evidence.toolCalls?.generate_image ?? 0);
  const expectedFileEvaluation = evaluateExpectedFiles(rows, qualityContract);
  const explicitScopeNames = (qualityContract.scopeGuardBasenames ?? [])
    .filter((name) => doneBasenames.has(name.toLowerCase()))
    .map((name) => name.toLowerCase());
  const scopeNames = new Set([
    ...explicitScopeNames,
    ...expectedFileEvaluation.unexpectedBasenames,
  ]);
  const unboundScopeSlots = expectedFileEvaluation.configured
    && expectedFileEvaluation.expectedBasenames.length === 0
    ? rows.filter((row) => !row.basename).length
    : 0;
  const scopeExpansion = scopeNames.size + unboundScopeSlots;
  const outputKindGroups = [
    ...(qualityContract.requiredOutputKindGroups ?? []),
    ...expectedFileEvaluation.expectedKinds.map((kind) => [kind]),
  ];
  const requiredOutputKindGroups = [];
  const seenOutputKindGroups = new Set();
  for (const group of outputKindGroups) {
    const normalizedGroup = [...new Set(
      group.map((kind) => String(kind).toLowerCase()),
    )].sort();
    const signature = normalizedGroup.join('|');
    if (!signature || seenOutputKindGroups.has(signature)) continue;
    seenOutputKindGroups.add(signature);
    requiredOutputKindGroups.push(normalizedGroup);
  }
  const actualKinds = new Set(
    (evidence.outputKinds ?? []).map((kind) => String(kind).toLowerCase()),
  );
  const outputKindMismatch = requiredOutputKindGroups
    .filter((group) => !group.some((kind) => actualKinds.has(kind.toLowerCase())))
    .length;
  const expectedSlideCount = Number(qualityContract.expectedSlideCount ?? 0);
  const observedCount = Number(evidence.observedContractSlideCount ?? 0);
  const slideCountDrift = expectedSlideCount > 0 && observedCount > 0
    ? Math.abs(observedCount - expectedSlideCount)
    : 0;
  const officialMediaViolation = qualityContract.officialMediaOnly === true
    && (
      generateImageCalls > 0
      || Number(evidence.unreachableHotlinkCount ?? 0) > 0
      || Number(evidence.syntheticPlaceholderCount ?? 0) > 0
      || (
        qualityContract.officialMediaEvidenceRequired === true
        && evidence.officialMediaProvenanceComplete !== true
      )
    )
    ? 1
    : 0;

  return {
    scope_expansion: scopeExpansion,
    cross_session_artifact: Number(evidence.crossSessionArtifactCount ?? 0),
    passed_with_pending:
      evidence.completionClaim === true && pendingCount > 0 ? 1 : 0,
    false_incomplete_loop: Number(evidence.falseIncompleteSignals ?? 0),
    official_media_violation: officialMediaViolation,
    forbidden_generate_image:
      qualityContract.forbidGenerateImage === true ? generateImageCalls : 0,
    unreachable_hotlink: Number(evidence.unreachableHotlinkCount ?? 0),
    unlabeled_degrade:
      Number(evidence.syntheticPlaceholderCount ?? 0) > 0
      && evidence.degradeDisclosed !== true
        ? 1
        : 0,
    entity_misclassification: Number(evidence.entityMisclassificationCount ?? 0),
    slide_count_drift: slideCountDrift,
    output_kind_mismatch: outputKindMismatch,
    deliverable_contract_mismatch:
      expectedFileEvaluation.missingBasenames.length,
    content_assertion_failed: Number(evidence.contentAssertionFailures ?? 0),
    snapshot_missing:
      qualityContract.snapshotRequired === true && evidence.snapshotPresent !== true
        ? 1
        : 0,
  };
}

export function failureLabelsFromMetrics(metrics) {
  return MINGDI_G700_METRIC_KEYS.filter((key) => Number(metrics[key] ?? 0) > 0);
}

export function compareFailureLabelSets(expected, observed) {
  const expectedSet = new Set(expected ?? []);
  const observedSet = new Set(observed ?? []);
  const missing = [...expectedSet].filter((label) => !observedSet.has(label));
  const unexpected = [...observedSet].filter((label) => !expectedSet.has(label));
  return {
    pass: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}

export function parseMingdiG700Export(html, qualityContract) {
  const fourLine = parseExportHtmlFourLine(html);
  const structureEvidence = deriveStructureEvidence(html, fourLine, qualityContract);
  const metrics = computeMingdiG700Metrics(structureEvidence, qualityContract);
  return {
    fourLine,
    structureEvidence,
    expectedFileContract: evaluateExpectedFiles(
      structureEvidence.deliverableRows,
      qualityContract,
    ),
    metrics,
    failureLabels: failureLabelsFromMetrics(metrics),
  };
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function assertMingdiG700ManifestMatches(manifest, actualExports) {
  const expectedCount = Number(manifest?.expectedCount);
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const actual = Array.isArray(actualExports) ? actualExports : [];

  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    throw new Error('manifest expectedCount 必须为正整数');
  }
  if (entries.length !== expectedCount) {
    throw new Error(`manifest 条目数应为 ${expectedCount}，实际 ${entries.length}`);
  }

  const duplicateManifestNames = duplicates(entries.map((entry) => entry.basename));
  const duplicateManifestIds = duplicates(entries.map((entry) => entry.id));
  const duplicateActualNames = duplicates(actual.map((entry) => entry.basename));
  if (duplicateManifestNames.length > 0 || duplicateManifestIds.length > 0) {
    throw new Error('manifest 存在重复 basename 或 id');
  }
  if (duplicateActualNames.length > 0) {
    throw new Error(`导出文件存在重复 basename：${duplicateActualNames.join('、')}`);
  }

  const actualByName = new Map(actual.map((entry) => [entry.basename, entry.sha256]));
  const expectedNames = new Set(entries.map((entry) => entry.basename));
  const missing = entries
    .filter((entry) => !actualByName.has(entry.basename))
    .map((entry) => entry.basename);
  if (missing.length > 0) {
    throw new Error(`导出文件缺失：${missing.join('、')}`);
  }

  const unexpected = actual
    .filter((entry) => !expectedNames.has(entry.basename))
    .map((entry) => entry.basename);
  if (unexpected.length > 0) {
    throw new Error(`存在 manifest 外导出文件：${unexpected.join('、')}`);
  }

  for (const entry of entries) {
    if (!/^[a-f0-9]{64}$/i.test(String(entry.sha256 ?? ''))) {
      throw new Error(`manifest SHA-256 格式错误：${entry.basename}`);
    }
    const actualHash = actualByName.get(entry.basename);
    if (String(actualHash).toLowerCase() !== String(entry.sha256).toLowerCase()) {
      throw new Error(`SHA-256 不一致：${entry.basename}`);
    }
  }

  if (actual.length !== expectedCount) {
    throw new Error(`导出文件数量应为 ${expectedCount}，实际 ${actual.length}`);
  }

  return {
    matchedCount: expectedCount,
    expectedCount,
  };
}
