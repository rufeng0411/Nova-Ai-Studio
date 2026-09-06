import { describe, expect, it } from 'vitest';
import { isDeliverableListRequest } from './isDeliverableListRequest';

describe('isDeliverableListRequest', () => {
  it('detects explicit deliverable list requests', () => {
    expect(isDeliverableListRequest('你交付的内容呢，给我一个交付物列表')).toBe(true);
    expect(isDeliverableListRequest('给我一份成果清单')).toBe(true);
    expect(isDeliverableListRequest('总结一下全部交付文件')).toBe(true);
  });

  it('does not trigger on normal task goals', () => {
    expect(isDeliverableListRequest('帮我把上述报告做成动态可视化HTML')).toBe(false);
  });
});
