# Community whitepaper digest

> **Canonical whitepaper:** [https://www.novapage.online/en/docs/](https://www.novapage.online/en/docs/) · [中文](https://www.novapage.online/docs/)
>
> This file is a community-repo overlay, not a second product. Do not invent metrics or customers. Official chapters 6, 8, 9, 10 (team, enterprise security, landing guide, architecture) stay on the official site — do not claim they ship when you clone this repo.

Machine-readable summary: [llms.txt](https://www.novapage.online/llms.txt)

## 1. What Nova is

Nova Ai-Studio 2.0 is an AI project-delivery platform for companies and teams: an enterprise Agent that finishes work.

Goal-Loop: **listen → analyze → set targets → produce → accept.** Acceptance is a file checklist, not a verbal “done”.

Smart routing: light steps on small models, hard steps on flagship models. Official tests: on typical multi-step jobs with routing + a model pool, token cost can drop by up to about 70% vs all-flagship; some heavy orchestrations around 1/6. **Upper-bound wording, not an SLA.** Cite [claims](https://www.novapage.online/claims/).

The hosted product is browser-only, supports teams, and can stay inside a customer network. **This GitHub cut does not:** zero-install SaaS, multi-user sharing, or the commercial Docker private-pack. It keeps the same engine, Hub, deliverable checklist, and Goal-Loop workbench for one local admin.

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
