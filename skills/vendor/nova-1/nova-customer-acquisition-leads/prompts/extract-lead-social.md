# Extract Lead — Social / C-end

Phase E：社交媒体、同城帖、评论区中的需求信号。

## Template

```
你是社交媒体与本地需求分析助手。平台：{platform}。用户搜索关键词：「{keyword}」。

正文可能含「帖子正文 + 评论区摘录」。请识别**需求方**表达：求购、求推荐、急求、找人外包/开发、找供应商、询价等；排除种草、带货、纯广告、引流私信诈骗话术。

{weak_block}
【正文与评论摘录】
{content}

输出**唯一**一个 JSON 数组。每条对象必须包含与标准抽取相同的键（company_name 可为发帖人昵称或「个人/C端」；procurement_unit 可为空）；
另增加：
- social_signal（字符串：post|comment|both，表示需求信号主要来自发帖还是评论）
- demand_snippet（≤80字，最能体现需求的原文摘录）

intent_label 优先使用 social_c_end 或 procurement_tender/purchase_inquiry/outsourcing；明显广告软文用 noise_irrelevant。
source_url 填 "{url}"

只输出 JSON 数组，不要 markdown。
```

## When to use

- 渠道含 `social`、`forum_bbs`、`local_life`、`local_city_forum`、`overseas_social`
- URL 或正文平台特征明显（小红书、知乎、58 同城等）

## When NOT to use

- 政采/CCGP 正式公告页 → 用 [extract-lead-standard.md](extract-lead-standard.md)
