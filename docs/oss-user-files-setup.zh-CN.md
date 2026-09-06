# 用户文件 OSS 配置（傻瓜式）

适用：**东京 ECS** 跑 Nova，**北京 OSS** 存用户对话产物（PPT/PDF/视频/图片），大陆用户预览走 OSS 直链。

示例桶名：`nova-2-oss-0622`

---

## 第 1 步：OSS 控制台确认桶

1. 打开 [OSS 控制台](https://oss.console.aliyun.com/)
2. 选中 **`nova-2-oss-0622`**
3. 确认 **地域 = 华北2（北京）**
4. **读写权限 = 私有**

记下：

```
桶名：nova-2-oss-0622
Endpoint：oss-cn-beijing.aliyuncs.com
```

---

## 第 2 步：RAM 子账号 + AccessKey

1. [RAM 控制台](https://ram.console.aliyun.com/) → **用户** → **创建用户** `nova-ecs-oss`
2. 勾选 **OpenAPI 调用访问**
3. 授权 **AliyunOSSFullAccess**（或自定义仅 `nova-2-oss-0622`）
4. 创建 **AccessKey**，保存 ID 和 Secret（只显示一次）

---

## 第 3 步：OSS 跨域 CORS（必做）

浏览器通过预签名 URL 拉 PDF/视频时需要 CORS。

1. OSS 控制台 → `nova-2-oss-0622` → **数据安全** → **跨域设置** → **创建规则**
2. 填写：

| 项 | 值 |
|----|-----|
| 来源 | `https://www.novapage.online`（换成你的域名；本地调试可加 `http://127.0.0.1:5173`） |
| Methods | GET, HEAD |
| Allow-Headers | `*` |
| 暴露 Headers | `ETag, Content-Length, Content-Type` |

---

## 第 4 步：东京 ECS 测连通

SSH 登录 ECS 后：

```bash
# 安装 ossutil（若未装）
curl -o ossutil https://gosspublic.alicdn.com/ossutil/1.7.19/ossutil-v1.7.19-linux-amd64
chmod +x ossutil && sudo mv ossutil /usr/local/bin/ossutil

ossutil config
# endpoint: oss-cn-beijing.aliyuncs.com
# 填 RAM 的 AccessKey
```

测试：

```bash
echo ok > /tmp/t.txt
ossutil cp /tmp/t.txt oss://nova-2-oss-0622/nova-user-files/_test/t.txt
ossutil sign oss://nova-2-oss-0622/nova-user-files/_test/t.txt --timeout 900
```

把 sign 输出的链接在**大陆手机浏览器**打开，能下载即通过。

---

## 第 5 步：写入 ECS 环境变量

编辑 **`/opt/nova-ai-studio/.env`**，追加：

```env
# 用户文件 OSS（北京桶）
SAAS_OSS_ENABLED=1
SAAS_OSS_BUCKET=nova-2-oss-0622
SAAS_OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
SAAS_OSS_REGION=oss-cn-beijing
SAAS_OSS_PREFIX=nova-user-files
SAAS_OSS_ACCESS_KEY_ID=你的AccessKeyId
SAAS_OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
SAAS_OSS_SIGNED_URL_TTL_SEC=900
# 可选：仅大于 512KB 的文件走 OSS（小 md 仍走 ECS）
# SAAS_OSS_MIN_BYTES=524288
```

权限：

```bash
sudo chmod 600 /opt/nova-ai-studio/.env
```

---

## 第 6 步：发版并重启

本机打好包并升级 ECS（与日常发版相同），或直接在 ECS 拉最新代码后：

```bash
cd /opt/nova-ai-studio/current
sudo docker compose --env-file /opt/nova-ai-studio/.env build nova
sudo docker compose --env-file /opt/nova-ai-studio/.env up -d nova
```

---

## 第 7 步：迁移已有文件到 OSS

在 ECS 容器内或安装目录执行：

```bash
cd /opt/nova-ai-studio/current
sudo docker compose --env-file /opt/nova-ai-studio/.env exec nova \
  node scripts/migrate-cloud-storage-to-oss.mjs
```

或在登录后调用 API（会自动 mirror 当前用户目录）：

```http
POST /api/saas/storage/reconcile
Authorization: Bearer <token>
```

---

## 第 8 步：验收

1. 登录 Nova → 打开一份 **PPT/PDF** 成果预览
2. 浏览器开发者工具 → **Network**
3. 应看到 `/files/content` 返回 **302**，跳转到 `nova-2-oss-0622.oss-cn-beijing.aliyuncs.com`
4. 大陆网络下打开明显快于以前经东京 ECS 整包下载

查看 OSS 控制台 → `nova-2-oss-0622` → `nova-user-files/tenants/...` 应有文件。

---

## 工作原理（简）

```
Agent 写文件 → 东京 ECS 本地盘（cloud-storage）
用户点预览   → Bridge 鉴权 → 若 OSS 无则上传 → 302 预签名 URL → 北京 OSS → 大陆用户
```

本地盘仍保留（Agent 无需改）；OSS 为 **读加速层**。

---

## 常见问题

**Q：发版包 OSS 和用户文件 OSS 要分开吗？**  
可以同一个桶：`nova-ai-studio/` 发版，`nova-user-files/` 用户文件。

**Q：`SAAS_OSS_ENABLED=0` 会怎样？**  
完全走原来的 ECS 本地流，不影响现有功能。

**Q：预览 HTML 页面呢？**  
HTML 仍走 `/preview/` 本地流（保证相对路径 CSS/JS）；PPT/PDF/视频/图片走 `/files/content` → OSS。

**Q：AccessKey 泄露？**  
RAM 禁用旧 Key → 换新 → 更新 `.env` → 重启容器。

---

## 相关代码

| 文件 | 作用 |
|------|------|
| `ui/server/saas/storage/ossConfig.js` | 环境变量与路径映射 |
| `ui/server/saas/storage/ossObjectStorage.js` | 上传 + 预签名 |
| `ui/server/utils/serveProjectBinary.js` | `/files/content` 302 或本地 fallback |
| `scripts/migrate-cloud-storage-to-oss.mjs` | 存量迁移 |

验收：`npm run test:saas:oss`
