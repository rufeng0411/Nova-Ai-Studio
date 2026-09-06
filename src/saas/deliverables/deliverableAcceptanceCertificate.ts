// PD-SAAS-FORK:终验收证书 — 合同、磁盘事实与展示层的唯一绑定权威

import type { SessionDeliverableManifest, SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";
import type { CompositeSlotQualityAssessment } from "./compositeSlotQuality.js";
import type {
  AssetProvenanceSummary,
} from "../final-acceptance/deliverableQualityPipeline.js";
import type {
  DeliverableQualityCompletion,
  DeliverableQualityFailure,
} from "../final-acceptance/deliverableQualityChecks.js";

import {

  findBestVerifiedPathForSlot,

  normalizeSdmPath,

  pathSatisfiesSdmSlot,

  sdmBasename,

  slotSatisfiedByValidation,

} from "./sdmSlotMatching.js";

import { isRealArtifactDeliverablePath } from "../taskState/sessionDeliverableManifest.js";

import {

  contractAuthorityV2Mode,

  contentQualityV2Mode,

  deliverableCertificateV2Mode,

  officialMediaV2Mode,

  visualBindingAuditMode,

} from "../resilience/stabilityFlags.js";

import {

  bindContractUnitsStrict,

  computeStableContractHashV2,

  type ContractBindingResult,

  type ContractSlotBindingSummary,

  type ContractUnit,

} from "./deliverableContractBinding.js";



export type CompletionState =

  | "complete"

  | "accepted_partial"

  | "incomplete"

  | "blocked";



export type CertificateSlotStatus = "pending" | "done" | "missing" | "broken";



export type CertificateSlotEvidence = {

  resolvedPath?: string;

  source: "engine" | "disk" | "reconcile";

};



export type CertificateSlotRow = {

  slotId: string;

  label: string;

  required: boolean;

  status: CertificateSlotStatus;

  resolvedPath?: string;

  evidence?: CertificateSlotEvidence;

  qualityFailures?: string[];

};



export type CertificateSlotRowV2 = CertificateSlotRow & {

  requiredCount: number;

  matchedCount: number;

  resolvedPaths: string[];

};



export type DeliverableAcceptanceCertificateV1 = {

  certificateVersion: 1;

  contractHash: string;

  evidenceHash: string;

  goalVersion: number;

  scopeDir: string | null;

  requiredDone: number;

  requiredTotal: number;

  completionState: CompletionState;

  acceptanceStatus: "passed" | "needs_repair" | "user_action_required" | "not_applicable" | "failed";

  continuationOwner?: string;

  slots: CertificateSlotRow[];

  optionalDerived?: CertificateSlotRow[];

  /** PD-SAAS-FORK (0717 P1): optional bounded composite quality audit. */
  compositeSlotQuality?: CompositeSlotQualityAssessment[];

};



export type DeliverableAcceptanceCertificateV2 = Omit<DeliverableAcceptanceCertificateV1, "certificateVersion" | "slots"> & {

  certificateVersion: 2;

  contractHashVersion: 2;

  contractHash: string;

  legacyContractHash: string;

  legacyAcceptanceStatus: DeliverableAcceptanceCertificateV1["acceptanceStatus"];

  strictAcceptanceStatus: DeliverableAcceptanceCertificateV1["acceptanceStatus"];

  units: ContractUnit[];

  strictBinding: ContractBindingResult;

  slots: CertificateSlotRowV2[];

  /** PD-SAAS-FORK P0-7: independent quality contract/evidence namespace. */
  qualityContractHashVersion?: 1;

  qualityContractHash?: string;

  qualityEvidenceHashVersion?: 1;

  qualityEvidenceHash?: string;

  qualityCompletion?: DeliverableQualityCompletion;

  partialReason?: "user_acknowledged" | "official_media_degraded";

  blockedReasonType?: "user_action_required" | "system_exhausted";

  qualityFailures?: DeliverableQualityFailure[];

  assetProvenanceSummary?: AssetProvenanceSummary;

};



export type DeliverableAcceptanceCertificate =

  | DeliverableAcceptanceCertificateV1

  | DeliverableAcceptanceCertificateV2;



export function isAcceptanceCertificateV2(

  certificate: DeliverableAcceptanceCertificate | null | undefined,

): certificate is DeliverableAcceptanceCertificateV2 {

  return certificate?.certificateVersion === 2;

}



export function computeStableContractHash(manifest: SessionDeliverableManifest | undefined): string {

  if (!manifest) return "0";

  const payload = manifest.slots

    .filter((slot) => slot.status !== "removed")

    .map((slot) => [

      slot.id,

      slot.kind ?? "",

      slot.required === false ? "0" : "1",

      slot.pathHint ?? "",

      ...(slot.pathHints ?? []),

      manifest.goalVersion,

    ].join("|"))

    .join(";");

  let hash = 5381;

  for (let i = 0; i < payload.length; i += 1) {

    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);

  }

  return (hash >>> 0).toString(16);

}



