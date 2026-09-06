# 常见问题

## 这个仓库能干什么？

本机跑 Nova Ai-Studio 工作台：对话交出文件，Hub + 模板 + 清单验收。AGPL 社区版，单人自托管。

## 和 ChatGPT 网页版有什么不同？

聊天擅长把话说顺。这里把一轮需求收成可打开的报告 / PPT / 页面，并对照成果清单，Key 留在你机器上。

## 和 Dify / FastGPT / Coze 怎么选？

官网有一张企业向对照表：[FAQ · 选型](https://www.novapage.online/faq/#q-compare)。社区版额外多一条：源码在你手里，数据默认在本机 SQLite。

一句话仍用官网的口径：**Nova 用对话交付整个项目——产出可验收文件，而不是留下一串聊天记录。** 若你要搭工作流 / 知识库 / 渠道 Bot，那些工具各有所长；若你要「听懂需求 → 写好成果 → 严验收」，看本仓。

## 为什么还要登录？

工作台要挂成果清单和 Hub。免登录的 `dev:standalone` 不是本仓黄金路径。账号就是一个 `admin`。

## 为什么没有注册？

社区版按单人裁的。要团队账号走官网合作入口。

## 健康检查是哪个？

Bridge：`/api/saas/health` 与 `/api/saas/health/ready`。不是另一个产品的 `:8000/healthz`。

## 为什么看不到 N2 Bot？

社区版关掉工作台左下角入口。请用普通对话和 Hub。

## Token 一定省 70% 吗？

不是保证。口径是典型多步骤任务、相对全程旗舰直打的**最高约**七成，场景依赖。详见 [claims](https://www.novapage.online/claims/)。

## 为什么是 AGPL？

通过网络提供服务时需要开放对应源码。见 LICENSE。

## 消歧

与 Amazon Nova、Nova Act 无关。

产品介绍与演示也可以看官网 [novapage.online](https://www.novapage.online/faq/)。
