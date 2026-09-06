#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Markdown文件规范化工具
修复常见格式问题：CRLF/LF混合、BOM、尾部空白、Tab缩进等
"""

import os
import sys
from pathlib import Path
import glob


def normalize_file(file_path):
    """规范化单个Markdown文件"""
    changes = []

    try:
        # 1. 读取原始字节
        content = Path(file_path).read_bytes()
        original_size = len(content)

        # 2. 移除BOM
        if content.startswith(b'\xef\xbb\xbf'):
            content = content[3:]
            changes.append("移除BOM")

        # 3. 统一换行符为LF
        if b'\r\n' in content or b'\r' in content:
            content = content.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
            changes.append("统一换行符(CRLF→LF)")

        # 4. 解码为文本
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            # 尝试GB18030编码
            text = content.decode('gb18030', errors='ignore')
            changes.append("转换编码(GB18030→UTF-8)")

        # 5. 统一缩进（Tab转4空格）
        if '\t' in text:
            text = text.replace('\t', '    ')
            changes.append("统一缩进(Tab→4空格)")

        # 6. 移除行尾空白
        lines = text.split('\n')
        stripped_lines = [line.rstrip() for line in lines]
        if any(lines[i] != stripped_lines[i] for i in range(len(lines))):
            lines = stripped_lines
            changes.append("移除行尾空白")

        # 7. 确保文件末尾只有一个换行符
        while lines and not lines[-1].strip():
            lines.pop()
            changes.append("移除末尾空行")

        # 8. 重新组装文本
        normalized_text = '\n'.join(lines)
        if normalized_text and not normalized_text.endswith('\n'):
            normalized_text += '\n'

        # 9. 写回文件
        Path(file_path).write_text(normalized_text, encoding='utf-8')

        new_size = len(normalized_text.encode('utf-8'))

        return {
            'file': os.path.basename(file_path),
            'changes': changes,
            'original_size': original_size,
            'new_size': new_size,
            'success': True
        }

    except Exception as e:
        return {
            'file': os.path.basename(file_path),
            'changes': [],
            'error': str(e),
            'success': False
        }


def normalize_directory(directory):
    """规范化目录下所有Markdown文件"""
    md_files = glob.glob(os.path.join(directory, "*.md"))

    if not md_files:
        print(f"未找到Markdown文件: {directory}")
        return []

    results = []

    print(f"找到 {len(md_files)} 个Markdown文件")
    print("=" * 60)

    for md_file in md_files:
        result = normalize_file(md_file)
        results.append(result)

        if result['success']:
            if result['changes']:
                print(f"\n✓ {result['file']}")
                for change in result['changes']:
                    print(f"  - {change}")
                size_diff = result['new_size'] - result['original_size']
                if size_diff != 0:
                    print(f"  - 文件大小: {result['original_size']} → {result['new_size']} ({size_diff:+d} bytes)")
            else:
                print(f"✓ {result['file']} (无需修改)")
        else:
            print(f"\n✗ {result['file']}")
            print(f"  错误: {result['error']}")

    print("\n" + "=" * 60)
    print(f"规范化完成:")
    print(f"  成功: {sum(1 for r in results if r['success'])}")
    print(f"  失败: {sum(1 for r in results if not r['success'])}")
    print(f"  修改: {sum(1 for r in results if r.get('changes'))}")

    return results


def main():
    if len(sys.argv) < 2:
        print("用法: python normalize_markdown.py <目录路径>")
        print("示例: python normalize_markdown.py 响应文件/")
        sys.exit(1)

    directory = sys.argv[1]

    if not os.path.isdir(directory):
        print(f"错误: 目录不存在: {directory}")
        sys.exit(1)

    print("=== Markdown文件规范化工具 ===")
    print(f"目录: {directory}\n")

    results = normalize_directory(directory)

    # 返回退出码
    if any(not r['success'] for r in results):
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