export { computeStableContractHashV2 } from "./deliverableContractBinding.js";



export function computeEvidenceHash(

  slots: CertificateSlotRow[],

  strictBinding?: ContractBindingResult,

): string {

  const slotPayload = slots

    .map((row) => {

      const resolvedPaths = "resolvedPaths" in row && Array.isArray(row.resolvedPaths)

        ? row.resolvedPaths

        : row.resolvedPath

          ? [row.resolvedPath]

          : [];

      const uniqueResolvedPaths = [...new Set(

        resolvedPaths.map((path) => normalizeSdmPath(path)).filter(Boolean),

      )].sort();

      const requiredCount = "requiredCount" in row ? row.requiredCount : 1;

      const matchedCount = "matchedCount" in row ? row.matchedCount : uniqueResolvedPaths.length;

      return [

        row.slotId,

        row.status,

        String(requiredCount),

        String(matchedCount),

        uniqueResolvedPaths.join(","),

      ].join("|");

    })

    .sort();

  const bindingByUnit = new Map(

    (strictBinding?.bindings ?? []).map((binding) => [binding.unitId, binding]),

  );

  const unitPayload = (strictBinding?.units ?? [])

    .map((unit) => {

      const binding = bindingByUnit.get(unit.unitId);

      return [

        unit.unitId,

        unit.slotId,

        normalizeSdmPath(unit.expectedPath),

        binding?.matched ? "1" : "0",

        normalizeSdmPath(binding?.evidencePath ?? ""),

        binding?.matchTier ?? "",

      ].join("|");

    })

    .sort();

  const allResolvedPaths = [...new Set([

    ...slots.flatMap((row) => (

      "resolvedPaths" in row && Array.isArray(row.resolvedPaths)

        ? row.resolvedPaths

        : row.resolvedPath

          ? [row.resolvedPath]

          : []

    )),

    ...(strictBinding?.bindings ?? [])

      .map((binding) => binding.evidencePath)

      .filter((path): path is string => Boolean(path)),

  ].map((path) => normalizeSdmPath(path)).filter(Boolean))].sort();

  const payload = [

    `slots:${slotPayload.join(";")}`,

    `units:${unitPayload.join(";")}`,

    `paths:${allResolvedPaths.join(";")}`,

  ].join("||");

  let hash = 5381;

  for (let i = 0; i < payload.length; i += 1) {

    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);

  }

  return (hash >>> 0).toString(16);

}



function activeRequiredSlots(manifest: SessionDeliverableManifest): SessionDeliverableSlot[] {

  return manifest.slots.filter((slot) => slot.status !== "removed" && slot.required !== false);

}



