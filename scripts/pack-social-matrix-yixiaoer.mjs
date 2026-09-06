#!/usr/bin/env node
/**
 * Build yixiaoer imageText publish-draft.json from social-matrix manifest + upload-map.
 * Does not call the API. Agent should fill platformAccountId and contentPublishForm per platform docs.
 *
 * Usage:
 *   node scripts/pack-social-matrix-yixiaoer.mjs \
 *     --manifest artifacts/social-matrix/demo/manifest.json \
 *     --upload-map artifacts/social-matrix/demo/yixiaoer/upload-map.json \
 *     [--accounts artifacts/social-matrix/demo/yixiaoer/accounts.json] \
 *     [--out artifacts/social-matrix/demo/yixiaoer/publish-draft.json] \
 *     [--draft yixiaoer|platform|public]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { draft: 'platform' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--upload-map') args.uploadMap = argv[++i];
    else if (a === '--accounts') args.accounts = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--draft') args.draft = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function resolveUploadEntry(uploadMap, fileRef) {
  const normalized = fileRef.replace(/\\/g, '/');
  const basename = path.basename(normalized);
  for (const [key, value] of Object.entries(uploadMap)) {
    const k = key.replace(/\\/g, '/');
    if (k === normalized || k.endsWith(`/${basename}`) || k.endsWith(normalized)) {
      return value;
    }
  }
  return null;
}

function imageFormItem(entry) {
  if (!entry?.key) return null;
  return {
    key: entry.key,
    width: entry.width ?? 0,
    height: entry.height ?? 0,
    size: entry.size ?? 0,
    format: entry.format ?? 'png',
  };
}

function platformBody(copy, platform) {
  const block = copy?.[platform];
  if (!block) return '';
  const parts = [];
  if (block.title) parts.push(String(block.title).trim());
  if (block.body) parts.push(String(block.body).trim());
  if (Array.isArray(block.hashtags) && block.hashtags.length) {
    parts.push(block.hashtags.map((t) => (String(t).startsWith('#') ? t : `#${t}`)).join(' '));
  }
  return parts.filter(Boolean).join('\n\n');
}

function buildDraftPayload({ manifest, uploadMap, accountsByPlatform, draftMode }) {
  const platforms = Array.isArray(manifest.platforms) ? manifest.platforms : [];
  const mapping = manifest.recommendedMapping || {};
  const copy = manifest.copy || {};

  const accountForms = [];
  let coverKey = '';

  for (const platform of platforms) {
    const fileRef = mapping[platform];
    if (!fileRef) continue;

    const uploadEntry = resolveUploadEntry(uploadMap, fileRef);
    const img = imageFormItem(uploadEntry);
    if (!img) {
      throw new Error(`upload-map missing entry for ${platform} → ${fileRef}`);
    }

    if (!coverKey) coverKey = img.key;

    const platformAccountId = accountsByPlatform?.[platform] ?? `REPLACE_${platform}_platformAccountId`;
    const content = platformBody(copy, platform) || manifest.creativeAnchor?.valueProp || '';

    const contentPublishForm = {};
    if (draftMode === 'platform') {
      contentPublishForm.pubType = 0;
    }

    accountForms.push({
      platformAccountId,
      images: [img],
      cover: { ...img },
      coverKey: img.key,
      contentPublishForm,
      _platform: platform,
      _content: content,
    });
  }

  if (!accountForms.length) {
    throw new Error('No accountForms built: check manifest.platforms and recommendedMapping');
  }

  const payload = {
    action: 'publish',
    publishType: 'imageText',
    platforms,
    coverKey: coverKey || accountForms[0].coverKey,
    publishArgs: {
      content: manifest.creativeAnchor?.valueProp || '社媒矩阵图文',
      accountForms: accountForms.map(({ _platform, _content, ...form }) => {
        void _platform;
        void _content;
        return form;
      }),
    },
    publishChannel: 'cloud',
  };

  if (draftMode === 'yixiaoer') {
    payload.isDraft = true;
  }

  payload._meta = {
    generatedAt: new Date().toISOString(),
    campaignId: manifest.campaignId,
    draftMode,
    note: 'Replace REPLACE_* platformAccountId via accounts API; merge _content into publishArgs or contentPublishForm per platform doc.',
    perPlatformContent: Object.fromEntries(
      accountForms.map((f) => [f._platform, f._content]),
    ),
  };

  return payload;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.manifest || !args.uploadMap) {
    console.error(`Usage: node scripts/pack-social-matrix-yixiaoer.mjs \\
  --manifest <path> --upload-map <path> [--accounts <path>] [--out <path>] [--draft platform|yixiaoer|public]`);
    process.exit(args.help ? 0 : 1);
  }

  const manifestPath = path.isAbsolute(args.manifest)
    ? args.manifest
    : path.join(REPO_ROOT, args.manifest);
  const uploadMapPath = path.isAbsolute(args.uploadMap)
    ? args.uploadMap
    : path.join(REPO_ROOT, args.uploadMap);

  if (!existsSync(manifestPath)) {
    console.error(`manifest not found: ${manifestPath}`);
    process.exit(1);
  }
  if (!existsSync(uploadMapPath)) {
    console.error(`upload-map not found: ${uploadMapPath}`);
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const uploadMap = readJson(uploadMapPath);
  let accountsByPlatform = {};
  if (args.accounts) {
    const accountsPath = path.isAbsolute(args.accounts)
      ? args.accounts
      : path.join(REPO_ROOT, args.accounts);
    const raw = readJson(accountsPath);
    accountsByPlatform = raw.byPlatform || raw;
  }

  const draftMode = ['platform', 'yixiaoer', 'public'].includes(args.draft)
    ? args.draft
    : 'platform';

  const payload = buildDraftPayload({
    manifest,
    uploadMap,
    accountsByPlatform,
    draftMode,
  });

  const defaultOut = path.join(
    path.dirname(uploadMapPath),
    'publish-draft.json',
  );
  const outPath = args.out
    ? (path.isAbsolute(args.out) ? args.out : path.join(REPO_ROOT, args.out))
    : defaultOut;

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, out: path.relative(REPO_ROOT, outPath).replace(/\\/g, '/') }));
}

main();
