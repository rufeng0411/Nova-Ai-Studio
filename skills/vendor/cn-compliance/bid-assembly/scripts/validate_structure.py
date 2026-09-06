#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Markdown结构验证工具
检查标题层级、列表完整性、表格格式等结构性问题
"""

import os
import sys
import re
from pathlib import Path
import glob


def validate_headings(lines):
    """验证标题层级"""
    issues = []
    prev_level = 0

    for i, line in enumerate(lines, 1):
        # 匹配标题
        match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()

            # 检查标题跳级
            if level > prev_level + 1:
                issues.append({
                    'type': 'heading_skip',
                    'level': 'ERROR',
                    'line': i,
                    'message': f'标题跳级：从 {"#"*prev_level if prev_level > 0 else "(无)"} 直接到 {"#"*level}',
                    'content': line.strip(),
                    'suggestion': f'建议插入 {"#"*(prev_level+1)} 级标题',
                    'auto_fix': False
                })

            prev_level = level

    return issues


def validate_lists(lines):
    """验证列表项完整性"""
    issues = []

    for i, line in enumerate(lines, 1):
        # 匹配列表项（带粗体标题）
        if re.match(r'^[-*+]\s+\*\*.*?\*\*\s*$', line):
            # 检查下一行是否有内容
            if i < len(lines):
                next_line = lines[i]  # lines是从0开始索引的
                # 如果下一行不是缩进内容，说明列表项缺少内容
                if not next_line.strip().startswith(' ') and not next_line.strip().startswith('\t'):
                    issues.append({
                        'type': 'empty_list_item',
                        'level': 'WARNING',
                        'line': i,
                        'message': '列表项只有标题，缺少内容',
                        'content': line.strip(),
                        'suggestion': '补充列表项内容，或删除该列表项',
                        'auto_fix': False
                    })

    return issues


def validate_tables(lines):
    """验证表格格式"""
    issues = []
    in_table = False
    table_start = 0
    table_cols = 0

    for i, line in enumerate(lines, 1):
        if '|' in line:
            # 计算列数
            cols = len([c for c in line.split('|') if c.strip()])

            if not in_table:
                # 开始新表格
                in_table = True
                table_start = i
                table_cols = cols
            else:
                # 检查列数是否一致
                if cols != table_cols and not re.match(r'^[-:| ]+$', line):  # 排除分隔行
                    issues.append({
                        'type': 'table_format',
                        'level': 'ERROR',
                        'line': i,
                        'message': f'表格列数不一致：期望{table_cols}列，实际{cols}列',
                        'content': line.strip(),
                        'suggestion': f'调整列数为{table_cols}列，或检查表格{table_start}行开始的定义',
                        'auto_fix': False
                    })
        else:
            # 表格结束
            if in_table:
                in_table = False

    return issues


def validate_file(file_path):
    """验证单个Markdown文件"""
    try:
        content = Path(file_path).read_text(encoding='utf-8')
        lines = content.split('\n')

        issues = []

        # 1. 验证标题层级
        issues.extend(validate_headings(lines))

        # 2. 验证列表完整性
        issues.extend(validate_lists(lines))

        # 3. 验证表格格式
        issues.extend(validate_tables(lines))

        return {
            'file': os.path.basename(file_path),
            'issues': issues,
            'success': True
        }

    except Exception as e:
        return {
            'file': os.path.basename(file_path),
            'issues': [],
            'error': str(e),
            'success': False
        }


def validate_directory(directory):
    """验证目录下所有Markdown文件"""
    md_files = glob.glob(os.path.join(directory, "*.md"))

    if not md_files:
        print(f"未找到Markdown文件: {directory}")
        return []

    results = []
    all_issues = []

    print(f"找到 {len(md_files)} 个Markdown文件")
    print("=" * 60)

    for md_file in md_files:
        result = validate_file(md_file)
        results.append(result)

        if result['success']:
            if result['issues']:
                print(f"\n⚠️  {result['file']} ({len(result['issues'])} 个问题)")
                for issue in result['issues']:
                    level_symbol = "✗" if issue['level'] == 'ERROR' else "⚠"
                    print(f"  {level_symbol} 行{issue['line']}: {issue['message']}")
                    print(f"     {issue['content']}")
                    if issue.get('suggestion'):
                        print(f"     建议: {issue['suggestion']}")
                all_issues.extend(result['issues'])
            else:
                print(f"✓ {result['file']} (无问题)")
        else:
            print(f"\n✗ {result['file']}")
            print(f"  错误: {result['error']}")

    print("\n" + "=" * 60)
    print(f"验证完成:")
    print(f"  文件数: {len(results)}")
    print(f"  ERROR: {sum(1 for i in all_issues if i['level'] == 'ERROR')}")
    print(f"  WARNING: {sum(1 for i in all_issues if i['level'] == 'WARNING')}")

    if all_issues:
        print("\n问题类型统计:")
        issue_types = {}
        for issue in all_issues:
            issue_type = issue['type']
            issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
        for issue_type, count in sorted(issue_types.items()):
            print(f"  {issue_type}: {count}")

    return results


def main():
    if len(sys.argv) < 2:
        print("用法: python validate_structure.py <目录路径>")
        print("示例: python validate_structure.py 响应文件/")
        sys.exit(1)

    directory = sys.argv[1]

    if not os.path.isdir(directory):
        print(f"错误: 目录不存在: {directory}")
        sys.exit(1)

    print("=== Markdown结构验证工具 ===")
    print(f"目录: {directory}\n")

    results = validate_directory(directory)

    # 统计所有ERROR级别问题
    error_count = sum(
        len([i for i in r.get('issues', []) if i['level'] == 'ERROR'])
        for r in results
        if r['success']
    )

    # 如果有ERROR，返回非0退出码
    if error_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
