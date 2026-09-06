# 配置

只改环境变量和后台表单，不需要读系统架构。

## `.env`

见仓库根目录 `.env.example`。必填 `SAAS_ADMIN_PASSWORD`。社区开关：

- `PILOTDECK_COMMUNITY_PERSONAL=1`
- `PILOTDECK_SAAS_MODE=1`
- `PILOTDECK_MARKETING_SITE=0`
- `PILOTDECK_REGISTER_INVITE_CODE=0`
- `DEV_SAAS_SQLITE=1`

## 模型 Key

在后台「平台配置 → 服务 → 模型」填写。不要把真实 Key 写进 README 或提交 `.env`。

## 端口

启动器会探测空闲端口：Bridge / Express 常见 3001，Vite 常见 5173。以终端打印为准。

## 回滚到商用树行为

不要改商用源。在工厂仓库重新 `organize.py` 即可得到未 overlay 的拷贝。
