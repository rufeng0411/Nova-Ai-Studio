#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Build NovaDevConsole.exe with embedded N2 icon (csc /win32icon).
 */
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ensureNovaLauncherIcon } from './ensureNovaLauncherIcon.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const launcherRoot = join(repoRoot, 'tools/nova-launcher');
const assetsDir = join(launcherRoot, 'assets');
const hostExe = join(assetsDir, 'NovaDevConsole.exe');
const csPath = join(assetsDir, 'NovaDevConsole.cs');
const vbsPath = join(repoRoot, 'NovaLauncher.vbs');

const CSC_CANDIDATES = [
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
];

function resolveCsc() {
  for (const p of CSC_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  const found = spawnSync('where.exe', ['csc'], { encoding: 'utf8', windowsHide: true });
  const line = found.stdout?.split(/\r?\n/).find((l) => l.trim().endsWith('csc.exe'))?.trim();
  return line || null;
}

function writeLauncherCs() {
  const vbs = vbsPath.replace(/\\/g, '\\\\');
  const source = `using System;
using System.Diagnostics;

internal static class NovaDevConsoleLauncher
{
    [STAThread]
    private static void Main()
    {
        var psi = new ProcessStartInfo
        {
            FileName = "wscript.exe",
            Arguments = "//Nologo \\\"${vbs}\\\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        Process.Start(psi);
    }
}
`;
  writeFileSync(csPath, source, 'utf8');
}

/**
 * @returns {Promise<string>}
 */
export async function ensureNovaLauncherHost() {
  if (process.platform !== 'win32') {
    throw new Error('NovaDevConsole.exe is Windows-only');
  }

  const icoPath = await ensureNovaLauncherIcon();
  mkdirSync(assetsDir, { recursive: true });
  writeLauncherCs();

  const inputsMtime = Math.max(
    statSync(vbsPath).mtimeMs,
    statSync(icoPath).mtimeMs,
    statSync(csPath).mtimeMs,
  );
  const exeMtime = existsSync(hostExe) ? statSync(hostExe).mtimeMs : 0;
  if (existsSync(hostExe) && inputsMtime <= exeMtime) {
    return hostExe;
  }

  const csc = resolveCsc();
  if (!csc) {
    throw new Error('csc.exe not found — install .NET Framework developer pack');
  }

  if (existsSync(hostExe)) unlinkSync(hostExe);

  const result = spawnSync(
    csc,
    ['/nologo', '/target:winexe', `/win32icon:${icoPath}`, `/out:${hostExe}`, csPath],
    { encoding: 'utf8', windowsHide: true },
  );

  if (result.status !== 0 || !existsSync(hostExe)) {
    throw new Error(result.stderr || result.stdout || 'csc compile failed');
  }

  return hostExe;
}
