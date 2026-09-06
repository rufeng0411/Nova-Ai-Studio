// PD-SAAS-FORK: single HTML deliverable sanity rules shared by engine + UI server.

export function isLikelyFormalHtml(content) {
  const source = String(content || '').trimStart();
  if (!source) return false;
  const head = source.slice(0, 4096);
  if (/^<{2,}(?:!doctype\s+html|html\b)/i.test(head)) return false;
  if (/CONTINUE HERE|<tool_use_error>|InputValidationError/i.test(source)) return false;
  if (/^\s*[}.]?\s*\/\*.*?\*\/\s*[.#\w-]+\s*\{/s.test(head)) return false;
  if (!/^(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+html\b|<html\b)/i.test(head)) return false;
  if (!/<body\b/i.test(source)) return false;
  if (/hello world test page|this is a test page|final final final/i.test(source)) return false;
  const visibleText = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (visibleText.length < 24 && /\b(?:placeholder|todo)\b/i.test(visibleText)) return false;
  return true;
}

// PD-SAAS-FORK: deep HTML defect detectors shared by the engine final-acceptance
// gate and the UI server validate endpoint, so a chart-less chart page or an
// indefinitely-loading 3D/video page is judged identically on both sides instead
// of diverging into engine "needs_repair" vs UI "verified".

/**
 * A page that pulls in a charting lib (Chart.js / ECharts) but ships no <canvas>
 * and no chart-ish container will render blank — treat as broken.
 * @param {string} content
 * @returns {boolean}
 */
export function hasBrokenChartHtml(content) {
  const source = String(content || '');
  if (!/(?:chart\.js|new\s+Chart\s*\(|echarts(?:\.min)?\.js|echarts\.init\s*\()/i.test(source)) {
    return false;
  }
  return !/<canvas\b/i.test(source) && !/(?:id|class)=["'][^"']*(?:chart|echart|graph|visual)[^"']*["']/i.test(source);
}

/**
 * A page that shows a loading/spinner gated on an external 3D/video CDN, with no
 * removal logic and no fallback content, will spin forever — treat as broken.
 * @param {string} content
 * @returns {boolean}
 */
export function hasIndefiniteLoadingHtml(content) {
  const source = String(content || '');
  if (!/(?:id|class)=["'][^"']*(?:loading|loader|spinner)[^"']*["']|>\s*(?:Loading|加载中|载入中|正在加载)/i.test(source)) {
    return false;
  }
  const external3dOrVideoDependency = /<script[^>]+src=["']https?:\/\/[^"']*(?:three|gsap|webgl|babylon|pixi|remotion|ffmpeg|video|unpkg|cdn\.jsdelivr|cdnjs)/i.test(source)
    || /import\s+[^;]*from\s+["']https?:\/\/[^"']*(?:three|gsap|babylon|unpkg|cdn\.jsdelivr|cdnjs)/i.test(source);
  const hasLoadingRemoval = /(?:remove|style\.display\s*=\s*["']none["']|classList\.add\s*\(\s*["'](?:hidden|ready|loaded)|loaded|ready)/i.test(source)
    && /(?:loading|loader|spinner)/i.test(source);
  const hasFallbackContent = /<noscript\b|data-fallback=|class=["'][^"']*(?:fallback|static-scene|poster|hero)[^"']*["']/i.test(source);
  return external3dOrVideoDependency && !hasLoadingRemoval && !hasFallbackContent;
}
