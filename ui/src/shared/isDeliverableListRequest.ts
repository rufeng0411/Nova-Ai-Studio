// PD-SAAS-FORK: detect user asking for a deliverable inventory in chat
const DELIVERABLE_LIST_REQUEST_RE =
  /(?:成果列表|成果清单|成果汇总|交付物列表|交付文件列表|交付汇总|交付内容|交付的文件|交付物呢|交付的内容|给我.{0,12}(?:列表|清单|汇总)|总结一下.{0,12}(?:交付|成果)|所有交付|全部交付|有哪些文件|文件列表)/;

export function isDeliverableListRequest(text: string): boolean {
  const normalized = String(text ?? '').trim();
  if (!normalized) return false;
  return DELIVERABLE_LIST_REQUEST_RE.test(normalized);
}
