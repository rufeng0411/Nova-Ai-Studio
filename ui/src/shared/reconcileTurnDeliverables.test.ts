import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';
import { collectTurnAllArtifacts } from './collectDeliverables';
import { inferTurnArtifactDirectory, reconcileTurnDeliverables } from './reconcileTurnDeliverables';
import { pickPrimaryDeliverableFile } from './pickPrimaryDeliverable';

function toolItem(path: string): DeliverableItem {
  return {
    id: `html:${path.toLowerCase()}`,
    path,
    apiPath: path,
    kind: 'html',
    source: 'tool',
    toolName: 'write_file',
  };
}

function textItem(path: string, kind: DeliverableItem['kind'] = 'image'): DeliverableItem {
  return {
    id: `${kind}:${path.toLowerCase()}`,
    path,
    apiPath: path,
    kind,
    source: 'text',
  };
}

describe('reconcileTurnDeliverables', () => {
  it('drops phantom slide-01.png from assistant prose when not written this turn', () => {
    const items = [
      toolItem('artifacts/slides-rog-nuc-2025/slides.html'),
      toolItem('artifacts/slides-rog-nuc-2025/outline.json'),
      textItem('slide-01.png'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.some((item) => item.path.endsWith('slide-01.png'))).toBe(false);
    expect(reconciled.some((item) => item.path.includes('slides-rog-nuc-2025/slides.html'))).toBe(true);
  });

  it('re-anchors bare slides.html to the turn folder', () => {
    const items = [
      toolItem('artifacts/slides-rog-nuc-2025/slide-manifest.json'),
      textItem('slides.html', 'html'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.some((item) => item.path === 'artifacts/slides-rog-nuc-2025/slides.html')).toBe(true);
  });

  it('re-anchors bare index.html to the turn folder', () => {
    const items = [
      toolItem('artifacts/design/chang-tiao-20260609-1430/index.html'),
      textItem('index.html', 'html'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.some((item) => item.path === 'artifacts/design/chang-tiao-20260609-1430/index.html')).toBe(
      true,
    );
  });

  it('drops index.html prose paths from another design folder', () => {
    const items = [
      toolItem('artifacts/design/chang-tiao-20260609-1430/index.html'),
      textItem('artifacts/design/old-brand-20260101/index.html', 'html'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.some((item) => item.path.includes('old-brand'))).toBe(false);
    expect(reconciled.some((item) => item.path.includes('chang-tiao-20260609-1430'))).toBe(true);
  });

  it('drops cross-deck slide-manifest paths from assistant prose', () => {
    const items = [
      toolItem('artifacts/slides-ai-business-growth-20260616/slide-manifest.json'),
      textItem('artifacts/slides-ming-arch-guofeng/slide-manifest.json', 'code'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.some((item) => item.path.includes('ming-arch-guofeng'))).toBe(false);
    expect(reconciled.some((item) => item.path.includes('ai-business-growth'))).toBe(true);
  });

  it('re-anchors bare slide-manifest.json to the turn folder', () => {
    const items = [
      toolItem('artifacts/slides-ai-business-growth-20260616/slide-01.png'),
      toolItem('artifacts/slides-ai-business-growth-20260616/slide-manifest.json'),
      textItem('slide-manifest.json', 'code'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.some((item) => item.path === 'artifacts/slides-ai-business-growth-20260616/slide-manifest.json')).toBe(
      true,
    );
  });

  it('pickPrimaryDeliverable prefers tool output in the inferred turn folder', () => {
    const items = reconcileTurnDeliverables([
      toolItem('artifacts/slides-rog-nuc-2025/slides.html'),
      textItem('slide-01.png'),
      textItem('artifacts/slides-ming-arch/ming-architecture-slides.html', 'html'),
    ]);
    const primary = pickPrimaryDeliverableFile(items);
    expect(primary?.path).toContain('slides-rog-nuc-2025');
  });

  it('collectTurnAllArtifacts applies reconciliation end-to-end', () => {
    const items = collectTurnAllArtifacts({
      assistantText: '配图见 slide-01.png，主文件 slides.html',
      toolMessages: [
        {
          id: 'w1',
          type: 'assistant',
          content: '',
          timestamp: '2026-06-11T00:00:00.000Z',
          isToolUse: true,
          toolName: 'write_file',
          toolId: 'w1',
          toolInput: JSON.stringify({ file_path: 'artifacts/slides-rog-nuc-2025/slides.html' }),
          toolResult: { isError: false, content: 'ok', writtenFilePath: 'artifacts/slides-rog-nuc-2025/slides.html' },
        },
      ],
    });
    expect(items.some((item) => item.path.endsWith('slide-01.png'))).toBe(false);
    expect(items.some((item) => item.path.includes('slides-rog-nuc-2025/slides.html'))).toBe(true);
  });

  it('re-anchors tool bare index.html to the turn folder', () => {
    const items = [
      toolItem('artifacts/collision-b/index.html'),
      toolItem('index.html'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.every((item) => item.path.includes('collision-b'))).toBe(true);
    expect(reconciled.some((item) => item.path === 'artifacts/collision-b/index.html')).toBe(true);
  });

  it('infers turn directory from tool writes', () => {
    expect(
      inferTurnArtifactDirectory([
        toolItem('artifacts/slides-rog-nuc-2025/slides.html'),
        textItem('artifacts/slides-ming-arch/outline.json', 'code'),
      ]),
    ).toBe('artifacts/slides-rog-nuc-2025');
  });

  it('infers turn directory from slug folders like 0608/', () => {
    expect(
      inferTurnArtifactDirectory([
        toolItem('0608/ROG品牌舆情深度调研报告.md'),
      ]),
    ).toBe('0608');
  });

  it('re-anchors bare markdown filename to slug turn folder', () => {
    const items = [
      toolItem('0608/ROG品牌舆情深度调研报告.md'),
      textItem('ROG品牌舆情深度调研报告.md', 'document'),
    ];
    const reconciled = reconcileTurnDeliverables(items);
    expect(reconciled.every((item) => item.path.startsWith('0608/'))).toBe(true);
  });
});
