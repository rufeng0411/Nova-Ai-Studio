import { describe, expect, it } from 'vitest';
import { resolveDeliverableFileIcon } from './deliverableFileIcon';
import { classifyDeliverablePath } from './artifactPaths';

describe('resolveDeliverableFileIcon', () => {
  it('matches file-tree colors for common deliverable extensions', () => {
    expect(resolveDeliverableFileIcon('report.md', classifyDeliverablePath('report.md')).colorClass).toBe('text-blue-500');
    expect(resolveDeliverableFileIcon('index.html', classifyDeliverablePath('index.html')).colorClass).toBe('text-orange-600');
    expect(resolveDeliverableFileIcon('deck.pdf', classifyDeliverablePath('deck.pdf')).colorClass).toBe('text-red-600');
  });
});
