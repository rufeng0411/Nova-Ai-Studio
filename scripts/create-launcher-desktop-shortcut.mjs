#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Desktop shortcut → wscript + NovaLauncher.vbs（避免未签名 exe 被 SmartScreen 拦截）
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ensureNovaLauncherIcon } from './lib/ensureNovaLauncherIcon.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const vbsPath = join(repoRoot, 'NovaLauncher.vbs');
const wscript = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe');

if (process.platform !== 'win32') {
  console.error('[shortcut] Windows only');
  process.exit(1);
}

if (!existsSync(vbsPath)) {
  console.error('[shortcut] missing', vbsPath);
  process.exit(1);
}

const icoPath = await ensureNovaLauncherIcon();

const ps = `
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Nova Dev Console.lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnk)
$sc.TargetPath = '${wscript.replace(/'/g, "''")}'
$sc.Arguments = '//Nologo "${vbsPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"'
$sc.WorkingDirectory = '${repoRoot.replace(/'/g, "''")}'
$sc.IconLocation = '${icoPath.replace(/'/g, "''")},0'
$sc.Description = 'Nova Ai-Studio SaaS dev launcher'
$sc.Save()
Write-Output $lnk
`;

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
  { encoding: 'utf8', windowsHide: true },
);

if (result.status !== 0) {
  console.error('[shortcut] failed:', result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

spawnSync('ie4uinit.exe', ['-show'], { windowsHide: true });
console.log('[shortcut] created:', (result.stdout || '').trim());
console.log('[shortcut] target: wscript →', vbsPath);
