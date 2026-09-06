import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeliverableItem } from './collectDeliverables';
import { normalizeHintDir } from '../../shared/deliverablePathResolve.mjs';
import {
  buildDeliverableValidationCacheKey,
  fetchDeliverableValidationCached,
  readCachedDeliverableValidation,
} from './deliverableValidationCache';
import {
  buildValidatedDeliverableSet,
  DELIVERABLE_VALIDATE_FETCH_TIMEOUT_MS,
  type ValidatedDeliverable,
  type ValidatedDeliverableSet,
} from './validateDeliverables';
import {
  mapDeliverableItemsFromEngineMeta,
} from './turnAcceptanceMeta';
import {
  buildLedgerSessionKey,
  commitLedgerFromValidated,
  getOrCreateLedger,
  partitionItemsByLedger,
} from './deliverableValidationLedger';
import {
  readTurnSnapshot,
  snapshotToValidatedItems,
  writeTurnSnapshot,
} from './turnDeliverableSnapshot';
import { useDeliverableValidationPolicy, useDeliverableValidationSession } from './DeliverableValidationSessionContext';
import { isDeliverableSettledAcceptanceAuthorityEnabled } from './perfFeatureFlags';
import { isAcceptancePassedForSettled } from './resolvePipelineValidationSettled';

// PD-SAAS-FORK: active-table validate debounce (SDM mode uses same coalesced batch path).
const ACTIVE_VALIDATE_DEBOUNCE_MS = 300;
// PD-SAAS-FORK: server-side open-validation for deliverables panel; bypass only for emergency rollback.
const BYPASS_DISPLAY_VALIDATION = import.meta.env.VITE_BYPASS_DELIVERABLE_VALIDATION === 'true';

/**
 * PD-SAAS-FORK fd7c166c: leave「校验中」quickly; fetch may still complete and upgrade rows.
 * Cap well below full Bridge timeout so OD/index.html does not stall the sticky bar.
 */
const VALIDATION_UI_SETTLE_MS = Math.min(4_000, DELIVERABLE_VALIDATE_FETCH_TIMEOUT_MS);

function softVerifyArtifactItems(items: DeliverableItem[]): ValidatedDeliverable[] {
  return items.map((item) => {
    const path = String(item.resolvedPath || item.apiPath || item.path || '');
    const underArtifacts = /(?:^|\/)artifacts\//i.test(path.replace(/\\/g, '/'));
    return {
      ...item,
      validationStatus: underArtifacts ? 'softVerified' as const : 'pending' as const,
      ...(underArtifacts && !item.resolvedPath ? { resolvedPath: path } : {}),
    };
  });
}

function deliverableItemsKey(items: DeliverableItem[]): string {
  return items
    .map((item) => `${item.id}|${item.apiPath || item.path}|${item.source}|${item.kind}`)
    .join('\n');
}

