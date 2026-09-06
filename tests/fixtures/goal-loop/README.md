# Goal-Loop fixture replay

- `continuationOwner-repair-active` — engine `turn_acceptance_meta` with `continuationOwner: deliverable_repair`
- `nova-count-insufficient-repair` — Nova 3/6 partial deck triggering `count_insufficient`
- `footer-table-strip-prose` — assistant body with colon path lines stripped when footer table mounts

Replay via `scripts/replay-task-fixture.mjs` and `npm run test:goal-loop:acceptance`.
