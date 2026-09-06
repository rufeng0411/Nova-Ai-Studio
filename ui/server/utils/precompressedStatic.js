// PD-SAAS-FORK: serve Vite build artifacts with precomputed .br / .gz when Accept-Encoding matches.
import fs from 'fs';
import path from 'path';

const COMPRESSIBLE = /\.(js|mjs|css|json|svg|html|txt|xml|woff2?|ttf|eot)$/i;

const MIME_BY_EXT = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function resolveMime(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function parseAcceptEncoding(header) {
  const value = typeof header === 'string' ? header.toLowerCase() : '';
  return {
    br: value.includes('br'),
    gzip: value.includes('gzip'),
  };
}

function resolveDistAsset(rootDir, urlPath) {
  const root = path.resolve(rootDir);
  const relative = urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return resolved;
}

/**
 * @param {string} rootDir absolute path to ui/dist
 * @param {(res: import('express').Response, filePath: string) => void} [setHeaders]
 */
export function createPrecompressedStatic(rootDir, setHeaders) {
  return function precompressedStatic(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const urlPath = req.path;
    if (!COMPRESSIBLE.test(urlPath)) return next();

    const sourcePath = resolveDistAsset(rootDir, urlPath);
    if (!sourcePath) return next();

    const { br, gzip } = parseAcceptEncoding(req.headers['accept-encoding']);

    const candidates = [];
    if (br) candidates.push({ encoding: 'br', filePath: `${sourcePath}.br` });
    if (gzip) candidates.push({ encoding: 'gzip', filePath: `${sourcePath}.gz` });

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate.filePath)) continue;

      res.setHeader('Content-Encoding', candidate.encoding);
      res.setHeader('Vary', 'Accept-Encoding');
      res.type(resolveMime(sourcePath));

      if (typeof setHeaders === 'function') {
        setHeaders(res, sourcePath);
      }

      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', String(fs.statSync(candidate.filePath).size));
        res.status(200).end();
        return;
      }

      res.sendFile(candidate.filePath, (err) => {
        if (err && !res.headersSent) next(err);
      });
      return;
    }

    next();
  };
}
