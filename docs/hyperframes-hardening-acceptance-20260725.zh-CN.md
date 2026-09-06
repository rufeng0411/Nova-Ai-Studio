# HyperFrames 最强改造验收报告（2026-07-25）

## 范围

- 19 上游 skill vendor + NOVA-EXEC 置顶
- Gateway `render_hyperframes`（路径钳制 / 并发 1 / doctor→render）
- 媒体策略 / binding / profile 反 `generate_video` 劫持
- dev `ENGINE=enforce` / pack `ENGINE=shadow` / `HUB_V2` 运行时回滚
- Docker ffmpeg + hyperframes@0.7.70 + doctor 门禁

## 门禁结果

| 级别 | 命令 | 状态 |
|------|------|------|
| L0 | `npm run smoke:hyperframes` | 待本机 ffmpeg + hyperframes CLI |
| L1 | `npm run test:hyperframes:unit` | 见 CI/本地 vitest |
| L2 | `npm run test:hyperframes:live -- --gate` | Gateway live harness 待接线 |
| L3 | `verify-cloud-runtime.sh` ffmpeg + doctor | 镜像构建后 |

## 宣称口径

- **开发合并**：L0+L1 绿
- **Hotfix GO（生产 shadow）**：L0+L1+L2 绿
- **PACK GO**：+ L3 + 镜像增量评估

## 已知风险

- Puppeteer Chromium + hyperframes 使镜像体积显著增加（待 pack 后量化）
- Windows 无 ffmpeg 时 L0 exit 2（非假绿）
- L2 Gateway 实机用例需在 `run-hyperframes-live.mjs` 接入 `gatewaySessionHarness`

## 回滚

```bash
PILOTDECK_HYPERFRAMES_ENGINE=0
PILOTDECK_HYPERFRAMES_HUB_V2=0
```
