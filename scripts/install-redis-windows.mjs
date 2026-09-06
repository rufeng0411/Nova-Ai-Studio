#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Install native Redis-compatible server on Windows (Memurai Developer).
 *
 *   npm run install:redis
 */
import { spawnSync } from 'node:child_process';
import { ensureNativeRedis, findRedisCli, pingRedis, DEV_REDIS_URL } from './lib/nativeRedis.mjs';

function runWingetInstall() {
  console.log('[install:redis] 通过 winget 安装 Memurai Developer（Redis 兼容）…');
  const result = spawnSync(
    'winget',
    [
      'install',
      'Memurai.MemuraiDeveloper',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ],
    { stdio: 'inherit', shell: true },
  );
  return result.status === 0;
}

async function main() {
  if (findRedisCli() && pingRedis()) {
    console.log(`[install:redis] 本机 Redis 已可用: ${DEV_REDIS_URL}`);
    return;
  }

  if (process.platform !== 'win32') {
    console.error('[install:redis] 当前脚本仅封装 Windows Memurai；Linux/macOS 请用系统包管理器安装 redis-server');
    process.exit(1);
  }

  if (!findRedisCli()) {
    const ok = runWingetInstall();
    if (!ok) {
      console.error('[install:redis] 安装失败，可手动执行: winget install Memurai.MemuraiDeveloper');
      process.exit(1);
    }
  }

  const ready = await ensureNativeRedis();
  if (!ready) {
    console.error('[install:redis] 安装完成但 PING 失败，请重启终端后执行: memurai-cli ping');
    process.exit(1);
  }

  console.log(`[install:redis] OK — ${DEV_REDIS_URL}`);
  console.log('[install:redis] CLI: memurai-cli   服务名: Memurai');
}

main().catch((err) => {
  console.error('[install:redis] FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
