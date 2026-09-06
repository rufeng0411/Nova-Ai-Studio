/**
 * PD-SAAS-FORK: In SaaS mode only platform admins may mutate PilotDeck config.
 */
import { isSaasMode } from '../mode.js';
import { requireAdmin } from './requireAdmin.js';

export function requireSaasConfigWrite(req, res, next) {
  if (!isSaasMode()) {
    return next();
  }
  return requireAdmin(req, res, next);
}
