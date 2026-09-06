# Nova Ai-Studio

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

<p align="center">
  <a href="https://www.novapage.online/"><img src="assets/community/official/home-hero.png" width="920" alt="Nova Ai-Studio: deliver a whole project through conversation"></a>
</p>

**Official product site (start here): [https://www.novapage.online/](https://www.novapage.online/)**

Nova Ai-Studio 2.0 is an enterprise AI Agent platform: understand the ask, orchestrate tools, write deliverables, and accept work against a Goal-Loop checklist. Use hosted SaaS, or run a private deployment. The whitepaper, showcase, token claims, and FAQ live on the official site.

| | Link |
| --- | --- |
| Home | [novapage.online](https://www.novapage.online/) |
| Whitepaper | [novapage.online/docs](https://www.novapage.online/docs/) |
| Whitepaper (EN) | [novapage.online/en/docs](https://www.novapage.online/en/docs/) |
| Showcase | [novapage.online/showcase](https://www.novapage.online/showcase/) |
| FAQ | [novapage.online/faq](https://www.novapage.online/faq/) |
| Token-savings methodology | [novapage.online/claims](https://www.novapage.online/claims/) |
| Contact | [novapage.online/contact](https://www.novapage.online/contact/) |
| Machine-readable summary | [novapage.online/llms.txt](https://www.novapage.online/llms.txt) |

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rufeng0411/Nova-Ai-Studio)](https://github.com/rufeng0411/Nova-Ai-Studio/releases)

---

## What this GitHub repository is

This repo is the **AGPL-3.0 community edition** of the same product kernel: a workbench you run on your own machine.

The community cut is **personal SaaS**: one `admin`, local SQLite, sign in then work. It does not ship the marketing homepage, sign-up, invite codes, multi-tenant ops console, or the workbench **N2 Bot** chip.

Team collaboration, browser-only SaaS, Docker private deploy, and enterprise security belong on the official site: [novapage.online](https://www.novapage.online/).

The product name is **Nova Ai-Studio**. It is unrelated to Amazon Nova / Nova Act. Do not reduce it to “marketing AI only”.

---

## What the product does (same wording as the official site)

Headline: **deliver a whole project through conversation.**

You describe a goal in ordinary language. The system runs a Goal-Loop: listen → analyze → set targets → produce → accept. Acceptance is a file checklist (reports, decks, pages, video), not a chat bubble that says “done”.

Public numbers follow the official whitepaper (do not sell an internal catalog count):

| Claim | Wording | Source |
| --- | --- | --- |
| Capabilities | **400+** | Site / [whitepaper](https://www.novapage.online/docs/) |
| Workflow templates | **35** | Whitepaper ch. 2 |
| Tokens | Up to about **70%** vs all-flagship on typical multi-step jobs; some heavy orchestrations about **1/6** | Scenario-dependent; see [claims](https://www.novapage.online/claims/) |
| Preview | **40+** formats (SuperPreview) | Whitepaper |
| Domains | **Eight** Hub tabs | Office, research, flywheel, GEO, creation, media, engineering, education |

Eight homepage pillars: Agent Harness, one-shot project delivery, six-stage flywheel, research + acquisition, 400+ capabilities, unified model pool, workflow templates, SuperPreview. Details: [capabilities](docs/en/capabilities.md) and the [community whitepaper digest](docs/en/whitepaper.md).

---

## Official SaaS / enterprise  vs  this community repo

| | [Official site](https://www.novapage.online/) | This community repo |
| --- | --- | --- |
| Who | Teams; SaaS or private deploy | One operator, self-hosted |
| Entry | Browser on the official domain (register needs an invite) | `pnpm run dev` → `/login` → `admin` |
| Accounts | Multi-user, tenant isolation | `admin` only |
| Data | Cloud or customer private boundary | `.saas-dev-data/` next to the repo (gitignored) |
| Model keys | Platform-managed option | You paste keys in Admin |
| Full whitepaper / gallery | Official docs + showcase | Digest + install guide only |
| N2 Bot | Per official / enterprise config | Off in this cut |

---

## Install (community golden path)

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

Open the printed **Vite URL** → `/login` → `admin` + `.env` password → the workbench.

Health (Bridge, often 3001, +1 if busy): `GET /api/saas/health` and `GET /api/saas/health/ready`.

Do not use `dev:standalone`. Do not treat the desktop launcher as the install path. Do not use bare `npm install` (this tree is pnpm).

---

## What this cut does not include

Marketing homepage, registration, invite codes, user lists, groups, leads, Showcase CMS, wallet UI, workbench **N2 Bot**. Control-plane code may remain; runtime returns 403 / hides nav.

You can sign in and browse the Hub without model keys. Running a task needs keys in `/admin/platform/service/models`.

---

## Docs

- [Install](docs/en/install.md)
- [User guide](docs/en/user-guide.md)
- [Product overview](docs/en/product.md)
- [Community whitepaper digest](docs/en/whitepaper.md) (canonical text: [official whitepaper](https://www.novapage.online/en/docs/))
- [Capabilities](docs/en/capabilities.md)
- [Trust](docs/en/trust.md)
- [Configure](docs/en/configure.md)
- [Develop (config-level)](docs/en/develop.md)
- [FAQ](docs/en/faq.md)

## Collaborate

Enterprise trial, private deploy, business: [contact](https://www.novapage.online/contact/).

WeChat **山君**:

<p align="center">
  <img src="assets/community/wechat-contact.png" width="280" alt="WeChat: 山君">
</p>

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE). Network use of a modified version requires corresponding source.
