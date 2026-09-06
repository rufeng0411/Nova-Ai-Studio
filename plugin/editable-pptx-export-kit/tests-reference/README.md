# 原仓库测试文件索引（未包含在包内，迁移后建议拷贝运行）

```
backend/tests/unit/test_ppt_export_config.py
backend/tests/unit/test_mineru_export_cache.py
backend/tests/unit/test_export_filename.py
backend/tests/unit/test_export_page_image_paths.py
backend/tests/unit/test_export_letterbox.py
backend/scripts/diagnose_mineru.py
```

运行示例（在 NovaPage 根目录）：

```bash
cd backend
pytest tests/unit/test_ppt_export_config.py tests/unit/test_mineru_export_cache.py -q
python scripts/verify_export_optimization.py
```
