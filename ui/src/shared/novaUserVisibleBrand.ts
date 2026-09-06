/** PD-SAAS-FORK: user-visible surfaces must say NovaStudio, never PilotDeck. */
export function replaceUserVisiblePilotDeckBrand(text: string): string {
  return String(text ?? '')
    .replace(/\[PilotDeck\]/gi, '[NovaStudio]')
    .replace(/\bPilotDeck\b/g, 'NovaStudio');
}