function bindSlotOneToOne(

  slot: SessionDeliverableSlot,

  verifiedPaths: string[],

  usedPaths: Set<string>,

  preferredScopeDir?: string | null,

): CertificateSlotRow {

  const candidates = verifiedPaths

    .map((p) => normalizeSdmPath(p))

    .filter(Boolean)

    .filter((p) => !usedPaths.has(p.toLowerCase()));



  let resolved: string | undefined;

  const best = findBestVerifiedPathForSlot(slot, candidates, usedPaths, preferredScopeDir);

  if (best) {

    resolved = best;

    usedPaths.add(best.toLowerCase());

  } else if (slot.resolvedPath) {

    const norm = normalizeSdmPath(slot.resolvedPath);

    if (norm && !usedPaths.has(norm.toLowerCase())) {

      resolved = norm;

      usedPaths.add(norm.toLowerCase());

    }

  }



  const satisfied = resolved

    ? pathSatisfiesSdmSlot(resolved, slot)

    : slotSatisfiedByValidation(slot, verifiedPaths);



  let status: CertificateSlotStatus = "pending";

  if (resolved && satisfied) status = "done";

  else if (slot.status === "done" && resolved) status = "done";

  else if (!satisfied && verifiedPaths.length > 0) status = "missing";



  return {

    slotId: slot.id,

    label: slot.label,

    required: slot.required !== false,

    status,

    resolvedPath: resolved,

    evidence: resolved ? { resolvedPath: resolved, source: "engine" } : undefined,

  };

}



function deriveStrictAcceptanceStatus(

  binding: ContractBindingResult,

  input: BuildCertificateInput,

): DeliverableAcceptanceCertificateV1["acceptanceStatus"] {

  if (input.finalizedByAcceptancePipeline && input.acceptanceStatus) {

    return input.acceptanceStatus;

  }

  if (input.blockedReason || input.acceptanceStatus === "user_action_required") {

    return "user_action_required";

  }

  if (binding.incompleteReason?.startsWith("contract_unit_budget_exceeded")

    || binding.incompleteReason?.startsWith("evidence_budget_exceeded")) {

    return "failed";

  }

  if (binding.complete) return "passed";

  return "needs_repair";

}



function mergeStrictSlotRows(

  legacyRows: CertificateSlotRow[],

  summaries: ContractSlotBindingSummary[],

): CertificateSlotRowV2[] {

  const summaryById = new Map(summaries.map((summary) => [summary.slotId, summary]));

  return legacyRows.map((row) => {

    const summary = summaryById.get(row.slotId);

    const requiredCount = summary?.requiredCount ?? 1;

    const matchedCount = summary?.matchedCount ?? (row.status === "done" ? 1 : 0);

    const resolvedPaths = summary?.resolvedPaths.length

      ? summary.resolvedPaths

      : row.resolvedPath

        ? [row.resolvedPath]

        : [];

    const status: CertificateSlotStatus = matchedCount >= requiredCount

      ? "done"

      : matchedCount > 0

        ? "pending"

        : row.status;

    return {

      ...row,

      status,

      requiredCount,

      matchedCount,

      resolvedPaths,

      resolvedPath: resolvedPaths[0] ?? row.resolvedPath,

      evidence: resolvedPaths[0]

        ? { resolvedPath: resolvedPaths[0], source: "engine" as const }

        : row.evidence,

    };

  });

}



