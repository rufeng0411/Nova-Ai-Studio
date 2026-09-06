# Document Canvas Smoke Report

- started: 2026-07-01T16:03:14.343Z
- passed: yes

## Checks
- fixtureUpload: OK {"ok":true,"files":[{"name":"sample-2p.pdf","ok":false,"status":403},{"name":"sample-2p.docx","ok":false,"status":403},{"name":"sample-long.docx","ok":false,"status":403},{"name":"sample-3s.pptx","ok":false,"status":403}]}
- fixtureSeed: OK {"ok":true,"roots":["F:\\Ai-pilotdeck\\.saas-dev-data\\tenants\\default\\cloud-storage\\users\\1\\workspaces\\9a498782-6cab-4ca0-b3c7-796926e9af34"]}
- pdfCanvasVisible: OK {"ok":true,"url":"http://127.0.0.1:8082/p/general","body":"项目\n通用\n通用\n用「深度调研」围绕【精密玻璃管行业中国大陆地区】做多源调研：先列信息源，再给带结论的综述。\n29 分钟前\n用「Nova-竞品对标」对【南美旅游品类】做竞品全量对标：竞品清单、维度对比与突围策略。\n5 小时前\n帮【南美旅游】做品牌 GEO 全案，按阶段一次执行，存 artifacts/geo/【品牌名】/ 每阶段报路径。核心优势【…】，竞品【…】。\n5 小时前\n用「Nova-竞品对标」对【南美旅游品类】做竞品全量对标：竞品清单、维度对比与突围策略。\n5 小时前\n帮【南美旅游】做品牌 GEO 全案，按阶段一次执行，存 artifacts/geo/【品牌名】/ 每阶段报路径。核心优势【…】，竞品【…】。\n5 小时前\n显示更多 (62)\nAD\nadmin\n管理员\n设置\n退出\n文件\n智能体\n文件\n能力中心\n用量\n记忆\n计划任务\n今天想做点什么？\n帮我搭一个 SaaS 定价页：三档套餐+对比表+企业询价区，简洁高级风，直接执行。\n这场活动要做全渠道触达，按小红书/邮件/社群列可落地执行清单，直接开始。\n做一版 programmatic SEO 打法：【城市×服务】落地页清单+模板骨架，直接输出。\n帮我做竞品对比一页纸：功能/价格/口碑三维度，销售能直接拿去讲，直接出稿。\n做一版品牌官网 Hero：一句话定位 + 三个卖点 + 主按钮文案，石墨高级风，直接出稿。\n不知道从哪开始？ → 打开能力库\n探索全部能力 →\n智能体\n能力\n--\n通用\n-p\n.pilotdeck\n.tmp\naccount\nartifacts\n.export-cache\ncanvas-1781925513726\ncanvas-1781925545350\ncanvas-1781925754758\ncanvas-1781925765604\ncanvas-1781925784643\ncanvas-1781926306165\ncanvas-1781926611590\ncanvas-1781926791597\ncanvas-1781935208623\ncanvas-1781935311070\ncanvas-1781935517863\ncanvas-e2e-playwright\ngeo\nmedia-smoke\ndocument-canvas\nsample-2p.docx\nsample-2p.pdf\nsample-3s.pptx\nfolder-demo\nnio-es9-review\nslides-ming-arch\nslides-ming-arch-guofeng\nslides-ming-architecture\nmetal-home-storage-market-research-export.docx\nmetal-home-storage-market-research-export.pdf\nm"}
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
- docxThumbContent: OK {"ok":true}
- docxPagePadding: OK {"ok":true,"top":96,"left":96}
- docxPageTurn: OK {"ok":true,"text":"2 / 2"}
- docxViewportScroll: OK {"ok":true,"clientHeight":916,"scrollHeight":1717,"scrollTop":240,"hostHeight":1685,"pageFrameHeight":1685}
- docxLongVirtualPages: OK {"ok":true,"skipped":true,"reason":"locator.waitFor: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByText('sample-long.docx', { exact: true }).first() to be visible\n"}
- pptxCanvasVisible: OK {"ok":true,"width":120}
- pptxPageCount: OK {"ok":true,"text":"1 / 3"}
- pptxPageRail: OK {"ok":true}
- pptxThumbContent: OK {"ok":true}
- pptxRailGrid: OK {"ok":true}
- htmlFixtureUpload: OK {"ok":true,"status":403,"seededRoots":["F:\\Ai-pilotdeck\\.saas-dev-data\\tenants\\default\\cloud-storage\\users\\1\\workspaces\\9a498782-6cab-4ca0-b3c7-796926e9af34"]}
- htmlIframeRegression: OK {"ok":true,"skipped":true,"reason":"HTML fixture is not visible in SaaS file tree: locator.waitFor: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByText('ui-preview-test.html', { exact: true }).first() to be visible\n"}
