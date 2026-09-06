import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';
import {
  applyPresentationDeliverablePolicy,
  selectAuthoritativePptxDeliverables,
} from './presentationDeliverablePolicy';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import { pickPrimaryDeliverableFile } from './pickPrimaryDeliverable';

function deliverable(path: string, source: 'tool' | 'text' = 'tool'): DeliverableItem {
  return {
    id: path,
    path,
    apiPath: path,
    kind: 'document',
    source,
  };
}

describe('presentationDeliverablePolicy', () => {
  it('selectAuthoritativePptx drops stub presentation.pptx when sibling exists', () => {
    const dir = 'artifacts/nova-ai-solution';
    const items = [
      deliverable(`${dir}/presentation.pptx`),
      deliverable(`${dir}/Nova_AI_全栈解决方案.pptx`),
    ];
    const selected = selectAuthoritativePptxDeliverables(items);
    expect(selected.map((item) => item.path)).toEqual([`${dir}/Nova_AI_全栈解决方案.pptx`]);
  });

  it('promotes real pptx and demotes html/script when both exist', () => {
    const dir = 'artifacts/nova-ai-solution';
    const all = [
      deliverable(`${dir}/presentation.html`),
      deliverable(`${dir}/create_pptx.py`),
      deliverable(`${dir}/Nova_AI_全栈解决方案.pptx`),
    ];
    const final = applyPresentationDeliverablePolicy(
      [deliverable(`${dir}/presentation.html`)],
      all,
      [`${dir}/presentation.html`],
    );
    expect(final.map((item) => item.path)).toEqual([`${dir}/Nova_AI_全栈解决方案.pptx`]);
  });

  it('keeps html when only generic presentation.pptx exists and assistant anchored html', () => {
    const dir = 'artifacts/nova-ai-solution';
    const all = [
      deliverable(`${dir}/presentation.html`),
      deliverable(`${dir}/create_pptx.py`),
      deliverable(`${dir}/presentation.pptx`),
    ];
    const final = applyPresentationDeliverablePolicy(
      [deliverable(`${dir}/presentation.html`), deliverable(`${dir}/create_pptx.py`)],
      all,
      [`${dir}/presentation.html`],
    );
    expect(final.map((item) => item.path)).toEqual([
      `${dir}/presentation.html`,
      `${dir}/create_pptx.py`,
    ]);
  });

  it('collectTurnFinalDeliverables prefers pptx over html for DOCX→PPT style turns', () => {
    const dir = 'artifacts/nova-ai-solution';
    const toolMessages = [
      {
        id: 'w1',
        type: 'assistant' as const,
        content: '',
        timestamp: '2026-06-20T00:00:00.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 'w1',
        toolInput: JSON.stringify({ file_path: `${dir}/presentation.html` }),
        toolResult: { isError: false, content: 'ok', writtenFilePath: `${dir}/presentation.html` },
      },
      {
        id: 'w2',
        type: 'assistant' as const,
        content: '',
        timestamp: '2026-06-20T00:00:01.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 'w2',
        toolInput: JSON.stringify({ file_path: `${dir}/Nova_AI_全栈解决方案.pptx` }),
        toolResult: { isError: false, content: 'ok', writtenFilePath: `${dir}/Nova_AI_全栈解决方案.pptx` },
      },
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '请打开 `artifacts/nova-ai-solution/presentation.html` 查看',
      toolMessages,
    });
    expect(final.some((item) => item.path.endsWith('.pptx'))).toBe(true);
    expect(final.some((item) => item.path.endsWith('presentation.html'))).toBe(false);
    const primary = pickPrimaryDeliverableFile(final);
    expect(primary?.path).toContain('.pptx');
  });
});
