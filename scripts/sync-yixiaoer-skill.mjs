#!/usr/bin/env node
/**
 * Sync upstream yixiaoer-skill into skills/yixiaoer/.
 * Pins version from SKILL.md frontmatter (default 1.6.4) and writes manifest.
 *
 * Usage:
 *   node scripts/sync-yixiaoer-skill.mjs [--force]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const UPSTREAM_REPO = 'https://github.com/yixiaoer888/yixiaoer-skill.git';
const TARGET_DIR = path.join(REPO_ROOT, 'skills', 'yixiaoer');
const MANIFEST_PATH = path.join(REPO_ROOT, 'config', 'yixiaoer-sync.manifest.json');
const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'yixiaoer-skill');
const PILOTDECK_SETUP_TEMPLATE = path.join(REPO_ROOT, 'config', 'yixiaoer-pilotdeck-setup.md');

const PILOTDECK_SKILL_HEADER = `
> ## PilotDeck 执行速查（必读）
>
> **优先使用内置工具 \`yixiaoer_api\`**（无需 bash、无需找 api.ts）。查正常抖音/小红书账号示例：
> \`{"action":"accounts","platforms":["抖音","小红书"],"loginStatus":1,"page":1,"size":100}\`
>
> **禁止**：在 \`Documents/yixiaoer-docs\` 等目录搜索 \`api.ts\`；**禁止** \`dir /s\` / \`find\` / \`head\`。
>
> 备选（仅当 \`yixiaoer_api\` 不可用时）：
> \`\`\`bash
> node "%PILOTDECK_YIXIAOER_API%" --payload-file payload.json
> \`\`\`
>
> Windows PowerShell：先把 JSON 写入文件，再执行上面命令。
>
> 详细约定：\`references/pilotdeck-setup.md\`
`.trim();

function injectPilotdeckSkillHeader(targetDir) {
  const skillPath = path.join(targetDir, 'SKILL.md');
  let content = readFileSync(skillPath, 'utf8');
  if (content.includes('PilotDeck 执行速查')) {
    return;
  }
  content = content.replace(/^---\n([\s\S]*?)\n---\n/, (block) => `${block}\n${PILOTDECK_SKILL_HEADER}\n\n`);
  writeFileSync(skillPath, content, 'utf8');
}

const force = process.argv.includes('--force');
const fromDirArg = process.argv.find((a, i) => process.argv[i - 1] === '--from-dir');

function downloadZip(destZip) {
  return new Promise((resolve, reject) => {
    const url = 'https://codeload.github.com/yixiaoer888/yixiaoer-skill/zip/refs/heads/main';
    mkdirSync(path.dirname(destZip), { recursive: true });
    const follow = (targetUrl, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error('Too many redirects downloading yixiaoer-skill zip'));
        return;
      }
      https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          writeFileSync(destZip, Buffer.concat(chunks));
          resolve(destZip);
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    const ps = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { encoding: 'utf8' },
    );
    if (ps.status !== 0) {
      throw new Error(`Expand-Archive failed: ${ps.stderr || ps.stdout}`);
    }
    return;
  }
  run('unzip', ['-q', '-o', zipPath, '-d', destDir], REPO_ROOT);
}

async function resolveUpstreamDir() {
  if (fromDirArg) {
    const resolved = path.resolve(fromDirArg);
    if (!existsSync(resolved)) throw new Error(`--from-dir not found: ${resolved}`);
    return { dir: resolved, commit: 'local-import' };
  }

  mkdirSync(path.dirname(CACHE_DIR), { recursive: true });
  if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true, force: true });

  try {
    console.log(`[yixiaoer-sync] Cloning ${UPSTREAM_REPO} ...`);
    run('git', ['clone', '--depth', '1', UPSTREAM_REPO, CACHE_DIR], REPO_ROOT);
    const commit = run('git', ['rev-parse', 'HEAD'], CACHE_DIR);
    return { dir: CACHE_DIR, commit };
  } catch (gitError) {
    console.warn(`[yixiaoer-sync] git clone failed, falling back to zip: ${gitError.message}`);
  }

  const zipPath = path.join(REPO_ROOT, '.cache', 'yixiaoer-skill-main.zip');
  const extractRoot = path.join(REPO_ROOT, '.cache', 'yixiaoer-skill-extract');
  if (existsSync(extractRoot)) rmSync(extractRoot, { recursive: true, force: true });
  console.log('[yixiaoer-sync] Downloading zip from codeload.github.com ...');
  await downloadZip(zipPath);
  extractZip(zipPath, extractRoot);
  const entries = readdirSync(extractRoot);
  const folder = entries.find((e) => e.startsWith('yixiaoer-skill'));
  if (!folder) throw new Error('Unexpected zip layout: missing yixiaoer-skill-* folder');
  return { dir: path.join(extractRoot, folder), commit: 'zip-main' };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed: ${message}`);
  }
  return (result.stdout || '').trim();
}

function parseSkillVersion(skillMd) {
  const match = skillMd.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match ? match[1].trim() : 'unknown';
}

function writePilotdeckPatches(targetDir, manifest) {
  const referencesDir = path.join(targetDir, 'references');
  mkdirSync(referencesDir, { recursive: true });

  writeFileSync(
    path.join(referencesDir, 'ATTRIBUTION.md'),
    `# 蚁小二 Skill 来源说明

- **上游仓库**: ${UPSTREAM_REPO}
- **同步版本**: ${manifest.version}
- **同步 commit**: \`${manifest.commit}\`
- **同步时间**: ${manifest.syncedAt}
- **许可证**: 上游仓库未附带 LICENSE 文件；本目录内容仅用于调用蚁小二 Open API，请遵循蚁小二服务条款。

PilotDeck 追加文件（不修改上游 DTO 语义）：

- \`references/pilotdeck-setup.md\` — PilotDeck 环境配置与 Agent 执行约定
`,
    'utf8',
  );

  writeFileSync(
    path.join(referencesDir, 'pilotdeck-setup.md'),
    readFileSync(PILOTDECK_SETUP_TEMPLATE, 'utf8'),
    'utf8',
  );

  injectPilotdeckSkillHeader(targetDir);
}

function main() {
  if (existsSync(TARGET_DIR) && !force) {
    console.error(
      `[yixiaoer-sync] Target exists: ${TARGET_DIR}. Pass --force to overwrite.`,
    );
    process.exit(1);
  }

  resolveUpstreamDir()
    .then(({ dir: upstreamDir, commit }) => {
      const skillMd = readFileSync(path.join(upstreamDir, 'SKILL.md'), 'utf8');
      const version = parseSkillVersion(skillMd);

      if (existsSync(TARGET_DIR)) {
        rmSync(TARGET_DIR, { recursive: true, force: true });
      }
      mkdirSync(TARGET_DIR, { recursive: true });

      for (const name of ['SKILL.md', 'docs', 'scripts']) {
        const src = path.join(upstreamDir, name);
        if (!existsSync(src)) {
          throw new Error(`Missing upstream path: ${name}`);
        }
        cpSync(src, path.join(TARGET_DIR, name), { recursive: true, force: true });
      }

      const manifest = {
        version,
        commit,
        upstream: UPSTREAM_REPO,
        syncedAt: new Date().toISOString(),
        target: 'skills/yixiaoer',
      };

      writePilotdeckPatches(TARGET_DIR, manifest);
      mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
      writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      if (existsSync(CACHE_DIR) && !fromDirArg) {
        rmSync(CACHE_DIR, { recursive: true, force: true });
      }

      console.log(`[yixiaoer-sync] Synced v${version} (${String(commit).slice(0, 7)}) -> skills/yixiaoer`);
      console.log('[yixiaoer-sync] Manifest: config/yixiaoer-sync.manifest.json');
    })
    .catch((error) => {
      console.error(`[yixiaoer-sync] ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}

main();
