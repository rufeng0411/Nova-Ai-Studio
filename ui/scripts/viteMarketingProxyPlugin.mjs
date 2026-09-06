/**
 * PD-SAAS-FORK: In Vite dev, proxy marketing homepage paths to Bridge so
 * product entry matches production: open `/` → marketing site → `/login`.
 */
import http from 'node:http';

const SPA_PREFIXES = [
  '/login',
  '/app',
  '/admin',
  '/m/',
  '/p/',
  '/src/',
  '/@',
  '/node_modules/',
  '/api/',
  '/ws',
];

/** Marketing static under deploy/marketing/shared — NOT ui/shared/*.mjs (Vite app modules). */
function isMarketingSharedAsset(pathname) {
  const p = pathname.split('?')[0] || '';
  return (
    /^\/shared\/(tokens|shell|motion|home|docs|contact|content|responsive|legalModal)\.css$/.test(p)
    || /^\/shared\/(site|analytics|i18n|legalModal)\.js$/.test(p)
    || /^\/pages\/(about|copyright)\.json$/.test(p)
  );
}

/** Showcase + /en/* marketing trees are Bridge static (incl. .js/.css), never Vite app modules. */
function isMarketingStaticTree(pathname) {
  const p = pathname.split('?')[0] || '';
  return p.startsWith('/showcase') || p === '/en' || p.startsWith('/en/');
}

function isSpaOrViteInternal(urlPath) {
  if (!urlPath) return true;
  // Normalize: strip query; tolerate accidental absolute URLs in req.url
  let p = String(urlPath).split('?')[0] || '/';
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname || '/';
  } catch {
    /* keep p */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.startsWith('/@vite') || p.startsWith('/@fs') || p.startsWith('/@id') || p.startsWith('/@react-refresh')) {
    return true;
  }
  // Must run before the generic *.js SPA trap — catalog.js/site.js live under /showcase/
  if (isMarketingStaticTree(p)) return false;
  // Hard deny: Vite app entry / modules must never hit Bridge SPA HTML (MIME white-screen)
  if (p === '/src' || p.startsWith('/src/') || p === '/node_modules' || p.startsWith('/node_modules/')) {
    return true;
  }
  for (const prefix of SPA_PREFIXES) {
    if (p === prefix || p.startsWith(prefix)) return true;
  }
  // ui/shared browser modules (e.g. /shared/deliverablePathResolve.mjs) must stay on Vite
  if (p.startsWith('/shared/') && !isMarketingSharedAsset(p)) return true;
  // SPA chunk / module requests (jsx/tsx/mjs — not bare .js; marketing owns /shared/*.js)
  if (/\.(tsx|jsx|mjs|map|vue|svelte)(\?|$)/i.test(p) && !isMarketingSharedAsset(p)) {
    return true;
  }
  // Vite CSS under /src; marketing CSS stays proxyable via isMarketingSharedAsset
  if (/\.css(\?|$)/i.test(p) && (p.startsWith('/src/') || (p.startsWith('/shared/') && !isMarketingSharedAsset(p)))) {
    return true;
  }
  return false;
}

/** Exported for unit tests (marketing proxy path gate). */
export function shouldProxyMarketingPath(urlPath, marketingOn) {
  return shouldProxyMarketing(urlPath, marketingOn);
}

function shouldProxyMarketing(urlPath, marketingOn) {
  if (!marketingOn) return false;
  if (isSpaOrViteInternal(urlPath)) return false;
  const p = (urlPath || '/').split('?')[0] || '/';
  if (p === '/' || p === '/index.html') return true;
  if (
    p === '/llms.txt'
    || p === '/robots.txt'
    || p === '/sitemap.xml'
    || p === '/manifest.webmanifest'
    || p === '/sw.js'
  ) {
    return true;
  }
  if (
    p.startsWith('/contact')
    || p.startsWith('/docs')
    || p.startsWith('/geo')
    || p.startsWith('/for-ai')
    || p.startsWith('/faq')
    || p.startsWith('/compare')
    || p.startsWith('/claims')
    || p.startsWith('/about')
    || p.startsWith('/copyright')
    || p.startsWith('/showcase')
    || p === '/en'
    || p.startsWith('/en/')
  ) {
    return true;
  }
  if (isMarketingSharedAsset(p)) return true;
  // Marketing site assets under /assets/ (logo etc.) — only when not a Vite hashed bundle.
  // Bridge marketing uses /assets/nova-logo-mark.png; Vite uses /assets/index-*.js
  if (p.startsWith('/assets/') && !/\.(js|css)(\?|$)/i.test(p)) return true;
  return false;
}

/**
 * @param {{ proxyHost: string, serverPort: string|number, marketingOn: boolean }} opts
 */
export function viteMarketingProxyPlugin(opts) {
  const targetHost = opts.proxyHost || '127.0.0.1';
  const targetPort = Number(opts.serverPort) || 7990;
  const marketingOn = opts.marketingOn === true;

  return {
    name: 'pilotdeck-marketing-proxy',
    configureServer(server) {
      // Pre-middleware so `/` hits Bridge marketing before Vite SPA fallback.
      server.middlewares.use((req, res, next) => {
        if (!marketingOn) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = req.url || '/';
        const pathOnly = String(url).split('?')[0] || '/';
        // Never proxy Vite app modules — Bridge SPA HTML as JS = white screen.
        // Note: do NOT treat bare `.js` as Vite-only — marketing uses `/shared/*.js`.
        if (
          pathOnly === '/src'
          || pathOnly.startsWith('/src/')
          || pathOnly.startsWith('/@')
          || pathOnly.startsWith('/node_modules/')
          || /\.(tsx|jsx|mjs)(\?|$)/i.test(pathOnly)
        ) {
          return next();
        }
        if (!shouldProxyMarketing(url, marketingOn)) return next();

        const headers = { ...req.headers, host: `${targetHost}:${targetPort}` };
        delete headers['accept-encoding'];

        const proxyReq = http.request(
          {
            hostname: targetHost,
            port: targetPort,
            path: url,
            method: req.method,
            headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );
        proxyReq.on('error', (err) => {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(
            `[vite] marketing proxy → Bridge ${targetHost}:${targetPort} failed: ${err.message}\n`
              + '请先启动 Bridge（npm run launcher / restart:ui-dev），产品入口为营销首页。',
          );
        });
        req.pipe(proxyReq);
      });
    },
  };
}
