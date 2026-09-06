# Nova Ai-Studio

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

**A self-hosted conversational Agent workbench: sign in, land on `/app`, and finish real work from the Hub.**

This community edition is **personal SaaS**: one Admin, no marketing site, no sign-up, no invite codes. The engine is the same SaaS kernel as the commercial tree (deliverables, Hub, Skills) so later sync stays mechanical.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rufeng0411/Nova-Ai-Studio)](https://github.com/rufeng0411/Nova-Ai-Studio/releases)
[![Docs](https://img.shields.io/badge/docs-GitHub_Pages-2ea44f)](https://rufeng0411.github.io/Nova-Ai-Studio/)

**[Install](docs/en/install.md)** · **[User guide](docs/en/user-guide.md)** · **[Capabilities](docs/en/capabilities.md)** · **[Configure](docs/en/configure.md)** · **[Collaborate](#collaborate)**

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
cp .env.example .env
# set SAAS_ADMIN_PASSWORD (never the historic default)
corepack enable
pnpm install
pnpm run dev
```

Open the **Vite URL** printed by the launcher → `/login` → `admin` + the password in `.env` → **`/app`**.

Health probes (Bridge, often 3001, +1 if busy): `GET /api/saas/health` and `GET /api/saas/health/ready`.

Do not use `dev:standalone`. Do not treat the Electron launcher as the golden path.

---

## What it is

Nova Ai-Studio runs an Agent loop on your machine. You describe a goal; skills and tools do the work; outputs land as deliverables you can reopen.

The community cut is for **one operator**: username `admin`, SQLite control plane, data under `.saas-dev-data` (gitignored).

## What you can do

- Sign in and work in `/app`.
- Browse **400+** Hub cards (that is the public wording; we do not print an exact catalog count).
- Put model keys in Admin → platform service / models.
- Keep MCP and skill settings for this single Admin.

## What we removed

Marketing homepage, registration, invite codes, user lists, groups, leads, Showcase CMS, wallet UI. Control-plane code remains; runtime returns 403 and the nav is gone.

## Collaborate

WeChat **山君**:

<p align="center">
  <img src="assets/community/wechat-contact.png" width="280" alt="WeChat: 山君">
</p>

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
