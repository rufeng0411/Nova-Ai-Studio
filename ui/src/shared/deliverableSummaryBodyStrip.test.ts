import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';
import {
  stripInlineDeliverableSummaryBlocks,
  stripMarkdownPipeDeliverableTables,
  stripRedundantDeliverableProseForSummaryTable,
} from './deliverableSummaryBodyStrip';

function item(path: string): DeliverableItem {
  return {
    id: path,
    path,
    apiPath: path,
    kind: 'document',
    source: 'tool',
  };
}

describe('deliverableSummaryBodyStrip', () => {
  it('removes inline 交付文件汇总 markdown blocks entirely', () => {
    const text = [
      '三个版本已全部导出完成。',
      '📁 交付文件汇总',
      '格式\t文件路径',
      'HTML\treport.html',
      'PDF\treport.pdf',
      '请在成果区预览。',
    ].join('\n');

    const result = stripInlineDeliverableSummaryBlocks(text);
    expect(result).toContain('三个版本已全部导出完成');
    expect(result).toContain('请在成果区预览');
    expect(result).not.toContain('交付文件汇总');
    expect(result).not.toContain('report.html');
  });

  it('strips known deliverable path lines when summary table will mount', () => {
    const text = [
      'A/B 方案已完成，结论如下。',
      '📄 文档已创建：`artifacts/demo/plan.md`',
      '**文件路径：** `artifacts/demo/plan.md`',
    ].join('\n');

    const result = stripRedundantDeliverableProseForSummaryTable(
      text,
      [item('artifacts/demo/plan.md')],
    );
    expect(result).toContain('A/B 方案已完成');
    expect(result).not.toContain('文档已创建');
    expect(result).not.toContain('文件路径');
  });

  it('removes markdown pipe tables without a summary heading', () => {
    const text = [
      '报告已完成。',
      '| 文件 | 路径 |',
      '| --- | --- |',
      '| 主报告 | `artifacts/report.md` |',
      '| 网页版 | `artifacts/index.html` |',
      '如需修改请告诉我。',
    ].join('\n');

    const result = stripMarkdownPipeDeliverableTables(text);
    expect(result).toContain('报告已完成');
    expect(result).toContain('如需修改请告诉我');
    expect(result).not.toContain('artifacts/report.md');
    expect(result).not.toContain('| --- |');
  });

  it('removes consecutive path bullet lists', () => {
    const text = [
      '已生成以下文件：',
      '- `artifacts/a.md`',
      '- `artifacts/b.html`',
      '结论如上。',
    ].join('\n');

    const result = stripInlineDeliverableSummaryBlocks(text);
    expect(result).toContain('结论如上');
    expect(result).not.toContain('artifacts/a.md');
  });

  it('strips four-column pipe table headers', () => {
    const text = [
      '结论如下。',
      '| 交付物名称 | 文件类型 | 状态 | 文件链接 |',
      '| --- | --- | --- | --- |',
      '| 报告 | Markdown | 已交付 | report.md |',
    ].join('\n');

    const result = stripMarkdownPipeDeliverableTables(text);
    expect(result).toContain('结论如下');
    expect(result).not.toContain('交付物名称');
    expect(result).not.toContain('report.md');
  });
});
