// PD-SAAS-FORK: temporary theme-color while Beta shell mounted

let previousThemeColor: string | null = null;

export function applyBetaPwaMeta(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (previousThemeColor == null) previousThemeColor = meta.content || '';
  meta.content = isDark ? '#1c1824' : '#f5f2f8';
}

export function restoreBetaPwaMeta(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (meta && previousThemeColor != null) {
    meta.content = previousThemeColor;
  }
  previousThemeColor = null;
}
