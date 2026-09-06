## PilotDeck integration

- **Skill slug**: `anth-docx` — invoke with `read_skill anth-docx`
- **Setup & troubleshooting**: read `references/pilotdeck-setup.md` in this skill directory
- **New documents**: prefer Node `docx` from the PilotDeck repo root (`require('docx')`); write output under the project (e.g. `artifacts/brief/…docx`)
- **Smoke test**: `node scripts/integration-docx-smoke.mjs` from repo root
- **HTML/visual deliverables**: use Open Design `od-*` skills instead