function buildLegacyAcceptanceCertificate(

  input: BuildCertificateInput,

): DeliverableAcceptanceCertificateV1 | null {

  const manifest = input.manifest;

  if (!manifest) return null;



  const verified = [...new Set((input.verifiedPaths ?? []).map(normalizeSdmPath).filter(Boolean))];

  const usedPaths = new Set<string>();

  const requiredSlots = activeRequiredSlots(manifest);

  const slotRows = requiredSlots.map((slot) => bindSlotOneToOne(
    slot,
    verified,
    usedPaths,
    manifest.taskArtifactDir,
  ));



  const optionalDerived: CertificateSlotRow[] = [];

  for (const raw of verified) {

    const path = normalizeSdmPath(raw);

    if (!path || !isRealArtifactDeliverablePath(path) || usedPaths.has(path.toLowerCase())) continue;

    const matchedRequired = requiredSlots.some((slot) => pathSatisfiesSdmSlot(path, slot));

    if (matchedRequired) continue;

    optionalDerived.push({

      slotId: `optional_${sdmBasename(path).replace(/[^a-z0-9]+/gi, "_")}`,

      label: sdmBasename(path),

      required: false,

      status: "done",

      resolvedPath: path,

      evidence: { resolvedPath: path, source: "disk" },

    });

    usedPaths.add(path.toLowerCase());

  }



  const requiredTotal = requiredSlots.length;

  const requiredDone = slotRows.filter((row) => row.status === "done").length;

  const contractHash = computeStableContractHash(manifest);

  const evidenceHash = computeEvidenceHash(slotRows);



  let completionState: CompletionState = "incomplete";

  if (input.blockedReason || input.acceptanceStatus === "user_action_required") {

    completionState = "blocked";

  } else if (requiredTotal > 0 && requiredDone === requiredTotal) {

    completionState = "complete";

  } else if (input.userAcknowledgedPartial && requiredDone > 0) {

    completionState = "accepted_partial";

  }



  const acceptanceStatus = input.acceptanceStatus

    ?? (completionState === "complete" ? "passed" : "needs_repair");



  if (
    acceptanceStatus === "passed"
    && requiredDone < requiredTotal
    && !input.userAcknowledgedPartial
  ) {

    throw new Error(

      `Certificate invariant violated: passed with ${requiredDone}/${requiredTotal} done`,

    );

  }



  return {

    certificateVersion: 1,

    contractHash,

    evidenceHash,

    goalVersion: manifest.goalVersion,

    scopeDir: input.scopeDir ?? manifest.taskArtifactDir ?? null,

    requiredDone,

    requiredTotal,

    completionState,

    acceptanceStatus,

    continuationOwner: input.continuationOwner,

    slots: slotRows,

    ...(optionalDerived.length > 0 ? { optionalDerived } : {}),

  };

}



export type BuildCertificateInput = {

  manifest?: SessionDeliverableManifest;

  scopeDir?: string | null;

  verifiedPaths?: string[];

  diskPaths?: string[];

  missingPaths?: string[];

  brokenPaths?: string[];

  acceptanceStatus?: DeliverableAcceptanceCertificate["acceptanceStatus"];

  continuationOwner?: string;

  userAcknowledgedPartial?: boolean;

  blockedReason?: string;

  /** PD-SAAS-FORK P0-7: values are resolved once by the finalizer, never rebuilt here. */
  completionStateOverride?: CompletionState;

  finalizedByAcceptancePipeline?: boolean;

  qualityContractHash?: string;

  qualityEvidenceHash?: string;

  qualityCompletion?: DeliverableQualityCompletion;

  partialReason?: DeliverableAcceptanceCertificateV2["partialReason"];

  blockedReasonType?: DeliverableAcceptanceCertificateV2["blockedReasonType"];

  qualityFailures?: DeliverableQualityFailure[];

  assetProvenanceSummary?: AssetProvenanceSummary;

  strictBinding?: ContractBindingResult;

  bindingAudit?: import("../media/visualAssetPlatform/deliverableVisualBindingAudit.js").VisualBindingAuditResult | null;

};



