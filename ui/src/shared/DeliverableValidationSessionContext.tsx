/**
 * PD-SAAS-FORK: session-level deliverable validation coordination — latest turn id,
 * ledger session key, hasMore for provisional latest (C2/C3), and SDM manifest (P1-2).
 */
import React, { createContext, useContext, useMemo } from 'react';
import type { ChatMessage } from '../components/chat/types/types';
import type { LatestDeliverableSummarySelection } from './selectLatestDeliverableSummaryTurn';
import { resolveValidationPolicyForMessage } from './selectLatestDeliverableSummaryTurn';
import {
  getCachedSessionManifest,
  invalidateSessionManifestCache,
} from './sessionDeliverableManifestStore';
import {
  resolveCurrentSessionManifest,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import { resolveSessionDeliverableContract } from './resolveSessionDeliverableContract';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import { collectDeliverablesFromMessages, collectDeliverablesFromMessagesInScope } from './collectDeliverables';
import { extractTurnAcceptanceMeta, resolveLatestTurnAcceptanceMeta, type SanitizedTurnAcceptanceMeta } from './turnAcceptanceMeta';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';
import { resolveContractScopeDir } from './resolveContractScopeDir';
import {
  type SessionDeliverablePipelineBundle,
  isSessionPipelineBundleEnabled,
} from './sessionDeliverablePipeline';

export type DeliverableValidationSessionValue = {
  sessionKey: string;
  latest: LatestDeliverableSummarySelection;
  policyForMessage: (messageId: string) => 'active' | 'frozen';
  /** Session-level SDM — same source as dock progress (MessagesPaneV2). */
  currentManifest?: SessionDeliverableManifestUi;
  expectedEntries?: ExpectedManifestEntry[];
  /** SDM slot path hints for active-table batch validate. */
  sdmSlotPaths: string[];
  /** Engine turn acceptance meta (skip redundant Bridge validate when passed). */
  latestAcceptanceMeta?: SanitizedTurnAcceptanceMeta | null;
};

const DeliverableValidationSessionContext = createContext<DeliverableValidationSessionValue | null>(null);

export function DeliverableValidationSessionProvider({
  sessionId,
  projectName,
  projectRoot = '',
  latest,
  chatMessages,
  pipelineBundle,
  children,
}: {
  sessionId: string | undefined;
  projectName: string | undefined;
  projectRoot?: string;
  latest: LatestDeliverableSummarySelection;
  chatMessages: ChatMessage[];
  /** PD-SAAS-FORK: when set, skips session-wide collect in provider. */
  pipelineBundle?: SessionDeliverablePipelineBundle | null;
  children: React.ReactNode;
}) {
  const value = useMemo((): DeliverableValidationSessionValue => {
    const sessionKey = sessionId && projectName ? `${sessionId}\0${projectName}` : '';
    if (pipelineBundle) {
      return {
        sessionKey,
        latest,
        policyForMessage: (messageId: string) => resolveValidationPolicyForMessage(messageId, latest),
        currentManifest: pipelineBundle.validationSession.currentManifest,
        expectedEntries: pipelineBundle.validationSession.expectedEntries,
        sdmSlotPaths: pipelineBundle.validationSession.sdmSlotPaths,
        latestAcceptanceMeta: pipelineBundle.validationSession.latestAcceptanceMeta,
      };
    }
    if (isSessionPipelineBundleEnabled()) {
      return {
        sessionKey,
        latest,
        policyForMessage: (messageId: string) => resolveValidationPolicyForMessage(messageId, latest),
        sdmSlotPaths: [],
        latestAcceptanceMeta: resolveLatestTurnAcceptanceMeta(chatMessages),
      };
    }
    const currentManifest = sessionId
      ? getCachedSessionManifest(sessionId, chatMessages)
      : resolveCurrentSessionManifest(chatMessages);
    const sessionTaskDirectory = resolveCurrentSessionTaskDirectory(chatMessages);
    const scopeDir = resolveContractScopeDir({
      messages: chatMessages,
      sessionTaskDirectory,
      pathHints: currentManifest?.slots?.map((slot) => slot.pathHint).filter(Boolean) as string[] | undefined,
    });
    const sessionDeliverables = projectRoot
      ? collectDeliverablesFromMessagesInScope(chatMessages, projectRoot, scopeDir)
      : [];
    const sessionVerifiedPaths: string[] = [];
    for (const message of chatMessages) {
      if (message.type !== 'assistant') continue;
      const meta = extractTurnAcceptanceMeta(message);
      for (const path of meta?.verifiedPaths ?? []) {
        if (typeof path === 'string' && path.trim()) sessionVerifiedPaths.push(path.trim());
      }
    }
    const contract = resolveSessionDeliverableContract({
      messages: chatMessages,
      sessionManifest: currentManifest,
      sessionDeliverables,
      sessionVerifiedPaths,
    });
    const expectedEntries = contract.expectedEntries.length > 0 ? contract.expectedEntries : undefined;
    const sdmSlotPaths = (currentManifest?.slots ?? [])
      .filter((slot) => slot.status !== 'removed' && typeof slot.pathHint === 'string' && slot.pathHint.trim())
      .map((slot) => slot.pathHint!.trim());
    const latestAcceptanceMeta = resolveLatestTurnAcceptanceMeta(chatMessages);
    return {
      sessionKey,
      latest,
      policyForMessage: (messageId: string) => resolveValidationPolicyForMessage(messageId, latest),
      currentManifest,
      expectedEntries,
      sdmSlotPaths,
      latestAcceptanceMeta,
    };
  }, [sessionId, projectName, projectRoot, latest, chatMessages, pipelineBundle]);

  return (
    <DeliverableValidationSessionContext.Provider value={value}>
      {children}
    </DeliverableValidationSessionContext.Provider>
  );
}

export function useDeliverableValidationSession(): DeliverableValidationSessionValue | null {
  return useContext(DeliverableValidationSessionContext);
}

export function useSessionDeliverableManifest(): SessionDeliverableManifestUi | undefined {
  return useDeliverableValidationSession()?.currentManifest;
}

export { invalidateSessionManifestCache };

export function useDeliverableValidationPolicy(messageId?: string): 'active' | 'frozen' {
  const ctx = useDeliverableValidationSession();
  if (!ctx?.sessionKey || !messageId) return 'active';
  return ctx.policyForMessage(messageId);
}
