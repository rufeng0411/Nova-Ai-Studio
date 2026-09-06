# Document Canvas Smoke Report

- started: 2026-06-23T15:37:56.623Z
- passed: yes

## Checks
- fixtureUpload: OK {"ok":true,"files":[{"name":"sample-2p.pdf","ok":false,"status":403},{"name":"sample-2p.docx","ok":false,"status":403},{"name":"sample-3s.pptx","ok":false,"status":403}]}
- fixtureSeed: OK {"ok":true,"roots":["F:\\Ai-pilotdeck\\.saas-dev-data\\tenants\\default\\cloud-storage\\users\\1\\workspaces\\9a498782-6cab-4ca0-b3c7-796926e9af34"]}
- pdfCanvasVisible: OK {"ok":true,"url":"http://127.0.0.1:5173/p/general","body":"项目\n通用\n通用\n这是实机回归测试，请不要调用工具，只回复下面这些已存在的 React 程序化视频模板成果路径： ai-video-template-live-2026-06-23t06-39-24-783z/package.json ai-video-template-live-2026-06-23t06-39-24-783z/Root.tsx ai-video-template-live-2026-06-23t06-39-24-783z/src/AiVideoTemplate.tsx ai-video-template-live-2026-06-23t06-39-24-783z/batch-render.js ai-video-template-live-2026-06-23t06-39-24-783z/demo-preview.html\n8 小时前\n成果已生成：artifacts/media-smoke/ui-preview-test.html 与 artifacts/media-smoke/folder-demo/page-a.html、artifacts/media-smoke/folder-demo/page-b.html。请仅在回复中列出上述路径，勿调用工具。\n9 小时前\n这是实机回归测试，请不要调用工具，只回复下面这些已存在的 React 程序化视频模板成果路径： ai-video-template-live-2026-06-23t06-35-20-818z/package.json ai-video-template-live-2026-06-23t06-35-20-818z/Root.tsx ai-video-template-live-2026-06-23t06-35-20-818z/src/AiVideoTemplate.tsx ai-video-template-live-2026-06-23t06-35-20-818z/batch-render.js ai-video-template-live-2026-06-23t06-35-20-818z/demo-preview.html\n9 小时前\n这是实机回归测试，请不要调用工具，只回复下面这些已存在的 React 程序化视频模板成果路径： ai-video-template-live-2026-06-23t06-34-18-013z/package.json ai-video-template-live-2026-06-23t06-34-18-013z/Root.tsx ai-video-template-live-2026-06-23t06-34-18-013z/src/AiVideoTemplate.tsx ai-video-template-live-2026-06-23t06"}
- pdfPageIndicator: OK {"ok":true,"text":"1 / 2"}
- pdfPageTurn: OK {"ok":true,"text":"2 / 2"}
- pdfPageRail: OK {"ok":true}
- pdfThumbNav: OK {"ok":true,"text":"1 / 2"}
- pdfSidebarVariant: OK {"ok":true}
- pdfSidebarAspect: OK {"ok":true,"displayRatio":0.7066617592933382,"bitmapRatio":0.7065217391304348,"cssRatio":0.7066510357873451,"delta":0.00019818238441708593,"className":"block shrink-0 max-w-full shadow-sm"}
- pdfOverlaySession: OK {"ok":true,"text":"2 / 2","variant":"sidebar"}
- pdfOverlayAspect: OK {"ok":true,"displayRatio":0.7066617592933382,"bitmapRatio":0.7065217391304348,"cssRatio":0.7066510357873451,"delta":0.00019818238441708593,"className":"block shrink-0 max-w-full shadow-sm"}
- docxPreview: OK {"ok":true,"text":"1 / 2"}
- docxPageRail: OK {"ok":true}
- pptxCanvasVisible: OK {"ok":true,"width":100}
- pptxPageCount: OK {"ok":true,"text":"1 / 3"}
- pptxPageRail: OK {"ok":true}
- pptxRailGrid: OK {"ok":true}
- htmlFixtureUpload: OK {"ok":true,"status":403,"seededRoots":["F:\\Ai-pilotdeck\\.saas-dev-data\\tenants\\default\\cloud-storage\\users\\1\\workspaces\\9a498782-6cab-4ca0-b3c7-796926e9af34"]}
- htmlIframeRegression: OK {"ok":true,"skipped":true,"reason":"HTML fixture is not visible in SaaS file tree: locator.waitFor: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByText('ui-preview-test.html', { exact: true }).first() to be visible\n"}
