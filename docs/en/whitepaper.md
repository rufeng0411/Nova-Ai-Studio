# Community whitepaper digest

> **Canonical whitepaper:** [https://www.novapage.online/en/docs/](https://www.novapage.online/en/docs/) · [中文](https://www.novapage.online/docs/)
>
> Numbers and wording for the community workbench. Team hosting and private-pack chapters stay on the official site.

Machine-readable summary: [llms.txt](https://www.novapage.online/llms.txt)

## 1. What Nova is

Nova Ai-Studio 2.0 is an Agent workbench that delivers project files through conversation. This community edition runs that workbench on your machine.

Goal-Loop: **listen → analyze → set targets → produce → accept.** Acceptance is a file checklist, not a verbal “done”.

Smart routing: light steps on small models, hard steps on flagship models. Official tests: on typical multi-step jobs with routing + a model pool, token cost can drop by up to about 70% vs all-flagship; some heavy orchestrations around 1/6. **Upper-bound wording, not an SLA.** Cite [claims](https://www.novapage.online/claims/).

This repo is one-operator self-host: `pnpm run dev`, one `admin`, data on disk. Templates and the Hub cover “I do not know the first sentence.” Team accounts or hosted options: official site.

## 2. What it can produce

Speak a task; get previewable files. Official scale: **400+** capabilities, **35** templates, up to ~**70%** token savings, **40+** preview formats, **eight** domains (office, research, flywheel, GEO, creation, media, engineering, education).

Example asks in the official whitepaper include industry research packs, editable PPT, brand campaigns, GEO audits, multi-platform copy, and short promo video. The community Hub shows the same cards; **without your model keys they will not fully run.** Team handoff packs are an official-site capability.

## 3. Acceptance (SuperPreview)

Official ch. 7: freeze a deliverable list; preview 40+ formats. The community workbench uses the same checklist/preview kernel.

## 4. Install

Only [install.md](install.md). Do not copy “just open the browser” from the SaaS story.

## 5. Trust

Community data defaults to `.saas-dev-data/` beside the repo, JWT, one admin. Tenant isolation and private deploy: official ch. 8–9 and [trust.md](trust.md).

## 6. Comparisons

Use the official FAQ: [novapage.online/faq/#q-compare](https://www.novapage.online/faq/#q-compare). Whitepaper ch. 11 is on the site, not rewritten here.
