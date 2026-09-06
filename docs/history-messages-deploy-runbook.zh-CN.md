# 对话历史 messages 加速 — 生产发版与 .env 配置

> 对应代码还原点：`restore-point/pre-history-messages-accel-2026-06-20`  
> 功能验收：`docs/history-messages-acceleration-qa-2026-06-20.md`

## 一键开启（推荐）

与 `upgrade.sh` 相同：**打包后在 `dist-release/` 根目录**，上传 OSS 后 ECS curl 执行。

**1. 本机打包并上传 OSS**

```bash
npm run pack:deploy:upload
```

产出（均在 `dist-release/`，无子目录）：

```
dist-release/
  nova-YYYYMMDD.xxxx.tar.gz
  nova-latest.tar.gz
  upgrade.sh
  apply-cloud-perf-env.sh    ← 与 upgrade.sh 同级
  verify-cloud-perf.sh
  DEPLOY.md
  …
```

OSS 路径（与现有发版相同前缀，**不新建目录**）：

`https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio/apply-cloud-perf-env.sh`

**2. ECS 上一键执行**

```bash
curl -fsSL "https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio/apply-cloud-perf-env.sh" -o /tmp/apply-cloud-perf-env.sh
sudo bash /tmp/apply-cloud-perf-env.sh
```

整包升级后也可直接：`sudo bash /opt/nova-ai-studio/apply-cloud-perf-env.sh`（upgrade 会从 tar 同步到安装根目录）。

## 重要说明

- **upgrade 不覆盖** ECS 上 `/opt/nova-ai-studio/.env`（仅首装 `install.sh` 从包内 `deploy.env` 写入）。
- 存量服务器请用上方 **`apply-cloud-perf-env.sh` 一键合并**，或手工合并下列变量并 `docker compose restart nova`。
- 新首装：`pack.mjs` 已在 `deploy.env` 默认写入 `PILOTDECK_HISTORY_SANITIZE=1`（阶段 A）；B/C 仍建议跑一键脚本补全。

## 分阶段发版（推荐顺序）

### 阶段 A — 历史 API 载荷瘦身（先发）

| 项 | 值 |
|----|-----|
| **Env** | `PILOTDECK_HISTORY_SANITIZE=1` |
| **作用** | `GET …/messages` 截断巨型 `tool_result`；保留 `writtenFilePath` / 成果路径 |
| **默认** | SaaS 容器内 `PILOTDECK_SAAS_MODE=1` 时代码侧亦默认 sanitize；**生产仍建议显式写 1** |

**验收**

```bash
# 本机（需凭据，勿入库）
export PROD_BASE_URL=https://www.novapage.online
export DIAG_USER=...
export DIAG_PASS=...
npm run test:cloud:chat-load
```

通过标准：侧栏最近 5 会话 tail120 响应 **无 >1MB**；重会话 **<500KB** 为主。

ECS 校验：

```bash
sudo bash /opt/nova-ai-studio/verify-cloud-perf.sh
# 应见 ✓ PILOTDECK_HISTORY_SANITIZE=1
```

### 阶段 B — JSONL 真尾读（A 通过后再开）

| 项 | 值 |
|----|-----|
| **Env** | `PILOTDECK_HISTORY_TAIL_READ=1` |
| **作用** | backward 尾页不再全量 parse JSONL；API CPU 6–13s → 亚秒级 |
| **默认** | **关**；须显式 `=1` |

**验收**：同一 `test:cloud:chat-load` 三轮 median — tail120 **P95 耗时 <1.5s**，**P95 体积 <500KB**。

### 阶段 C — Redis 尾页缓存（可选）

| 项 | 值 |
|----|-----|
| **Env** | `PILOTDECK_HISTORY_MESSAGE_CACHE=1` |
| **依赖** | `REDIS_URL` 已配置（compose `nova-redis`） |
| **TTL** | `CACHE_TTL_MESSAGES_SEC=120`（pack 首装默认 120） |

**验收**：同一 session 第二次 tail 请求命中 Redis（mtime 不变）；transcript 追加后 miss。

## ECS 操作示例

```bash
ENV=/opt/nova-ai-studio/.env
COMPOSE=/opt/nova-ai-studio/current/docker-compose.prod.yml

# 阶段 A
grep -q '^PILOTDECK_HISTORY_SANITIZE=' "$ENV" \
  && sudo sed -i 's/^PILOTDECK_HISTORY_SANITIZE=.*/PILOTDECK_HISTORY_SANITIZE=1/' "$ENV" \
  || echo 'PILOTDECK_HISTORY_SANITIZE=1' | sudo tee -a "$ENV"

cd /opt/nova-ai-studio/current
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV" restart nova

# 阶段 B（A 验收通过后）
echo 'PILOTDECK_HISTORY_TAIL_READ=1' | sudo tee -a "$ENV"
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV" restart nova

# 阶段 C（可选）
echo 'PILOTDECK_HISTORY_MESSAGE_CACHE=1' | sudo tee -a "$ENV"
echo 'CACHE_TTL_MESSAGES_SEC=120' | sudo tee -a "$ENV"
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV" restart nova
```

## 打包侧配置清单

| 文件 | 内容 |
|------|------|
| [`deploy/env.example`](../deploy/env.example) | 三阶段 env 注释模板 |
| [`scripts/release/pack.mjs`](../scripts/release/pack.mjs) | `deploy.env` 默认 `SANITIZE=1`；`MANIFEST.json` → `historyMessagesAccel`；`DEPLOY.md` 更新记录 |
| [`scripts/release/verify-cloud-perf.sh`](../scripts/release/verify-cloud-perf.sh) | 容器内 flag 抽检 |
| [`deploy/env.local`](../deploy/env.local) | 本机打包源（复制 example 后按需填写） |

## 回滚

```bash
PILOTDECK_HISTORY_SANITIZE=0
PILOTDECK_HISTORY_TAIL_READ=0
PILOTDECK_HISTORY_MESSAGE_CACHE=0
docker compose restart nova
```

JSONL 存储**不变**；仅读路径投影层回退。

## 相关 npm 脚本

| 命令 | 用途 |
|------|------|
| `npm run test:history-messages:quick` | PR / 发版前单测门禁 |
| `npm run test:cloud:chat-load` | 生产 API 诊断（nightly / 发版后） |
| `node scripts/check-history-message-flags.mjs` | 本地 effective flag 打印 |
