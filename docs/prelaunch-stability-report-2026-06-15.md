# 上线前全面稳定性跑测报告

生成时间：2026-06-15T13:41:07.148Z
通过：**18/18**

## 明细

| 项 | 结果 | 说明 |
|----|------|------|
| build | ✅ |  |
| test:saas:deep | ✅ |  |
| smoke:saas-isolation | ✅ |  |
| smoke:resilience | ✅ |  |
| smoke:project-memory | ✅ |  |
| smoke:capability-hub | ✅ |  |
| smoke:capability-try-prompts | ✅ |  |
| smoke:templates | ✅ |  |
| smoke:skill-risk | ✅ |  |
| smoke:document-export | ✅ |  |
| test:saas:storage | ✅ |  |
| test:saas:folder | ✅ |  |
| check:saas-fork | ✅ |  |
| brand:check | ✅ |  |
| vitest-capability-binding | ✅ |  |
| vitest-ui-skills | ✅ |  |
| pack:preflight | ✅ |  |
| prelaunch-quick-full | ✅ |  |

## 结论

全部通过，可进入发版流程（仍需人工抽测 Skills 实跑与 HTTPS）。
