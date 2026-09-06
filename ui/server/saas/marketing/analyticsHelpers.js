// PD-SAAS-FORK: marketing analytics pure helpers (referrer / UA / channel)

/**
 * Normalize referrer URL to host (or special buckets).
 * @param {string | null | undefined} referrer
 */
export function normalizeReferrerHost(referrer) {
  const raw = String(referrer || '').trim();
  if (!raw) return '(直接访问)';
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    let host = (u.hostname || '').toLowerCase().replace(/^www\./, '');
    if (!host) return '(未知来源)';
    return host.slice(0, 120);
  } catch {
    return '(未知来源)';
  }
}

/**
 * @param {string | null | undefined} ua
 * @returns {'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'}
 */
export function classifyDevice(ua) {
  const s = String(ua || '').toLowerCase();
  if (!s) return 'unknown';
  if (
    /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless/i.test(s)
  ) {
    return 'bot';
  }
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(s)) {
    return 'tablet';
  }
  if (/mobi|iphone|ipod|android.*mobile|windows phone|opera mini/i.test(s)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * @param {string | null | undefined} ua
 * @returns {string}
 */
export function classifyBrowser(ua) {
  const s = String(ua || '');
  if (!s) return '未知';
  if (/Edg\//i.test(s)) return 'Edge';
  if (/OPR\/|Opera/i.test(s)) return 'Opera';
  if (/Firefox\//i.test(s)) return 'Firefox';
  if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) return 'Chrome';
  if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) return 'Safari';
  if (/MSIE |Trident\//i.test(s)) return 'IE';
  return '其他';
}

/**
 * Channel taxonomy for source attribution.
 * @param {{ utmSource?: string|null, utmMedium?: string|null, referrer?: string|null }} row
 */
export function classifyChannel(row) {
  const source = String(row?.utmSource || '').trim().toLowerCase();
  const medium = String(row?.utmMedium || '').trim().toLowerCase();
  if (source || medium) {
    if (/cpc|ppc|paid|paidsearch|display|retarget/.test(medium) || medium === 'ad') {
      return '付费投放';
    }
    if (/email|e-mail|newsletter/.test(medium) || /email/.test(source)) {
      return '邮件';
    }
    if (/social|wechat|weibo|linkedin|twitter|x|facebook|instagram|tiktok|xiaohongshu/.test(medium)
      || /social|wechat|weibo|linkedin|twitter|facebook|xiaohongshu/.test(source)) {
      return '社媒';
    }
    if (/organic|seo/.test(medium)) return '自然搜索(UTM)';
    if (medium === 'referral') return '推荐(UTM)';
    return '活动/UTM';
  }
  const host = normalizeReferrerHost(row?.referrer);
  if (host === '(直接访问)') return '直接访问';
  if (
    /google\.|bing\.|baidu\.|sogou\.|so\.com|yahoo\.|duckduckgo\.|yandex\./.test(host)
  ) {
    return '自然搜索';
  }
  if (
    /weixin\.|mp\.weixin|zhihu\.|xiaohongshu\.|douyin\.|linkedin\.|twitter\.|x\.com|facebook\.|instagram\.|t\.co|reddit\./.test(
      host,
    )
  ) {
    return '社媒';
  }
  return '站外引用';
}

/**
 * @param {Array<{ label: string, count: number }>} items
 * @param {number} limit
 */
export function rankTop(items, limit = 10) {
  const map = new Map();
  for (const item of items) {
    const label = String(item.label || '').trim() || '(空)';
    map.set(label, (map.get(label) || 0) + (Number(item.count) || 0));
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * @param {number} current
 * @param {number} previous
 */
export function pctDelta(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 1000) / 10;
}

export const DEVICE_LABELS = {
  desktop: '桌面',
  mobile: '手机',
  tablet: '平板',
  bot: '爬虫',
  unknown: '未知',
};
