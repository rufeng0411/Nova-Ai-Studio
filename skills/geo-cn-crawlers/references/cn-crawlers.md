# 国内 AI 爬虫 User-Agent 参考

| 平台 | 常见 UA / Bot 名 |
|------|------------------|
| 字节 / 豆包 | Bytespider |
| 百度 | Baiduspider |
| 阿里 / 通义 | AliBot、Tongyi |
| 腾讯 | TencentTraveler |
| OpenAI | GPTBot、ChatGPT-User |
| Google | Google-Extended |

## robots.txt 建议

- 勿全局 Disallow `/` 对以上 bot（除非合规要求）
- 对 `/admin`、`/api` 可 Disallow
- 提供 `Sitemap:` 行

## llms.txt

根路径 `/llms.txt`，Markdown 列表形式列出可引用 URL 与摘要。
