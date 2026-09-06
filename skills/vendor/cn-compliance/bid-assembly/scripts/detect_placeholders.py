#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强的占位符检测工具
检测各种形式的占位符：【待填写】、[待补充]、TODO、??? 等
"""

import os
import sys
import re
from pathlib import Path
import glob


# 占位符模式列表
PLACEHOLDER_PATTERNS = [
    (r'【.*?待.*?】', '中文方括号待处理项'),
    (r'【.*?此处.*?】', '中文方括号此处项'),
    (r'\[.*?待.*?\]', '英文方括号待处理项'),
    (r'待补充|待完善|待确认|待填写', '文本占位符'),
    (r'TODO|FIXME|XXX|HACK', '代码风格占位符'),
    (r'\?\?\?+', '问号占位符'),
    (r'<待.*?>', '尖括号占位符'),
    (r'（待.*?）', '中文圆括号占位符'),
]


def get_line_context(content, start, end, context_lines=1):
    """获取匹配位置的上下文行"""
    lines_before = content[:start].split('\n')
    lines_after = content[end:].split('\n')

    line_num = len(lines_before)
    current_line = lines_before[-1] + content[start:end] + (lines_after[0] if lines_after else '')

    # 获取上下文
    context_start = max(0, len(lines_before) - context_lines - 1)
    before_context = lines_before[context_start:-1]
    after_context = lines_after[1:context_lines + 1]

    return {
        'line_num': line_num,
        'current_line': current_line,
        'before': before_context,
        'after': after_context
    }


def detect_placeholders(file_path):
    """检测单个文件中的占位符"""
    try:
        content = Path(file_path).read_text(encoding='utf-8')

        placeholders = []

        for pattern, description in PLACEHOLDER_PATTERNS:
            for match in re.finditer(pattern, content):
                context = get_line_context(content, match.start(), match.end())

                placeholders.append({
                    'type': 'placeholder',
                    'pattern': description,
                    'match': match.group(),
                    'line': context['line_num'],
                    'context': context['current_line'].strip()
                })

        return {
            'file': os.path.basename(file_path),
            'placeholders': placeholders,
            'success': True
        }

    except Exception as e:
        return {
            'file': os.path.basename(file_path),
            'placeholders': [],
            'error': str(e),
            'success': False
        }


def detect_directory(directory, exclude_files=None):
    """检测目录下所有Markdown文件"""
    if exclude_files is None:
        exclude_files = []

    md_files = glob.glob(os.path.join(directory, "*.md"))

    # 过滤排除文件
    md_files = [f for f in md_files if os.path.basename(f) not in exclude_files]

    if not md_files:
        print(f"未找到Markdown文件: {directory}")
        return []

    results = []
    all_placeholders = []

    print(f"找到 {len(md_files)} 个Markdown文件")
    if exclude_files:
        print(f"排除文件: {', '.join(exclude_files)}")
    print("=" * 60)

    for md_file in md_files:
        result = detect_placeholders(md_file)
        results.append(result)

        if result['success']:
            if result['placeholders']:
                print(f"\n⚠️  {result['file']} ({len(result['placeholders'])} 个占位符)")
                for ph in result['placeholders']:
                    print(f"  ✗ 行{ph['line']}: {ph['match']}")
                    print(f"     类型: {ph['pattern']}")
                    print(f"     上下文: {ph['context'][:80]}")
                all_placeholders.extend(result['placeholders'])
            else:
                print(f"✓ {result['file']} (无占位符)")
        else:
            print(f"\n✗ {result['file']}")
            print(f"  错误: {result['error']}")

    print("\n" + "=" * 60)
    print(f"检测完成:")
    print(f"  文件数: {len(results)}")
    print(f"  占位符总数: {len(all_placeholders)}")

    if all_placeholders:
        print("\n占位符类型统计:")
        pattern_counts = {}
        for ph in all_placeholders:
            pattern = ph['pattern']
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        for pattern, count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
            print(f"  {pattern}: {count}")

    return results


def main():
    if len(sys.argv) < 2:
        print("用法: python detect_placeholders.py <目录路径> [排除文件...]")
        print("示例: python detect_placeholders.py 响应文件/ 核对报告.md 装订指南.md")
        sys.exit(1)

    directory = sys.argv[1]
    exclude_files = sys.argv[2:] if len(sys.argv) > 2 else []

    if not os.path.isdir(directory):
        print(f"错误: 目录不存在: {directory}")
        sys.exit(1)

    print("=== 占位符检测工具 ===")
    print(f"目录: {directory}\n")

    results = detect_directory(directory, exclude_files)

    # 统计占位符总数
    placeholder_count = sum(
        len(r.get('placeholders', []))
        for r in results
        if r['success']
    )

    # 如果有占位符，返回非0退出码
    if placeholder_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
