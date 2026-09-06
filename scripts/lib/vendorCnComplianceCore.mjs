/**
 * PD-SAAS-FORK: Shared vendor + Nova-fit for skills/vendor/cn-compliance
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
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'cn-compliance');

const DISCLAIMER = `## Nova 合规声明（强制）

- **法域默认：中国大陆**（除非正文另有标明）。
- 本 skill 产出为**草稿/工作底稿**，**不构成**法律、税务、会计或劳动人事**执业意见**；落地前须由具备资质的专业人士审定。
- **禁止**协助伪造票证、隐瞒收入、虚假申报或其它违法规避行为。
- 交付文件写入系统分配的任务目录（\`artifacts/task-*\`），勿写死 Claude Code 或本机绝对路径。
`;

export function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

export function cloneRepo(repoUrl, cloneDir) {
  rmSync(cloneDir, { recursive: true, force: true });
  mkdirSync(path.dirname(cloneDir), { recursive: true });
  run('git', ['clone', '--depth', '1', repoUrl, cloneDir], REPO_ROOT);
  return run('git', ['rev-parse', 'HEAD'], cloneDir);
}

function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

export function novaFitSkillMd(skillMdPath, slug) {
  let text = readFileSync(skillMdPath, 'utf8').replace(/^\uFEFF/, '');
  // Strip Claude Code absolute / marketplace paths
  text = text
    .replace(/~\/\.claude[^\s)`"']*/g, '(本机 Claude 插件路径已移除)')
    .replace(/\$HOME\/\.claude[^\s)`"']*/g, '(本机 Claude 插件路径已移除)')
    .replace(/\/plugin\s+marketplace[^\n]*/gi, '')
    .replace(/\/tmp_workspace\//g, 'artifacts/task-*/')
    .replace(/C:\\Users\\[^\s`)'"]+/gi, '(本机绝对路径已移除)');

  // Patch frontmatter name (support CRLF)
  if (/^---\r?\n/.test(text)) {
    text = text.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, (_block, body) => {
      let next = body.replace(/\r/g, '');
      if (/^name:\s*/m.test(next)) {
        next = next.replace(/^name:\s*.*$/m, `name: ${slug}`);
      } else {
        next = `name: ${slug}\n${next}`;
      }
      if (!/^description:\s*\S/m.test(next)) {
        next = `${next}\ndescription: China mainland compliance skill (Nova-fit). Draft only — not professional advice.`;
      }
      return `---\n${next}\n---\n`;
    });
  } else {
    text = `---\nname: ${slug}\ndescription: China mainland compliance skill (Nova-fit). Draft only — not professional advice.\n---\n\n${text}`;
  }

  // Always ensure disclaimer block once (after frontmatter)
  if (!/Nova 合规声明（强制）/.test(text)) {
    const parts = text.split(/^---\n[\s\S]*?\n---\n/);
    if (parts.length >= 2) {
      const fm = text.match(/^---\n[\s\S]*?\n---\n/)[0];
      text = `${fm}\n${DISCLAIMER}\n${text.slice(fm.length)}`;
    } else {
      text = `${DISCLAIMER}\n${text}`;
    }
  }

  if (!/法域：中国大陆/.test(text.slice(0, 3500))) {
    text = text.replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n> 法域：中国大陆（CN）\n`);
  }

  writeFileSync(skillMdPath, text, 'utf8');
}

/**
 * @param {{ repoUrl: string, packLabel: string, mappings: { sourcePath: string, vendoredSlug: string }[], cloneDir?: string }} opts
 */
export function vendorMappings(opts) {
  const { repoUrl, packLabel, mappings } = opts;
  mkdirSync(VENDOR_ROOT, { recursive: true });
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-cn-compliance-${Date.now()}`);
  const cloneDir = opts.cloneDir || path.join(tempBase, 'repo');
  let commit = 'local-reuse';
  let cleanup = false;
  if (!opts.cloneDir) {
    commit = cloneRepo(repoUrl, cloneDir);
    cleanup = true;
  } else if (existsSync(path.join(opts.cloneDir, '.git'))) {
    try {
      commit = run('git', ['rev-parse', 'HEAD'], opts.cloneDir);
    } catch {
      commit = 'unknown';
    }
  }

  const copied = [];
  for (const m of mappings) {
    const skillDir = path.join(cloneDir, m.sourcePath);
    if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
      console.warn(`[vendor-cn-compliance] skip missing ${m.sourcePath}`);
      continue;
    }
    const dest = path.join(VENDOR_ROOT, m.vendoredSlug);
    copySkillDir(skillDir, dest);
    novaFitSkillMd(path.join(dest, 'SKILL.md'), m.vendoredSlug);
    copied.push(m);
  }

  const attrPath = path.join(VENDOR_ROOT, `ATTRIBUTION-${packLabel}.md`);
  writeFileSync(
    attrPath,
    [
      `# ${packLabel}`,
      '',
      `- Repository: ${repoUrl}`,
      `- Commit: ${commit}`,
      `- Vendored: ${new Date().toISOString()}`,
      '',
      '| Source path | Slug |',
      '|---|---|',
      ...copied.map((c) => `| ${c.sourcePath} | ${c.vendoredSlug} |`),
      '',
    ].join('\n'),
    'utf8',
  );

  if (cleanup) rmSync(tempBase, { recursive: true, force: true });
  console.log(`[vendor-cn-compliance:${packLabel}] done skills=${copied.length} commit=${String(commit).slice(0, 8)}`);
  return { commit, copied };
}