export function buildDeliverableAcceptanceCertificate(

  input: BuildCertificateInput,

): DeliverableAcceptanceCertificate | null {

  const legacy = buildLegacyAcceptanceCertificate(input);

  if (!legacy || !input.manifest) return legacy;



  const useStrictBinding = contractAuthorityV2Mode() !== "off"

    || deliverableCertificateV2Mode() !== "off"

    || contentQualityV2Mode() !== "off"

    || officialMediaV2Mode() !== "off";

  if (!useStrictBinding) return legacy;



  const strictBinding = input.strictBinding ?? bindContractUnitsStrict({

    manifest: input.manifest,

    verifiedPaths: input.verifiedPaths,

    diskPaths: input.diskPaths,

    scopeDir: input.scopeDir ?? input.manifest.taskArtifactDir ?? null,

  });

  const strictAcceptanceStatus = deriveStrictAcceptanceStatus(strictBinding, input);

  const strictSlots = mergeStrictSlotRows(legacy.slots, strictBinding.slotSummaries);

  const strictRequiredDone = strictBinding.matchedCount;

  const strictRequiredTotal = strictBinding.requiredCount;

  const strictCompletionState: CompletionState = input.completionStateOverride

    ?? (strictBinding.complete

    && !(visualBindingAuditMode() === "enforce"

      && input.bindingAudit

      && !input.bindingAudit.passed)

    ? "complete"

    : input.blockedReason || input.acceptanceStatus === "user_action_required"

      ? "blocked"

      : input.userAcknowledgedPartial && strictBinding.matchedCount > 0

        ? "accepted_partial"

        : "incomplete");



  const certificate: DeliverableAcceptanceCertificateV2 = {

    ...legacy,

    certificateVersion: 2,

    contractHashVersion: 2,

    contractHash: computeStableContractHashV2(

      input.manifest,

      input.scopeDir ?? input.manifest.taskArtifactDir ?? null,

    ),

    legacyContractHash: legacy.contractHash,

    legacyAcceptanceStatus: legacy.acceptanceStatus,

    strictAcceptanceStatus,

    requiredDone: strictRequiredDone,

    requiredTotal: strictRequiredTotal,

    completionState: strictCompletionState,

    acceptanceStatus: contractAuthorityV2Mode() === "enforce"

      ? strictAcceptanceStatus

      : legacy.acceptanceStatus,

    units: strictBinding.units,

    strictBinding,

    slots: strictSlots,

    evidenceHash: computeEvidenceHash(strictSlots, strictBinding),

    ...(input.qualityContractHash

      ? {

          qualityContractHashVersion: 1,

          qualityContractHash: input.qualityContractHash,

        }

      : {}),

    ...(input.qualityEvidenceHash

      ? {

          qualityEvidenceHashVersion: 1,

          qualityEvidenceHash: input.qualityEvidenceHash,

        }

      : {}),

    ...(input.qualityCompletion

      ? { qualityCompletion: input.qualityCompletion }

      : {}),

    ...(input.partialReason ? { partialReason: input.partialReason } : {}),

    ...(input.blockedReasonType

      ? { blockedReasonType: input.blockedReasonType }

      : {}),

    ...(input.qualityFailures

      ? { qualityFailures: input.qualityFailures }

      : {}),

    ...(input.assetProvenanceSummary

      ? { assetProvenanceSummary: input.assetProvenanceSummary }

      : {}),

  };



  if (
    certificate.acceptanceStatus === "passed"
    && strictRequiredDone < strictRequiredTotal
    && !input.userAcknowledgedPartial
  ) {

    throw new Error(

      `Certificate invariant violated: passed with ${strictRequiredDone}/${strictRequiredTotal} bound units`,

    );

  }



  return certificate;

}



export function isDeliverableCertificateV2Enabled(): boolean {

  return deliverableCertificateV2Mode() !== "off";

}



export function isCertificateEnforced(): boolean {

  return deliverableCertificateV2Mode() === "enforce"

    || contractAuthorityV2Mode() === "enforce";

}



export function tryBuildAcceptanceCertificateForTurn(

  input: BuildCertificateInput,

): DeliverableAcceptanceCertificate | undefined {

  if (

    !isDeliverableCertificateV2Enabled()

    && contractAuthorityV2Mode() === "off"

    && contentQualityV2Mode() === "off"

    && officialMediaV2Mode() === "off"

  ) {

    return undefined;

  }

  try {

    return buildDeliverableAcceptanceCertificate(input) ?? undefined;

  } catch {

    return undefined;

  }

}


