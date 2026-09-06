import { describe, expect, it } from 'vitest';
import { stripLeakedToolCallMarkup } from './stripLeakedToolMarkup';

describe('stripLeakedToolCallMarkup', () => {
  it('drops lines containing leaked tool-call serialization fragments', () => {
    const text = [
      '基于已加载的技能框架，我现在为你撰写报告。',
      '</parameter> </function>',
      '</p> <!-- CONTINUE HERE --> </parameter> <parameter=old_string> <!-- CONTINUE HERE --> </parameter> </function>',
      '文件已生成并清理完毕。',
    ].join('\n');

    const result = stripLeakedToolCallMarkup(text);
    expect(result).toContain('基于已加载的技能框架');
    expect(result).toContain('文件已生成并清理完毕');
    expect(result).not.toContain('</parameter>');
    expect(result).not.toContain('<parameter=');
    expect(result).not.toContain('</function>');
    expect(result).not.toContain('CONTINUE HERE');
  });

  it('preserves fenced code blocks discussing these tags', () => {
    const text = [
      '示例代码：',
      '```xml',
      '<function=edit_file>',
      '</function>',
      '```',
      '以上是说明。',
    ].join('\n');

    expect(stripLeakedToolCallMarkup(text)).toBe(text);
  });

  it('returns input unchanged when no markup present', () => {
    const text = '正常的中文回复，不含任何残片。';
    expect(stripLeakedToolCallMarkup(text)).toBe(text);
  });

  it('strips English process narration when localeIsZh is true', () => {
    const text = "Now I'll write the final deliverable now:";
    expect(stripLeakedToolCallMarkup(text, { localeIsZh: true })).toBe('');
    expect(stripLeakedToolCallMarkup(text)).toBe(text);
  });

  it('drops unfenced raw html/css fragments from assistant prose', () => {
    const text = [
      '文件已生成：output.html',
      '} /* CONTINUE HERE */ nav{position:fixed;top:0;width:100%;z-index:100} </style></head><body><section id="hero">',
      '请在成果区打开预览。',
    ].join('\n');

    const result = stripLeakedToolCallMarkup(text);

    expect(result).toContain('文件已生成');
    expect(result).toContain('请在成果区打开预览');
    expect(result).not.toContain('CONTINUE HERE');
    expect(result).not.toContain('<body>');
    expect(result).not.toContain('position:fixed');
  });

  it('drops short multi-line css leaks and think closing tags', () => {
    const text = [
      '好的，我已完成报告。',
      '</think>',
      '.main-subtitle {',
      '  font-size: 18px;',
      '  margin: 25px auto;',
      '  border-radius: 2px;',
      '}',
      '请打开 report.html 查看。',
    ].join('\n');

    const result = stripLeakedToolCallMarkup(text);

    expect(result).toContain('好的，我已完成报告。');
    expect(result).toContain('请打开 report.html 查看。');
    expect(result).not.toContain('</think>');
    expect(result).not.toContain('.main-subtitle');
    expect(result).not.toContain('border-radius');
  });

  it('preserves fenced html code when the user explicitly asks for code', () => {
    const text = [
      '示例：',
      '```html',
      '<!doctype html><html><body><h1>Demo</h1></body></html>',
      '```',
    ].join('\n');

    expect(stripLeakedToolCallMarkup(text)).toBe(text);
  });

  it('strips task-resume markup from user-visible text', () => {
    const xml = [
      '<task-resume context="recovery_pause">',
      '  <user_goal>做落地页</user_goal>',
      '  <missing_paths>artifacts/index.html</missing_paths>',
      '</task-resume>',
    ].join('\n');
    expect(stripLeakedToolCallMarkup(xml)).not.toContain('<task-resume');
    expect(stripLeakedToolCallMarkup(xml)).not.toContain('missing_paths');
  });

  it('deduplicates repeated final deliverable summary blocks', () => {
    const block = [
      '📁 交付文件汇总',
      '格式\t文件路径',
      'HTML（交互图文版）\treport.html',
      'DOCX\t雷蛇灵刃用户研究报告_图文版.docx',
      'PDF\t雷蛇灵刃用户研究报告_图文版.pdf',
    ].join('\n');
    const text = [
      '三个版本已全部导出完成：',
      block,
      '🎨 设计特性',
      '主题风格\t黑绿赛博朋克',
      block,
      block,
    ].join('\n');

    const result = stripLeakedToolCallMarkup(text);

    expect(result.match(/交付文件汇总/g)).toHaveLength(1);
    expect(result.match(/report\.html/g)).toHaveLength(1);
  });
});
