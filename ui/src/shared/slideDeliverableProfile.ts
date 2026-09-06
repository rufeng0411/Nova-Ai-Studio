/** PD-SAAS-FORK: profiles where slide-manifest / PNG page rows are authoritative. */
export function isSlideDeliverableProfile(profileId: string | null | undefined): boolean {
  if (!profileId) return false;
  return profileId === 'ppt-master'
    || profileId === 'slides'
    || profileId === 'nova-slides';
}

/** Document / GEO / campaign profiles — never infer Nova slide pages from stray PNG paths. */
export function isDocumentDeliverableProfile(profileId: string | null | undefined): boolean {
  if (!profileId) return false;
  if (isSlideDeliverableProfile(profileId)) return false;
  return profileId === 'geo'
    || profileId === 'geo-standard-pack'
    || profileId.startsWith('geo-')
    || profileId === 'campaign'
    || profileId === 'marketing';
}
