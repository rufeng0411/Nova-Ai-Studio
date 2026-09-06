# User guide

The official whitepaper (ch. 3–5, 7) is the full product tour. This page is only what you see after signing into **this community repo**.

## Sign in

Unauthenticated visits go to `/login`. No register tab, no invite code. The only user is `admin` (password from `SAAS_ADMIN_PASSWORD`).

After login you land on the workbench (`/app` or `/p/general`).

Hosted SaaS login/invites are a different path: [novapage.online/login](https://www.novapage.online/login).

## Workbench

Sidebar: projects / general, sessions, **New chat**. There is **no** N2 Bot chip; `/tools/n2-bot` returns to the workbench.

Composer: files, mentions, Hub. Hub shows **400+** cards (public wording). Try needs a model key; without a key, cards still list and runs fail — expected.

Templates: official whitepaper says **35**. Deliverables follow the in-app checklist/preview (the local SuperPreview story).

## Admin (one operator)

Models, MCP, skills, hub visibility. `/admin/users` is not a multi-user console.

## Data

`.saas-dev-data/` next to the repo; the engine may also use `~/.pilotdeck`. Keep both out of git.

## Full product

- Whitepaper: [novapage.online/en/docs](https://www.novapage.online/en/docs/)
- Showcase: [novapage.online/showcase](https://www.novapage.online/showcase/)
- Digest: [whitepaper.md](whitepaper.md)
