# VAP 爬虫侧车 Runbook

本地 Docker 运行 AnyCrawl，供 Discover T4（JS 渲染抽图）调用。

## 启动

```bash
docker compose -f deploy/vap-crawler/docker-compose.yml up -d
```

Gateway / Launcher env：

```text
PILOTDECK_VAP_CRAWLER_SIDECAR=anycrawl
PILOTDECK_VAP_CRAWLER_URL=http://127.0.0.1:8080
```

## 健康检查

```bash
curl -sS http://127.0.0.1:8080/health || curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
```

未启动时 VAP **跳过 T4**（记 `sidecar_off` / circuit），不拖垮主站。

## 回滚

```text
PILOTDECK_VAP_CRAWLER_SIDECAR=off
docker compose -f deploy/vap-crawler/docker-compose.yml down
```

## 403 / Cloudflare（可选）

`PILOTDECK_VAP_STEALTH_SIDECAR=1` 时尝试 stealth 引擎（默认关）。
