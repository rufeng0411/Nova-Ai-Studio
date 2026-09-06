# Install

This is the only golden path. Do not use `dev:standalone`, the Electron launcher, a marketing homepage, or a register page.

## What you get

- The Vite workbench URL printed by the launcher
- Single admin `admin` (password from `SAAS_ADMIN_PASSWORD`)
- SQLite control plane (`DEV_SAAS_SQLITE=1`), data in `.saas-dev-data/`
- Probes: `GET /api/saas/health` and `GET /api/saas/health/ready` (Bridge, often **3001**, +1 if busy)

You can sign in without model keys. Add keys in Admin when you want to run a task.

## Prerequisites

- Node.js **20+**
- Git
- No Docker / PostgreSQL on this path

## Steps

```bash
git clone https://github.com/rufeng0411/Nova-Ai-Studio.git
cd Nova-Ai-Studio
cp .env.example .env
# set SAAS_ADMIN_PASSWORD — never the historic default
npm install
npm run dev
```

Open the printed Vite URL → `/login` → `admin` + `.env` password → `/app`.

Configure models at `/admin/platform/service/models`.

## Do not

- Run `npm run dev:standalone`
- Treat the desktop launcher as the install path
- Put the historic default password in docs or `.env`
- Expect registration, invite codes, or a user list
- Probe uvicorn `:8000/healthz` (different product)
