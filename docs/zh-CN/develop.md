# 二次开发

配置级即可。不要把本仓库当成架构说明书。

1. 复制 `.env.example` → `.env`
2. `npm install`
3. `npm run dev` 或 `npm --workspace ui run build` 做编译检查

社区 CI 跑 Node 安装 + `npm --workspace ui run build`。不要加 Python `unittest` 门禁。

改产品行为请走工厂：对 `F:\Ai-pilotdeck` 再 organize，然后重跑 `scripts/_staging_n2_personal_saas.py`。不要手改商用源。
