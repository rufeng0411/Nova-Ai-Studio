# SaaS 计划前程序还原点

> 在 SaaS Phase -1 开工前创建，用于大改失败时一键回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/pre-saas-2026-06-06` |
| **提交** | `3ca4dea`（`3ca4deae3c9e3737e075b87d344c8a0e80658a42`） |
| **分支** | `checkpoint/pre-saas-baseline`（沿用） |
| **说明** | Phase -1 开工前基线：Nova 品牌守护、上游合并后 WIP（chat-v2、成果预览、Playwright 脚手架等） |

> 旧标签 `restore-point/pre-saas-2026-06-02` 已过时，请勿再用于回退。

当前提交哈希：`git rev-parse restore-point/pre-saas-2026-06-06`

## SaaS v2.1 完成检查点

| 项 | 值 |
|----|-----|
| **标签** | `checkpoint/post-saas-v2.1` |
| **说明** | Phase -1～3 + 深度测试 + L5 验收全绿 |
| **完成说明** | `docs/saas-v2.1-completion.md` |

```bash
git show checkpoint/post-saas-v2.1 --no-patch --format="%H %s %ci"
```

## 如何还原

### 仅查看（ detached HEAD ）

```bash
git fetch --tags
git checkout restore-point/pre-saas-2026-06-06
```

### 在当前工作区硬回退（会丢弃未提交改动）

```bash
git fetch --tags
git reset --hard restore-point/pre-saas-2026-06-06
```

### 从还原点开新分支继续实验

```bash
git checkout -b my-experiment restore-point/pre-saas-2026-06-06
```

### 只还原某个文件

```bash
git checkout restore-point/pre-saas-2026-06-06 -- path/to/file
```

## 还原点不包含

- `~/.pilotdeck/` 全局配置与本地数据库
- 未纳入 git 的 `.env` / API Key
- 各项目 `projects/` 下运行时产物

回退代码后若行为仍异常，请对照 `docs/saas-preflight-baseline.md` 或本机备份。

## 验证还原点存在

```bash
git show restore-point/pre-saas-2026-06-06 --no-patch --format="%H %s %ci"
git branch -v | findstr checkpoint/pre-saas-baseline
```
