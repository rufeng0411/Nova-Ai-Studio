# 常见问题

完整 FAQ 以官网为准：[https://www.novapage.online/faq/](https://www.novapage.online/faq/)

## 官网和这个 GitHub 是什么关系？

**Nova Ai-Studio** 是同一个产品。官网是企业级 SaaS / 私有化主入口。本仓是 AGPL 社区版：同一套工作台内核，裁成单管理员本机跑。

## 为什么还要登录？

社区版保留 SaaS 内核（成果清单、Hub）。免登录的 `dev:standalone` 不是本仓黄金路径。

## 为什么没有注册？

个人版只有一个 `admin`。注册接口返回 403。要多人账号请走官网（注册需邀请码，见官网说明）。

## 健康检查是哪个？

Bridge：`/api/saas/health` 与 `/api/saas/health/ready`。不是另一个产品的 `:8000/healthz`。

## 为什么看不到 N2 Bot？

社区版关掉工作台左下角 N2 Bot 入口。请用普通对话和 Hub。

## Token 一定省 70% 吗？

不是保证。官网口径是典型多步骤任务、相对全程旗舰直打的**最高约**七成，场景依赖。详见 [claims](https://www.novapage.online/claims/)。

## 和 Dify / FastGPT / Coze 怎么比？

用官网写好的对比，不要用本仓另写一版：[faq/#q-compare](https://www.novapage.online/faq/#q-compare)。

## 为什么是 AGPL？

通过网络提供服务时需要开放对应源码。见 LICENSE。

## 消歧

与 Amazon Nova、Nova Act 无关。域名品牌别名含 NovaPage。
