# Document Canvas Smoke Report

- started: 2026-06-15T15:45:33.881Z
- passed: no

## Checks
- fixtureUpload: FAIL {"ok":false,"files":[{"name":"sample-2p.pdf","ok":false,"status":403},{"name":"sample-2p.docx","ok":false,"status":403},{"name":"sample-3s.pptx","ok":false,"status":403}]}
- pdfCanvasVisible: OK {"ok":true}
- pdfPageIndicator: OK {"ok":true,"text":"1 / 2"}
- pdfPageTurn: OK {"ok":true,"text":"2 / 2"}
- pdfPageRail: OK {"ok":true}
- pdfThumbNav: OK {"ok":true,"text":"1 / 2"}
- pdfSidebarVariant: OK {"ok":true}
- docxPreview: OK {"ok":true,"text":"1 / 2"}
- docxPageRail: OK {"ok":true}
- pptxCanvasVisible: OK {"ok":true,"width":120}
- pptxPageCount: OK {"ok":true,"text":"1 / 3"}
- pptxPageRail: OK {"ok":true}
- pptxRailGrid: OK {"ok":true}
- htmlFixtureUpload: FAIL {"ok":false,"status":403}

## Error

locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for getByText('ui-preview-test.html', { exact: true }).first() to be visible
