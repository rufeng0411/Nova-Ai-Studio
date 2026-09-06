# Trust (community edition)

> Enterprise security: [official whitepaper ch. 8–9](https://www.novapage.online/en/docs/#s9). This page only states facts you can check in this repo. Do not copy tenant isolation into the community feature list.

## Official enterprise track (not this clone)

The site lists tenant isolation, JWT, tool allowlists, workspace sandbox, usage audit, SaaS or Docker / air-gapped private deploy. That story lives on [novapage.online](https://www.novapage.online/).

## What this community cut actually does

| Item | Fact |
| --- | --- |
| Account | `admin` only; `SAAS_ADMIN_PASSWORD` required at boot |
| Register | Off (403) |
| Auth | JWT in SaaS mode |
| Data | `.saas-dev-data/` by default, gitignored |
| Control DB | SQLite on the golden path |
| N2 Bot | Off |
| License | AGPL-3.0 |
| Telemetry | Product audit: default off; this repo is not a pentest report |

For procurement-grade trust text, use the official whitepaper.

## How to cite token savings

Keep “up to / scenario-dependent” and link [claims](https://www.novapage.online/claims/).