export function useValidatedDeliverableSet(
  projectName: string | undefined,
  items: DeliverableItem[],
  hintDir?: string,
  messageId?: string,
): ValidatedDeliverableSet {
  const validationSession = useDeliverableValidationSession();
  const validationPolicy = useDeliverableValidationPolicy(messageId);

  const bypassed = useMemo(
    () =>
      BYPASS_DISPLAY_VALIDATION
        ? buildValidatedDeliverableSet(
          items,
          items.map((item) => ({ ...item, validationStatus: 'pending' as const })),
        )
        : null,
    [items],
  );

  const itemsKey = useMemo(() => deliverableItemsKey(items), [items]);
  const hintDirKey = useMemo(() => normalizeHintDir(hintDir) ?? '', [hintDir]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const frozenSnapshot = useMemo(() => {
    if (validationPolicy !== 'frozen' || !validationSession?.sessionKey || !messageId) {
      return null;
    }
    const snap = readTurnSnapshot(validationSession.sessionKey, messageId);
    return snap ? snapshotToValidatedItems(snap) : null;
  }, [messageId, validationPolicy, validationSession?.sessionKey]);

  const [validated, setValidated] = useState<ValidatedDeliverable[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const generationRef = useRef(0);
  const prevLatestIdRef = useRef<string | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (validationPolicy === 'active') {
      wasActiveRef.current = true;
      return undefined;
    }
    if (
      wasActiveRef.current
      && validationSession?.sessionKey
      && messageId
      && hasValidated
      && validated.length > 0
    ) {
      writeTurnSnapshot(validationSession.sessionKey, messageId, validated);
      wasActiveRef.current = false;
    }
    return undefined;
  }, [validationPolicy, validationSession?.sessionKey, messageId, hasValidated, validated]);

  useEffect(() => {
    prevLatestIdRef.current = validationSession?.latest.messageId ?? null;
  }, [validationSession?.latest.messageId]);

  useEffect(() => {
    if (BYPASS_DISPLAY_VALIDATION) return undefined;

    if (validationPolicy === 'frozen') {
      if (frozenSnapshot) {
        setValidated(frozenSnapshot);
        setHasValidated(true);
        return undefined;
      }
      setValidated(itemsRef.current.map((item) => ({
        ...item,
        validationStatus: 'pending' as const,
      })));
      setHasValidated(true);
      return undefined;
    }

    const currentItems = itemsRef.current;
    if (!projectName || currentItems.length === 0) {
      setValidated([]);
      setHasValidated(true);
      return undefined;
    }

    if (
      isDeliverableSettledAcceptanceAuthorityEnabled()
      && isAcceptancePassedForSettled(validationSession?.latestAcceptanceMeta)
    ) {
      const engineMapped = validationSession?.latestAcceptanceMeta
        ? mapDeliverableItemsFromEngineMeta(currentItems, validationSession.latestAcceptanceMeta)
        : currentItems.map((item) => ({ ...item, validationStatus: 'verified' as const }));
      setValidated(engineMapped as ValidatedDeliverable[]);
      setHasValidated(true);
      return undefined;
    }

    const sessionKey = validationSession?.sessionKey
      ?? (messageId ? buildLedgerSessionKey(messageId, projectName) : projectName);
    const ledger = getOrCreateLedger(sessionKey);
    const { ledgerDelivered, ledgerIncomplete, needsValidate } = partitionItemsByLedger(
      ledger,
      currentItems,
      hintDirKey || undefined,
    );

    if (needsValidate.length === 0) {
      const merged = [...ledgerDelivered, ...ledgerIncomplete];
      setValidated(merged);
      setHasValidated(true);
      return undefined;
    }

    const engineMapped = validationSession?.latestAcceptanceMeta
      ? mapDeliverableItemsFromEngineMeta(needsValidate, validationSession.latestAcceptanceMeta)
      : null;
    if (engineMapped) {
      commitLedgerFromValidated(ledger, engineMapped as ValidatedDeliverable[], hintDirKey || undefined);
      setValidated([...ledgerDelivered, ...ledgerIncomplete, ...engineMapped as ValidatedDeliverable[]]);
      setHasValidated(true);
      return undefined;
    }

    const cacheKey = buildDeliverableValidationCacheKey(projectName, needsValidate, hintDirKey || undefined);
    const cached = readCachedDeliverableValidation(cacheKey);
    if (cached) {
      commitLedgerFromValidated(ledger, cached, hintDirKey || undefined);
      const merged = [
        ...ledgerDelivered,
        ...ledgerIncomplete,
        ...cached,
      ];
      setValidated(merged);
      setHasValidated(true);
      return undefined;
    }

    const generation = ++generationRef.current;
    let cancelled = false;
    setHasValidated(false);
    setValidated([...ledgerDelivered, ...ledgerIncomplete, ...needsValidate.map((item) => ({
      ...item,
      validationStatus: 'pending' as const,
    }))]);

    const settleTimer = window.setTimeout(() => {
      if (!cancelled && generationRef.current === generation) {
        // Optimistic settle: artifact paths soft-verify so sticky leaves「校验中」.
        setValidated((prev) => {
          const stillPending = prev.length === 0
            || prev.some((row) => row.validationStatus === 'pending');
          if (!stillPending) return prev;
          return [
            ...ledgerDelivered,
            ...ledgerIncomplete,
            ...softVerifyArtifactItems(needsValidate),
          ];
        });
        setHasValidated(true);
      }
    }, VALIDATION_UI_SETTLE_MS);

    const runFetch = () => {
      void fetchDeliverableValidationCached(projectName, needsValidate, hintDirKey || undefined)
        .then((result) => {
          if (cancelled || generationRef.current !== generation) return;
          commitLedgerFromValidated(ledger, result, hintDirKey || undefined);
          setValidated([...ledgerDelivered, ...ledgerIncomplete, ...result]);
          setHasValidated(true);
        })
        .catch(() => {
          if (cancelled || generationRef.current !== generation) return;
          setValidated([
            ...ledgerDelivered,
            ...ledgerIncomplete,
            ...softVerifyArtifactItems(needsValidate),
          ]);
          setHasValidated(true);
        })
        .finally(() => {
          if (generationRef.current === generation) {
            window.clearTimeout(settleTimer);
          }
        });
    };

    const debounceMs = validationSession?.sdmSlotPaths?.length ? ACTIVE_VALIDATE_DEBOUNCE_MS : 0;
    const debounceTimer = debounceMs > 0 ? window.setTimeout(runFetch, debounceMs) : null;
    if (!debounceTimer) {
      runFetch();
    }

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (generationRef.current === generation) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [
    projectName,
    itemsKey,
    hintDirKey,
    validationPolicy,
    frozenSnapshot,
    validationSession?.sessionKey,
    validationSession?.sdmSlotPaths?.length,
    validationSession?.latestAcceptanceMeta?.acceptanceStatus,
    validationSession?.latestAcceptanceMeta?.circuitBreakerTripped,
    validationSession?.latestAcceptanceMeta?.verifiedPaths?.length,
    messageId,
  ]);

  if (bypassed) {
    return { ...bypassed, validationSettled: true };
  }
  if (validationPolicy === 'frozen') {
    const display = frozenSnapshot ?? validated;
    return {
      ...buildValidatedDeliverableSet(items, display.length > 0 ? display : items.map((item) => ({
        ...item,
        validationStatus: 'pending' as const,
      }))),
      validationSettled: true,
    };
  }
  if (hasValidated) {
    return { ...buildValidatedDeliverableSet(items, validated), validationSettled: true };
  }
  return {
    ...buildValidatedDeliverableSet(
      items,
      validated.length > 0 ? validated : items.map((item) => ({ ...item, validationStatus: 'pending' as const })),
    ),
    validationSettled: false,
  };
}

export function useValidatedDeliverables(
  projectName: string | undefined,
  items: DeliverableItem[],
  hintDir?: string,
  messageId?: string,
): ValidatedDeliverable[] {
  return useValidatedDeliverableSet(projectName, items, hintDir, messageId).displayItems;
}
