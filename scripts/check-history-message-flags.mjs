#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Print history message acceleration flag state.
 * Run via: npx tsx scripts/check-history-message-flags.mjs
 */
import { isHistorySanitizeEnabled, isHistoryTailReadEnabled, isHistoryMessageCacheEnabled } from '../src/web/server/historyReadFlags.ts';

console.log('PILOTDECK_HISTORY_SANITIZE effective:', isHistorySanitizeEnabled() ? '1' : '0');
console.log('PILOTDECK_HISTORY_TAIL_READ effective:', isHistoryTailReadEnabled() ? '1' : '0');
console.log('PILOTDECK_HISTORY_MESSAGE_CACHE effective:', isHistoryMessageCacheEnabled() ? '1' : '0');
