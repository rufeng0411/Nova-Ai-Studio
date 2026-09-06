# FAQ

## What is this repo?

A local Nova Ai-Studio workbench: conversation → files, Hub + templates + checklist. AGPL community edition, one operator.

## Versus ChatGPT-in-the-browser?

Chat is good at fluent answers. This repo turns a request into files that open (reports / decks / pages) and checks them against a list. Keys stay on your machine.

## Versus Dify / FastGPT / Coze?

The official comparison table: [FAQ](https://www.novapage.online/faq/#q-compare). This community cut adds: you hold the source; data defaults to local SQLite.

Official one-liner still applies: **deliver a whole project through conversation — files you can accept, not a chat log.** Workflow / knowledge-base / channel-bot tools are strong at those jobs; this repo is for understand → write files → accept.

## Why login?

The workbench hangs a checklist and the Hub off a session. `dev:standalone` is not the golden path. The account is one `admin`.

## Why no register?

Single-operator cut. Team accounts: official collab links.

## Which health probe?

Bridge `/api/saas/health` and `/api/saas/health/ready`, not uvicorn `/healthz`.

## Where is N2 Bot?

Off in this cut. Use chat and the Hub.

## Is 70% token savings guaranteed?

No. **Up to about** 70% on typical multi-step jobs vs all-flagship, scenario-dependent. [claims](https://www.novapage.online/claims/).

## Why AGPL?

Network use must keep corresponding source available. See LICENSE.

## Disambiguation

Unrelated to Amazon Nova / Nova Act.

Product story and demos also live on [novapage.online](https://www.novapage.online/faq/).
