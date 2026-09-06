#!/usr/bin/env node
/**
 * PD-SAAS-FORK: L5 bundle gate — document libraries stay out of the main index sync graph.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function runBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
      cwd: path.resolve('ui'),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build failed: ${code}`))));
  });
}

async function main() {
  await runBuild();
  const assetsDir = path.resolve('ui/dist/assets');
  const files = await fs.readdir(assetsDir);
  const indexChunk = files.find((name) => name.startsWith('index-') && name.endsWith('.js') && !name.includes('index-v'));
  const previewChunk = files.find((name) => name.startsWith('DocumentCanvasPreview-') && name.endsWith('.js'));
  const officeChunk = files.find((name) => name.startsWith('document-office-') && name.endsWith('.js'));
  const pdfChunk = files.find((name) => /^pdf-.*\.js$/.test(name));

  if (!indexChunk) {
    throw new Error('Missing index chunk in ui/dist/assets');
  }
  if (!previewChunk || !officeChunk || !pdfChunk) {
    throw new Error(`Missing lazy document chunks (preview=${previewChunk}, office=${officeChunk}, pdf=${pdfChunk})`);
  }

  const indexSource = await fs.readFile(path.join(assetsDir, indexChunk), 'utf8');
  const forbidden = ['pdfjs-dist', 'docx-preview', 'pptxviewjs'].filter((token) => indexSource.includes(token));
  if (forbidden.length > 0) {
    throw new Error(`Main index chunk synchronously references document libraries: ${forbidden.join(', ')}`);
  }

  process.stdout.write(
    `document canvas bundle gate OK (${[previewChunk, officeChunk, pdfChunk].join(', ')})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
