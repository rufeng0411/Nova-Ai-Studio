# FAQ

## Why login?

The community cut keeps the SaaS kernel. `dev:standalone` skips deliverable flags and would fork the product.

## Why no register?

One admin only. `POST /api/auth/register` returns 403.

## Which health probe?

Bridge `/api/saas/health` and `/api/saas/health/ready`, not uvicorn `/healthz`.

## Why AGPL?

Network use must keep corresponding source available. See LICENSE.
