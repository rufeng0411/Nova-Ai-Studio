# FAQ

Canonical FAQ: [https://www.novapage.online/faq/](https://www.novapage.online/faq/)

## Official site vs this GitHub repo?

Same product. The site is hosted SaaS / private deploy. This repo is the AGPL community cut: one local admin, same workbench kernel.

## Why login?

The community cut keeps the SaaS kernel (deliverables, Hub). `dev:standalone` is not the golden path.

## Why no register?

One `admin`. `POST /api/auth/register` returns 403. Multi-user accounts belong on the official site (invite-gated, per the site).

## Which health probe?

Bridge `/api/saas/health` and `/api/saas/health/ready`, not uvicorn `/healthz`.

## Where is N2 Bot?

Off in this cut. Use normal chat and the Hub.

## Is 70% token savings guaranteed?

No. Official wording is **up to about** 70% on typical multi-step jobs vs all-flagship, scenario-dependent. See [claims](https://www.novapage.online/claims/).

## vs Dify / FastGPT / Coze?

Use the official page: [faq/#q-compare](https://www.novapage.online/faq/#q-compare).

## Why AGPL?

Network use must keep corresponding source available. See LICENSE.

## Disambiguation

Unrelated to Amazon Nova / Nova Act. Domain alias includes NovaPage.
