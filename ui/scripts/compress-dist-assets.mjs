// PD-SAAS-FORK: emit .gz / .br siblings for compressible dist assets (no extra npm deps).
import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const COMPRESSIBLE = /\.(js|mjs|css|json|svg|html|txt|xml|woff2?|ttf|eot)$/i;
const MIN_BYTES = 1024;

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

/** @param {string} outDir absolute dist directory */
export function compressDistAssets(outDir) {
  if (!fs.existsSync(outDir)) return { compressed: 0 };

  let compressed = 0;
  for (const filePath of walkFiles(outDir)) {
    if (!COMPRESSIBLE.test(filePath)) continue;
    if (filePath.endsWith('.gz') || filePath.endsWith('.br')) continue;

    const stat = fs.statSync(filePath);
    if (stat.size < MIN_BYTES) continue;

    const source = fs.readFileSync(filePath);
    fs.writeFileSync(`${filePath}.gz`, gzipSync(source, { level: 9 }));
    fs.writeFileSync(
      `${filePath}.br`,
      brotliCompressSync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
        },
      }),
    );
    compressed += 1;
  }

  return { compressed };
}

/** Vite plugin wrapper for production builds. */
export function novaPrecompressPlugin(outDir) {
  return {
    name: 'nova-precompress',
    apply: 'build',
    closeBundle() {
      const result = compressDistAssets(outDir);
      if (result.compressed > 0) {
        console.log(`[nova-precompress] wrote .gz/.br for ${result.compressed} assets`);
      }
    },
  };
}
