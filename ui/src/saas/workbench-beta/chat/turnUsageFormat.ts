// PD-SAAS-FORK: format session token totals for turn footer

export function formatTokenCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(Math.round(n));
}
