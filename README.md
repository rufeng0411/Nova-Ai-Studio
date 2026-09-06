# Nova Ai-Studio

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

<p align="center">
  <img src="assets/community/official/home-hero.png" width="920" alt="Nova Ai-Studio: deliver a whole project through conversation">
</p>

**AGPL community edition: run the Agent workbench on your own machine.** Speak in plain language. Get files you can open — not a chat log that evaporates.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rufeng0411/Nova-Ai-Studio)](https://github.com/rufeng0411/Nova-Ai-Studio/releases)

---

## What you get in this repo

Clone, install, sign in. You have a local workbench: Hub, workflow templates, a deliverable checklist, multi-format preview. You paste your own model keys. Data stays in SQLite next to the repo (`.saas-dev-data/`, gitignored).

The product line is simple: **deliver a whole project through conversation.**

Goal-Loop: listen → analyze → set targets → produce → accept. Acceptance is real files (reports, decks, pages, video), not a model saying “done”.

The name is **Nova Ai-Studio**. Unrelated to Amazon Nova / Nova Act. Office, research, marketing, GEO, creation, media, engineering, education — not “ads AI only”.

---

## Why clone this

- **Files are the handoff; chat is the process.** A screenshot of a transcript is not a project.
- **Keys and data stay on your box.** One `admin`, local SQLite. No default “ship the conversation to someone else’s SaaS”.
- **A workbench, not a prompt toy.** Browse the Hub after login; add keys and run a template.
- **Same public numbers as the product whitepaper** (do not turn them into guarantees):

| | Wording | Notes |
| --- | --- | --- |
| Capabilities | **400+** | Hub domains, not a flat skill dump |
| Templates | **35** | A starting conversation when you do not know the first sentence |
| Tokens | Up to about **70%** vs all-flagship; some heavy jobs about **1/6** | Scenario-dependent; [claims](https://www.novapage.online/claims/) |
| Preview | **40+** formats | SuperPreview against the checklist |
| Domains | **Eight** | Office, research, flywheel, GEO, creation, media, engineering, education |

More: [capabilities](docs/en/capabilities.md) · [whitepaper digest](docs/en/whitepaper.md)

---

## How it differs from tools you already have

Not a dunk list. Pick the right shape. The hosted-product comparison also lives on the official [FAQ](https://www.novapage.online/faq/#q-compare).

| You might be using | It is good at | This community repo is for |
| --- | --- | --- |
| ChatGPT / web chat | Fluent answers | Turning a conversation into files that open, with a checklist |
| Thin open-source prompt wrappers | Proving an API key works | Hub, templates, preview, acceptance — not one text box |
| Dify / FastGPT | DIY workflows, knowledge-base Q&A | “Understand the ask → write the files → accept against disk” rather than drawing nodes first |
| Coze and similar bot builders | Chat bots and channel distribution | Reports / decks / pages on disk, not a customer-service bot |
| Hosted chat that holds your keys | Zero install | When keys and deliverables must stay local |

This cut is one-operator self-host, `pnpm`, AGPL. Team accounts or hosted service: see the short collab note at the bottom.

---

## Install

Follow **[install](docs/en/install.md)** only.

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
cp .env.example .env
# set SAAS_ADMIN_PASSWORD (never the historic default)
corepack enable
pnpm install
pnpm run dev
```

Open the printed **Vite URL** (port may shift) → `/login` → `admin` → the workbench. Browse the Hub without keys; running a task needs keys in Admin.

Health: `GET /api/saas/health` and `GET /api/saas/health/ready` (Bridge port is printed at boot).

Do not use bare `npm install` (pnpm lockfile). Do not use `dev:standalone` as this path.

This cut is single-operator: no sign-up, no multi-user ops console, no workbench N2 Bot. Leftover control-plane code is not a feature promise.

---

## Docs

- [Install](docs/en/install.md)
- [User guide](docs/en/user-guide.md)
- [Product overview](docs/en/product.md)
- [Whitepaper digest](docs/en/whitepaper.md)
- [Capabilities](docs/en/capabilities.md)
- [Trust](docs/en/trust.md)
- [Configure](docs/en/configure.md)
- [Develop (config-level)](docs/en/develop.md)
- [FAQ](docs/en/faq.md)

---

## Official site and collab

Product story, demos, team / hosted options: [novapage.online](https://www.novapage.online/). Business: [contact](https://www.novapage.online/contact/) or WeChat **山君**:

<p align="center">
  <img src="assets/community/wechat-contact.png" width="280" alt="WeChat: 山君">
</p>

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE). Network use of a modified version requires corresponding source.
