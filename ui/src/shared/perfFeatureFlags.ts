/** PD-SAAS-FORK: perf optimization feature flags — default ON; set env to `0` to rollback. */
import { getRuntimeFeatureFlags } from './runtimeFeatureFlags';

function envEnabled(key: string, defaultOn = true): boolean {
  const raw = import.meta.env[key];
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return defaultOn;
}

/** PD-SAAS-FORK: runtime Bridge env 优先，未拉取时回退 Vite 构建值 */
function runtimeOrVite(
  runtimeValue: boolean | undefined,
  viteKey: string,
  defaultOn: boolean,
): boolean {
  const runtime = getRuntimeFeatureFlags();
  if (runtime) return runtimeValue ?? false;
  return envEnabled(viteKey, defaultOn);
}

function envNumber(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** A1: historical MessageRowV2 rows skip full sessionMessages — parent passes sessionUserGoalText. */
export function isMessageRowSessionScopeEnabled(): boolean {
  return envEnabled('VITE_MESSAGE_ROW_SESSION_SCOPE');
}

/** A2: defer deliverables pipeline / validate while assistant is working. */
export function isDeferDeliverablesWhileStreamingEnabled(): boolean {
  return envEnabled('VITE_DEFER_DELIVERABLES_WHILE_STREAMING');
}

/** A3: incremental processGrouping cache for stable turns. */
export function isProcessGroupingIncrementalEnabled(): boolean {
  return envEnabled('VITE_PROCESS_GROUPING_INCREMENTAL');
}

/** A3: virtualize message list when count exceeds threshold (default 80). */
export function messageVirtualizationThreshold(): number {
  return Math.max(20, envNumber('VITE_MESSAGE_VIRTUALIZATION_THRESHOLD', 80));
}

/** Track B: audience-aware process step detail + non-technical detailed gate. */
export function isProcessStepDetailV2Enabled(): boolean {
  return envEnabled('VITE_PROCESS_STEP_DETAIL_V2');
}

/** PD-SAAS-FORK ES9: acceptance passed may settle UI/export without disk snapshot complete. */
export function isDeliverableSettledAcceptanceAuthorityEnabled(): boolean {
  return runtimeOrVite(
    getRuntimeFeatureFlags()?.deliverableSettledAcceptanceAuthority,
    'VITE_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY',
    true,
  );
}

/** PD-SAAS-FORK: certificate enforce mode — require complete v2 cert even when passed. */
export function isDeliverableCertificateEnforceEnabled(): boolean {
  return envEnabled('VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_ENFORCE', false);
}

/** PD-SAAS-FORK: 终验收证书 UI — 只消费证书，禁止正文猜路径标绿 */
export function isDeliverableCertificateUiEnabled(): boolean {
  return runtimeOrVite(
    getRuntimeFeatureFlags()?.deliverableCertificateUi,
    'VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI',
    false,
  );
}

/** PD-SAAS-FORK: 导出一致性快照与用户/诊断双模式 */
export function isExportSnapshotV2Enabled(): boolean {
  return runtimeOrVite(
    getRuntimeFeatureFlags()?.exportSnapshotV2,
    'VITE_EXPORT_SNAPSHOT_V2',
    false,
  );
}

export function isExportUserAuditModesEnabled(): boolean {
  return runtimeOrVite(
    getRuntimeFeatureFlags()?.exportUserAuditModes,
    'VITE_EXPORT_USER_AUDIT_MODES',
    false,
  );
}

/** PD-SAAS-FORK: cold session switch uses inline pulse instead of full-screen loading. */
export function isRequireValidationSettledForExportEnabled(): boolean {
  return envEnabled('VITE_REQUIRE_VALIDATION_SETTLED', true);
}

/** PD-SAAS-FORK: tier-0 SDM basename fuzzy match (brief ↔ research-brief). */
export function isSdmFuzzyPathHintEnabled(): boolean {
  return envEnabled('VITE_SDM_FUZZY_PATHHINT', true);
}

/** PD-SAAS-FORK ES9 P0-E: show deliverable slot basename (i/N) in process timeline. */
export function isDeliverableSlotProcessUxEnabled(): boolean {
  return envEnabled('VITE_DELIVERABLE_SLOT_PROCESS_UX', true);
}

/** PD-SAAS-FORK P0-D: unified user-facing deliverable status copy. */
export function isDeliverableTrustCopyV2Enabled(): boolean {
  return runtimeOrVite(
    getRuntimeFeatureFlags()?.deliverableTrustCopyV2,
    'VITE_DELIVERABLE_TRUST_COPY_V2',
    true,
  );
}

/** PD-SAAS-FORK P0-C′: folder enrich may not promote rows without engine verified paths. */
export function isUiStrictCompletionGateEnabled(): boolean {
  return runtimeOrVite(
    getRuntimeFeatureFlags()?.uiStrictCompletionGate,
    'VITE_PILOTDECK_UI_STRICT_COMPLETION_GATE',
    true,
  );
}
export function isSessionSwitchInlineLoadingEnabled(): boolean {
  return envEnabled('VITE_SESSION_SWITCH_INLINE_LOADING', true);
}

/** PD-SAAS-FORK: 媒体 Tab（8 Tab 架构）；VITE_HUB_MEDIA_TAB=0 回滚 */
export function isHubMediaTabEnabled(): boolean {
  return envEnabled('VITE_HUB_MEDIA_TAB', true);
}

/**
 * PD-SAAS-FORK: 企业合规 Tab — off|shadow|enforce（shadow/enforce 均出现在导航序，用户可见性另受 hub-visibility）
 * VITE_HUB_ENTERPRISE_COMPLIANCE_TAB=off|0 关闭；默认 shadow
 */
export function getHubEnterpriseComplianceTabMode(): 'off' | 'shadow' | 'enforce' {
  const raw = String(import.meta.env?.VITE_HUB_ENTERPRISE_COMPLIANCE_TAB ?? 'shadow')
    .trim()
    .toLowerCase();
  if (raw === 'off' || raw === '0' || raw === 'false') return 'off';
  if (raw === 'enforce' || raw === '1' || raw === 'true' || raw === 'on') return 'enforce';
  return 'shadow';
}

export function isHubEnterpriseComplianceTabEnabled(): boolean {
  return getHubEnterpriseComplianceTabMode() !== 'off';
}

/** PD-SAAS-FORK: restore scroll position when returning to a previously viewed session. */
export function isSessionScrollRestoreEnabled(): boolean {
  return envEnabled('VITE_SESSION_SCROLL_RESTORE', true);
}
