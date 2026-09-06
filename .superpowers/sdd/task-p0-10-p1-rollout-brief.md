# P0-10 + P1：live 门禁与泛化强化

## P0-10

- scripts/run-mingdi-g700-live.mjs + test:mingdi-g700:live
- 11案 replay gate + 7场景 live harness (workers=1)
- scripts/smoke-cloud-official-media.mjs + test:cloud:official-media-smoke
- docs/mingdi-g700-production-hardening-acceptance-20260718.zh-CN.md
- feature flag rollout docs in report

## P1

- catalog scope audit script/tests
- Bridge load wedged fix verification in soak gate
- layout regression stub for website asset replace
- source cache sketch with bounded public URL storage

## 测试

- test:mingdi-g700:replay --gate
- test:mingdi-g700:live --tier p0 --workers=1 --gate (structure/fixture if no dev:saas)
- npm run test:bridge-stability:unit

报告：`F:\Ai-pilotdeck\.superpowers\sdd\task-p0-10-p1-rollout-report.md`
