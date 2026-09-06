---
name: monitor
parent: best-aeo-skill
description: Track GEO Score over time. Detects regressions, alerts via webhook/Slack/email. Detects content decay (3.2× citation drop after 30 days). CI/CD-ready. Use when the user asks to "monitor", "track over time", "alert on drop", or "set up GEO regression gate".
---

# monitor — sub-skill

Longitudinal tracking of GEO Score with regression detection and alerting.

## When to invoke
- "Set up monitoring for https://yoursite.com"
- "Alert me if GEO score drops below 80"
- "Add GEO regression gate to CI"
- "Track content decay across my blog"

## Features
- Stores history in `.bestaeo/history.json` or remote (S3, GCS, Postgres)
- Webhooks on score drop > N points
- Slack/Discord/email alerts
- Content decay detection (flags articles >30 days old with declining score)
- CI/CD gate: fails build if score drops below threshold

## Inputs
- `--url <URL>` or `--sitemap <URL>`
- `--threshold <N>` — alert/fail if score drops below this (default: 80)
- `--storage [local|s3|gcs|postgres]`
- `--alert [webhook|slack|email]`
- `--fail-on-drop` — exit code 1 on threshold violation (CI/CD)

## Run
```bash
python3 scripts/monitor.py --url https://example.com --threshold 80 --fail-on-drop
```
