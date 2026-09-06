# 工作流阶段检查点

| 阶段 | 名称 | 完成标准 | 产出 |
|------|------|----------|------|
| 1 | Brief 锁定 | 用户平台与意图明确 | `brief.md` |
| 2 | 创意锚点 | visualPrompt 已写且用户未反对 | `creative-anchor.md` |
| 3 | 文案矩阵 | 每个选中平台一行文案 | `copy-matrix.md` |
| 4 | 四套配图 | 4 次 generate_image 成功或 skippedRatios 已记 | `visuals/*.png` |
| 5 | 可选轮播 | 仅当 brief 要求 | `optional/carousel.html` |
| 6 | 打包交付 | manifest 合法 | `manifest.json` |
| 7 | 发布交接 | 仅当用户要求发布 | `yixiaoer/*` |

## 自检（阶段 6 前）

- [ ] `recommendedMapping` 覆盖所有选中平台
- [ ] 四套图 prompt 一致（对比 `visuals/prompt.txt`）
- [ ] 文案无超字未标注
- [ ] `anti-patterns.md` 无触犯项
- [ ] 对话中已给出文件夹路径
