# 鸣镝 G700 内容与官方素材生产稳态基线（2026-07-18）

## 结论

- 原始导出严格核验：**11/11**
- 预期问题标签复现：**11/11**
- baseline 门禁：**通过**
- 本报告仅保留脱敏目标、导出 basename/SHA-256、成果结构、质量合同与失败标签；不记录绝对数据目录、用户 ID、Cookie、签名 URL 或完整私密正文。

## 关键问题复现

- `last30days`：01/02/03 三类成果越界扩张，并混入跨会话成果信号；唯一权威成果 `marketing-deliverable-2026-07-18.html` 缺失。
- `strategy`：原始 consultation 无文件意图，但旧导出擅自生成 0/1 校验中成果合同并宣称完成。
- `product-research`：唯一权威成果 `product-2026-07-18.html` 缺失，旧导出同时扩张出错误命名的 MD/HTML 合同。
- `nova-slides`：用户要求 6 页，合同扩张至 10 页，且出现重复页绑定。
- 官方素材：存在生图替代、官方来源证据缺失、远程热链不可达或占位降级。
- 主体与输出：存在主体误判、视频输出类型错配以及内容断言失败。
- 四线快照：11 份导出均缺少可核验 snapshot envelope。

## 指标汇总

| 指标 | 数量 |
|---|---:|
| `scope_expansion` | 22 |
| `cross_session_artifact` | 3 |
| `passed_with_pending` | 2 |
| `false_incomplete_loop` | 4 |
| `official_media_violation` | 6 |
| `forbidden_generate_image` | 25 |
| `unreachable_hotlink` | 1 |
| `unlabeled_degrade` | 1 |
| `entity_misclassification` | 1 |
| `slide_count_drift` | 4 |
| `output_kind_mismatch` | 2 |
| `deliverable_contract_mismatch` | 4 |
| `content_assertion_failed` | 2 |
| `snapshot_missing` | 11 |

## 11 案结果

| 案例 | 结果 | 已复现标签 | 缺失预期标签 | 多报标签 |
|---|---|---|---|---|
| strategy | 通过 | scope_expansion、cross_session_artifact、passed_with_pending、false_incomplete_loop、snapshot_missing | 无 | 无 |
| geo-plan | 通过 | official_media_violation、forbidden_generate_image、snapshot_missing | 无 | 无 |
| geo-keywords | 通过 | snapshot_missing | 无 | 无 |
| last30days | 通过 | scope_expansion、cross_session_artifact、deliverable_contract_mismatch、snapshot_missing | 无 | 无 |
| nova-slides | 通过 | false_incomplete_loop、official_media_violation、forbidden_generate_image、slide_count_drift、deliverable_contract_mismatch、content_assertion_failed、snapshot_missing | 无 | 无 |
| product-research | 通过 | scope_expansion、official_media_violation、output_kind_mismatch、deliverable_contract_mismatch、snapshot_missing | 无 | 无 |
| gsap | 通过 | scope_expansion、snapshot_missing | 无 | 无 |
| campaign | 通过 | official_media_violation、forbidden_generate_image、entity_misclassification、snapshot_missing | 无 | 无 |
| html-slides | 通过 | scope_expansion、passed_with_pending、false_incomplete_loop、official_media_violation、content_assertion_failed、snapshot_missing | 无 | 无 |
| remotion | 通过 | scope_expansion、output_kind_mismatch、deliverable_contract_mismatch、snapshot_missing | 无 | 无 |
| website | 通过 | official_media_violation、unreachable_hotlink、unlabeled_degrade、snapshot_missing | 无 | 无 |

## 复现命令

```powershell
npm run test:mingdi-g700:replay -- --gate=baseline --exports-dir "<本地导出目录>"
```

