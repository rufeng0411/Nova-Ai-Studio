import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export function findRepoRoot(startDir) {
    if (process.env.NOVA_REPO_ROOT?.trim()) {
        const explicit = resolve(process.env.NOVA_REPO_ROOT.trim());
        if (existsSync(join(explicit, 'package.json')) && existsSync(join(explicit, 'ui'))) {
            return explicit;
        }
    }
    let dir = startDir ? resolve(startDir) : resolve(__dirname);
    for (let i = 0; i < 10; i += 1) {
        try {
            const pkg = readFileSync(join(dir, 'package.json'), 'utf8');
            if (pkg.includes('"pilotdeck"') && existsSync(join(dir, 'ui'))) {
                return dir;
            }
        }
        catch {
            // continue upward
        }
        const parent = resolve(dir, '..');
        if (parent === dir)
            break;
        dir = parent;
    }
    throw new Error('无法定位 Nova 仓库根目录，请设置 NOVA_REPO_ROOT 环境变量');
}
export function checkPrerequisites(repoRoot) {
    const messages = [];
    const nodeVersion = process.version;
    const major = Number.parseInt(nodeVersion.slice(1), 10);
    if (major < 20) {
        messages.push(`Node 版本过低（需要 ≥20，当前 ${nodeVersion}）`);
    }
    const hasUiModules = existsSync(join(repoRoot, 'ui', 'node_modules'));
    if (!hasUiModules) {
        messages.push('ui/node_modules 不存在，请先在仓库根目录运行 npm install');
    }
    return {
        ok: messages.length === 0,
        nodeVersion,
        hasUiModules,
        messages,
    };
}
