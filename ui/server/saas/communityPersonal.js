/** N2 community overlay: single-admin personal SaaS. */
export function isCommunityPersonal(env = process.env) {
  const v = String(env.PILOTDECK_COMMUNITY_PERSONAL || '').trim().toLowerCase();
  return v === '1' || v === 'true';
}
