#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强的质检组装流程
整合规范化、结构验证、占位符检测、Word生成和后验证
"""

import os
import sys
import subprocess
from pathlib import Path
import json
from datetime import datetime

# 从脚本自身位置推算兄弟脚本的绝对路径
SCRIPT_DIR = str(Path(__file__).resolve().parent)


def run_command(command, description):
    """运行命令并显示结果"""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )

        print(result.stdout)

        if result.returncode != 0:
            print(result.stderr)
            return False, result.stderr

        return True, result.stdout

    except Exception as e:
        print(f"错误: {e}")
        return False, str(e)


def enhanced_assembly_workflow(project_dir):
    """增强的质检组装流程"""

    resp_dir = os.path.join(project_dir, "响应文件")

    if not os.path.isdir(resp_dir):
        print(f"错误: 响应文件目录不存在: {resp_dir}")
        sys.exit(1)

    print("=" * 60)
    print("增强的质检组装流程")
    print("=" * 60)
    print(f"项目目录: {project_dir}")
    print(f"响应文件目录: {resp_dir}")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = {
        'project_dir': project_dir,
        'start_time': datetime.now().isoformat(),
        'steps': []
    }

    # ========== 第1步：文件规范化 ==========
    success, output = run_command(
        f'python3 "{SCRIPT_DIR}/normalize_markdown.py" "{resp_dir}"',
        "第1步：Markdown文件规范化"
    )
    results['steps'].append({
        'step': 1,
        'name': 'normalize',
        'success': success,
        'output': output
    })

    # ========== 第2步：结构验证 ==========
    success, output = run_command(
        f'python3 "{SCRIPT_DIR}/validate_structure.py" "{resp_dir}"',
        "第2步：Markdown结构验证"
    )
    results['steps'].append({
        'step': 2,
        'name': 'validate_structure',
        'success': success,
        'output': output
    })

    # ========== 第3步：占位符检测 ==========
    exclude_files = [
        '核对报告.md',
        '装订指南.md',
        '扫描件资料清单.md',
        '扫描件替换完成报告.md',
        '扫描件替换报告.md',
        '资料检索替换完成报告.md',
        '信息填写进度报告.md',
        'Word文档待完善清单.md'
    ]
    success, output = run_command(
        f'python3 "{SCRIPT_DIR}/detect_placeholders.py" "{resp_dir}" {" ".join(exclude_files)}',
        "第3步：占位符检测"
    )
    results['steps'].append({
        'step': 3,
        'name': 'detect_placeholders',
        'success': success,
        'output': output
    })

    # ========== 第4步：生成Word文档（跳过，由 bid-md2doc 负责） ==========
    print(f"\n{'='*60}")
    print("第4步：Word文档生成（由 bid-md2doc skill 独立负责，此处跳过）")
    print(f"{'='*60}")
    success = True
    output = "跳过（Word 生成由 bid-md2doc 独立执行）"

    results['steps'].append({
        'step': 4,
        'name': 'generate_docx',
        'success': success,
        'output': output
    })

    # ========== 第5步：Word文档后验证 ==========
    import glob
    docx_files = glob.glob(os.path.join(resp_dir, "*.docx"))

    if not docx_files:
        print(f"\n⚠️  警告: 未找到生成的Word文档")
        print(f"   搜索路径: {resp_dir}/*.docx")
        success = False
        output = "Word document not found"
    else:
        latest_docx = max(docx_files, key=os.path.getmtime)
        success, output = run_command(
            f'python3 "{SCRIPT_DIR}/verify_docx.py" "{latest_docx}"',
            "第5步：Word文档后验证"
        )

    results['steps'].append({
        'step': 5,
        'name': 'verify_docx',
        'success': success,
        'output': output
    })

    # ========== 生成汇总报告 ==========
    results['end_time'] = datetime.now().isoformat()

    print("\n" + "=" * 60)
    print("质检汇总")
    print("=" * 60)

    success_count = sum(1 for step in results['steps'] if step['success'])
    total_count = len(results['steps'])

    print(f"完成步骤: {success_count}/{total_count}")
    print()

    for step in results['steps']:
        status = "✓" if step['success'] else "✗"
        print(f"  {status} 步骤{step['step']}: {step['name']}")

    print("\n" + "=" * 60)

    # 保存结果到JSON
    report_file = os.path.join(resp_dir, "质检报告.json")
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"质检报告已保存: {report_file}")

    # 返回退出码
    if success_count == total_count:
        print("\n✓ 质检通过！")
        sys.exit(0)
    else:
        print(f"\n✗ 质检未通过：{total_count - success_count} 个步骤失败")
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("用法: python enhanced_assembly.py <项目目录>")
        print("示例: python enhanced_assembly.py /path/to/bid/TC261901F1")
        sys.exit(1)

    project_dir = sys.argv[1]

    if not os.path.isdir(project_dir):
        print(f"错误: 项目目录不存在: {project_dir}")
        sys.exit(1)

    enhanced_assembly_workflow(project_dir)


if __name__ == "__main__":
    main()
