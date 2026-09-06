# best-aeo-skill

> The best AEO/GEO skill for Claude Code. Audit, fix, and monitor your website's visibility across ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews. 100+ optimization techniques, 33 evidence collectors, 4-vector composite GEO Score. Built on the peer-reviewed Princeton KDD 2024 paper. Free, MIT-licensed.

[![GEO Score](https://img.shields.io/badge/GEO_Score-96%2F100-E23E1E?style=flat-square)](https://bestaeoskill.com)
[![License](https://img.shields.io/badge/license-MIT-0E0E0C?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-compatible-0E0E0C?style=flat-square)](https://claude.com/claude-code)
[![35+ agents](https://img.shields.io/badge/agents-35%2B-0E0E0C?style=flat-square)](#supported-agents)
[![Princeton KDD 2024](https://img.shields.io/badge/research-Princeton_KDD_2024-0E0E0C?style=flat-square)](https://arxiv.org/abs/2311.09735)

---

**best-aeo-skill** is an open-source Claude Code skill that measures and improves how your website is cited by AI search engines. It runs 33 evidence collectors against any URL, computes a 0–100 composite GEO Score across 4 weighted vectors (Technical Accessibility, Content Citability, Structured Data, Entity Signals), labels every finding with a Confidence rubric (Confirmed / Likely / Hypothesis), and applies one-command fixes to `llms.txt`, `robots.txt`, JSON-LD schema, and on-page content. It runs locally with zero external API dependencies.

## Table of contents

- [Why this matters in 2026](#why-this-matters-in-2026)
- [Quickstart](#quickstart)
- [How it works](#how-it-works)
- [What is GEO? What is AEO?](#what-is-geo-what-is-aeo)
- [Compared to alternatives](#compared-to-alternatives)
- [What's inside the repo](#whats-inside-the-repo)
- [Research basis](#research-basis)
- [FAQ](#faq)
- [Citation (academic)](#citation-academic)
- [Credits & attribution](#credits--attribution)
- [Supported agents](#supported-agents)
- [License](#license)

---

## Why this matters in 2026

In May 2026:

- **25.11%** of Google searches trigger an AI Overview ([Semrush AI Overviews tracker, Q1 2026](https://www.semrush.com/blog/ai-overviews-study/))
- **87%** of AI-referral traffic to publishers flows through **ChatGPT** alone ([Similarweb, March 2026](https://www.similarweb.com/blog/insights/ai-news/chatgpt-traffic-share/))
- AI traffic converts at **14.2%** vs **2.8%** for traditional organic — **5.07× higher** ([Adobe Digital Insights, 2026 AI Commerce Report](https://business.adobe.com/blog/perspectives/generative-ai-traffic-converts-better))
- **62%** of B2B SaaS buyers now start product research in an AI assistant before Google ([Gartner CMO Survey, 2026](https://www.gartner.com/en/marketing/research/cmo-spend-survey))

The companies that get cited by AI engines win. The ones that get filtered out lose 100% of that traffic — there is no "page 2" of an AI answer.

Existing GEO/AEO Claude skills each solve part of the problem. **best-aeo-skill** combines the strongest features of the top 5 open-source predecessors into one production-ready skill.

## Quickstart

### Install in Claude Code

```bash
/plugin marketplace add metawhisp/best-aeo-skill
/plugin install best-aeo-skill
```

### Install in Cursor, Codex, or 35+ other agents

```bash
npx skills add metawhisp/best-aeo-skill
```

### Install manually (any agent or standalone)

```bash
git clone https://github.com/metawhisp/best-aeo-skill.git ~/.claude/skills/best-aeo-skill
```

### First audit (60 seconds)

```
> Run a full GEO audit on https://yoursite.com
```

You get a **0–100 GEO Score**, ranked findings with **Confidence labels** (Confirmed / Likely / Hypothesis), and a one-command auto-fix path.

### Apply fixes

```bash
bestaeo fix --url https://yoursite.com --apply
```

Auto-generates `llms.txt`, JSON-LD schema, content rewrites, and `robots.txt` patches.

### Try the live web audit (no install)

[bestaeoskill.com/audit](https://bestaeoskill.com/audit/) — the same engine running on Cloudflare Workers.

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│                      best-aeo-skill                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CLI ──→ ┌─ audit ──┐ ┌─ fix ──────┐ ┌─ monitor ─┐             │
│         │ +score   │ │ +rewrite   │ │ +regress  │              │
│         └─────┬────┘ └──────┬─────┘ └─────┬─────┘              │
│               │             │             │                     │
│               ▼             ▼             ▼                     │
│  ┌──────────────────────────────────────────────────────┐      │
│  │           Composite GEO Scorer (4 vectors)            │      │
│  │  Technical 20% │ Citability 35% │ Schema 20% │ E. 25% │      │
│  └────────────────────────┬─────────────────────────────┘      │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              ▼            ▼            ▼                        │
│       33 evidence    5 specialist   4 frameworks                │
│         collectors      agents      (CORE-EEAT,                 │
│        (Python)      (parallel)      CITE, Princeton, AutoGEO)  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Step 1 — Audit.** 33 evidence collectors run in parallel: page fetch, `robots.txt`, AI bot access matrix (23 bots: GPTBot, ClaudeBot, PerplexityBot, etc.), JSON-LD schema validation, statistic density, citation analysis, quote extraction, freshness, `llms.txt` presence, entity & author markup, and 22 more.

**Step 2 — Score.** Findings feed a 4-vector composite scorer derived from the [Princeton KDD 2024 paper on Generative Engine Optimization](https://arxiv.org/abs/2311.09735). Default weights: Technical 20% / Citability 35% / Schema 20% / Entity 25%. Weights are profile-adaptive (SaaS, e-commerce, publisher, local, agency, devtools, academic).

**Step 3 — Fix.** `bestaeo fix --apply` writes structured changes:

| Fix | What it does |
|---|---|
| `fix-llmstxt` | Generates `/llms.txt` and `/llms-full.txt` from sitemap + content |
| `fix-robotstxt` | Adds 27 explicit `Allow` directives for AI bots |
| `fix-schema` | Emits JSON-LD: SoftwareApplication, FAQPage, Article, Organization, Author |
| `fix-content` | Adds inline citations, statistics, quotes, author bylines |

**Step 4 — Monitor.** Re-audit on a schedule, track GEO Score deltas, alert on regressions, compare to competitors.

## What is GEO? What is AEO?

**Generative Engine Optimization (GEO)** is the practice of optimizing web content so it gets cited and quoted by generative AI engines (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) when they answer user queries. The term and methodology were introduced in the peer-reviewed paper *"GEO: Generative Engine Optimization"* (Aggarwal et al., KDD 2024).

**Answer Engine Optimization (AEO)** is the practice of structuring content so it can be extracted as a direct answer by question-answering systems — featured snippets, voice assistants, and AI Overviews. AEO predates GEO (the term traces to 2018) but the two now overlap heavily; the industry uses them interchangeably.

**Difference vs traditional SEO:** SEO optimizes for ranked link lists. GEO/AEO optimizes for being cited inside an answer. The optimization signals are different: AI engines weight statistical density, authoritative external citations, structured data, entity consistency, and direct-answer phrasing far more heavily than backlinks or anchor-text variety.

## Compared to alternatives

|  | best-aeo-skill | claude-seo | seo-geo-claude-skills | geo-optimizer-skill | Agentic-SEO-Skill |
|---|----------------|------------|----------------------|---------------------|-------------------|
| Composite GEO Score (0–100) | **✓ 4-vector** | ✓ | partial | ✓ | partial |
| Confidence labels (Confirmed/Likely/Hypothesis) | **✓ unique** | ✗ | ✗ | ✗ | ✓ |
| Princeton KDD 2024 framework | **✓ full** | partial | partial | ✓ | partial |
| Auto-fix (`fix --apply`) | **✓** | partial | partial | ✓ | ✗ |
| Multi-engine scoring (ChatGPT, Claude, Perplexity, Gemini, AIO) | **✓** | ✓ | ✓ | ✓ | ✓ |
| MCP server | ✓ | ✓ | ✓ | ✓ | ✗ |
| Adaptive vector weights (per business profile) | **✓** | partial | ✗ | partial | ✗ |
| `llms.txt` generation | ✓ | ✓ | ✓ | ✓ | ✓ |
| 35+ agent compatibility (npx skills) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zero external dependencies | **✓** | ✗ | ✓ | partial | partial |
| Live web audit (no install) | **✓** | ✗ | ✗ | ✗ | ✗ |

[Full feature matrix → bestaeoskill.com/skill](https://bestaeoskill.com/skill)

## What's inside the repo

```
best-aeo-skill/
├── SKILL.md                    Main manifest (skill entry point, 874 lines)
├── README.md                   Public-facing docs (you are here)
├── LICENSE                     MIT
│
├── skills/                     7 sub-skills
│   ├── audit/SKILL.md
│   ├── fix-content/SKILL.md
│   ├── fix-schema/SKILL.md
│   ├── fix-llmstxt/SKILL.md
│   ├── fix-robotstxt/SKILL.md
│   ├── compare/SKILL.md
│   └── monitor/SKILL.md
│
├── agents/                     5 specialist agents (run in parallel)
│   ├── technical.md
│   ├── citability.md
│   ├── schema.md
│   ├── entity.md
│   └── monitor.md
│
├── scripts/                    33 evidence collectors (Python, zero deps)
│   ├── audit.py                ─ orchestrator
│   ├── composite_scorer.py     ─ 4-vector composite
│   ├── fetch_page.py           ─ page fetch + canonicalization
│   ├── robots_check.py         ─ robots.txt parser
│   ├── ai_bot_access.py        ─ 23-bot allow/block matrix
│   ├── schema_validate.py      ─ JSON-LD validator
│   ├── statistic_density.py    ─ stats/100w detector
│   ├── citation_check.py       ─ external/internal/authoritative
│   ├── quote_extractor.py      ─ direct-quote finder
│   ├── freshness_check.py      ─ Article.dateModified parser
│   ├── llms_txt_check.py       ─ llms.txt presence + spec compliance
│   ├── llms_txt_generate.py    ─ auto-generates llms.txt
│   ├── entity_extractor.py     ─ Organization, Person, sameAs
│   └── ... (33 total)
│
├── frameworks/                 4 reference frameworks
│   ├── core-eeat.md            80-item content quality benchmark
│   ├── cite.md                 40-item authority benchmark
│   ├── confidence-labels.md    Evidence rubric
│   └── princeton-kdd-2024.md   Research basis
│
├── templates/                  Output templates
│   ├── audit-report.md
│   ├── llms.txt.tmpl
│   └── schema/                 (FAQPage, Article, Organization, etc.)
│
├── examples/                   Sample audits and fixes
│
└── docs/
    ├── installation.md
    ├── methodology.md          (skill-by-skill attribution)
    └── architecture.md
```

## Research basis

This skill is built on peer-reviewed and industry-validated research:

1. **GEO: Generative Engine Optimization** — Aggarwal et al., **KDD 2024** ([arXiv:2311.09735](https://arxiv.org/abs/2311.09735))
   *9 optimization methods tested across 10k queries. Citation likelihood lifts: +40% from authoritative quotation, +115% from inline source citation, +30–40% from statistic density.*

2. **AutoGEO: Automatic Generative Engine Optimization** — ICLR 2026 ([arXiv:2502.13392](https://arxiv.org/abs/2502.13392))
   *Automatic rule extraction beats human-engineered rules by +50.99% over the Princeton baseline.*

3. **C-SEO Bench: Conversational SEO Benchmark** — 2025 ([arXiv:2506.11097](https://arxiv.org/abs/2506.11097))
   *Confirms infrastructure (schema, llms.txt, robots.txt) outranks prose tweaks for citation rate.*

4. **Google's E-E-A-T framework** — December 2025 update ([Search Quality Rater Guidelines, v2025.12](https://developers.google.com/search/docs/fundamentals/creating-helpful-content))
   *Experience-Expertise-Authoritativeness-Trustworthiness now applies to all competitive queries, not just YMYL.*

[Full research deep-dive → bestaeoskill.com/research](https://bestaeoskill.com/research)

## FAQ

### How does best-aeo-skill differ from a traditional SEO tool like Ahrefs or Semrush?

Traditional SEO tools optimize for **ranked link lists** (10 blue links). best-aeo-skill optimizes for **citations inside an AI-generated answer**. The signals are different: AI engines weight statistical density, authoritative external citations, structured data, entity consistency, and direct-answer phrasing far more heavily than backlinks or anchor variety. Use both — they are complementary, not substitutes.

### Is this free? Do I need an API key?

Yes, free under MIT. **No API key required.** The audit runs entirely locally using Python's standard library — no external services, no telemetry, no rate limits. The optional MCP server is also local-only.

### Which AI search engines does it score against?

ChatGPT (OpenAI), Claude (Anthropic), Perplexity, Google Gemini, Google AI Overviews, Microsoft Copilot, You.com, and Brave Search. Each engine has a profile of weighted signals; the composite GEO Score is a weighted average across all eight, configurable per use case.

### How accurate is the GEO Score?

The score is grounded in **direct evidence** (HTTP responses, parsed HTML, validated JSON-LD) — not LLM judgment. Every finding carries a Confidence label: **Confirmed** = directly observed by a collector, **Likely** = inferred from 2+ collectors, **Hypothesis** = LLM judgment, flagged for human review. No recommendation appears without a label.

### What does `bestaeo fix --apply` actually change on my site?

It writes four artifacts: (1) `/llms.txt` and `/llms-full.txt` derived from your sitemap, (2) updated `/robots.txt` with 27 explicit `Allow:` directives for AI bots, (3) JSON-LD schema blocks (SoftwareApplication, FAQPage, Article, Organization, Person), and (4) inline content additions — citations, statistics, author bylines — emitted as a unified diff for your review. **Nothing is pushed without confirmation.**

### Does it work outside Claude Code?

Yes. Three install paths: (1) Claude Code via `/plugin install`, (2) Cursor, Codex, OpenCode, OpenClaw, Gemini CLI, Qwen Code, Amp, Kimi, CodeBuddy, Windsurf, and 25+ others via `npx skills add`, (3) manual via `git clone` for any agent that reads SKILL.md. There is also a [browser-based audit](https://bestaeoskill.com/audit/) running on Cloudflare Workers that requires no install.

### How long does a full audit take?

**~1–2 seconds** per page on Cloudflare Workers. **~3–5 seconds** locally on a typical laptop (zero deps means no JIT warm-up). A site-wide audit of 100 pages: ~2 minutes locally.

### How is this different from `claude-seo` (5.8k ⭐) or other existing skills?

`claude-seo` is comprehensive but fragmented — 12 agents with overlapping responsibilities. `seo-geo-claude-skills` has good multi-platform reach but generic scoring. `geo-optimizer-skill` has Princeton depth but limited fix actions. `Agentic-SEO-Skill` introduced confidence labels but has narrow scope. `best-aeo-skill` integrates the strongest piece from each into a single skill — see the [comparison table above](#compared-to-alternatives) and the per-technique attribution in [`docs/methodology.md`](docs/methodology.md).

## Citation (academic)

If this skill helps your research or industry report, please cite it:

```bibtex
@software{bestaeoskill_2026,
  author       = {MetaWhisp},
  title        = {best-aeo-skill: A Composite GEO/AEO Optimizer for Claude Code},
  year         = {2026},
  url          = {https://github.com/metawhisp/best-aeo-skill},
  note         = {MIT License}
}
```

For citing the underlying methodology, please cite the [Princeton KDD 2024 paper](https://arxiv.org/abs/2311.09735) directly.

## Credits & attribution

Each technique in this skill is traceable to its origin. Full per-rule attribution: [`docs/methodology.md`](docs/methodology.md).

| Inspired by | Took |
|-------------|------|
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (5.8k ⭐) | Multi-extension architecture, 12-agent parallelism |
| [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) | CORE-EEAT (80-item) + CITE (40-item) frameworks |
| [Bhanunamikaze/Agentic-SEO-Skill](https://github.com/Bhanunamikaze/Agentic-SEO-Skill) | Confidence labels, 33 evidence collectors |
| [Auriti-Labs/geo-optimizer-skill](https://github.com/Auriti-Labs/geo-optimizer-skill) | Princeton KDD framework, MCP server, 47 methods |
| [199-biotechnologies/claude-skill-seo-geo-optimizer](https://github.com/199-biotechnologies/claude-skill-seo-geo-optimizer) | IndexNow, freshness monitoring, entity extraction |

## Supported agents

Claude Code · Cursor · Codex CLI · OpenCode · OpenClaw · Gemini CLI · Qwen Code · Amp · Kimi · CodeBuddy · Windsurf · Continue · Aider · Cline · Roo Code · Devin · 35+ via [npx-skills protocol](https://github.com/skills-protocol).

## License

[MIT](LICENSE) — use, fork, ship. Star ⭐ if it helps. Issues and PRs welcome.

---

*Built and maintained by [bestaeoskill.com](https://bestaeoskill.com) · [Documentation](https://bestaeoskill.com/skill) · [Live audit](https://bestaeoskill.com/audit/) · [Research](https://bestaeoskill.com/research) · [FAQ](https://bestaeoskill.com/faq)*
