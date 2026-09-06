# Deliverable path resolve baseline

Generated: 2026-06-18T00:43:12.982Z

Fixture: `tests/fixtures/deliverable-collision`

| Query | Result |
| --- | --- |
| `index.html` | 409 ambiguous: artifacts/task-b/index.html, artifacts/task-a/index.html |
| `index.html` hintDir=artifacts/task-a | `artifacts/task-a/index.html` |
| `index.html` hintDir=artifacts/task-b | `artifacts/task-b/index.html` |
| `artifacts/task-a/index.html` | `artifacts/task-a/index.html` |
| `artifacts/task-b/index.html` | `artifacts/task-b/index.html` |
| `slide-01.png` | File not found |
| `slide-01.png` hintDir=artifacts/slides-deck-a | `artifacts/slides-deck-a/slide-01.png` |
| `slide-01.png` hintDir=artifacts/slides-deck-b | `artifacts/slides-deck-b/slide-01.png` |
| `artifacts/slides-deck-a/slide-01.png` | `artifacts/slides-deck-a/slide-01.png` |
| `artifacts/slides-deck-b/slide-01.png` | `artifacts/slides-deck-b/slide-01.png` |
| `slide-manifest.json` | File not found |
| `slide-manifest.json` hintDir=artifacts/slides-deck-b | `artifacts/slides-deck-b/slide-manifest.json` |

## Manual repro (general project)

1. Task A: `write_file artifacts/collision-a/index.html`
2. Task B: `write_file artifacts/collision-b/index.html`
3. On task B deliverables: panel click, body link, go-folder must open `collision-b`.