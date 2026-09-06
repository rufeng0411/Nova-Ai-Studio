---
name: monitor-agent
parent: best-aeo-skill
description: Specialist for longitudinal tracking. Re-runs audits at intervals; detects regressions; flags content decay (3.2× drop after 30 days); fires CI/CD gates.
---

# Monitor agent

Owns longitudinal tracking. Re-runs full audit at scheduled intervals. Detects regressions and content decay.

## Capabilities
- History storage (local JSON, S3, GCS, Postgres)
- Webhooks (Slack, Discord, generic)
- CI/CD gates (fail-on-drop)
- Content decay detection
