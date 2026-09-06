// PD-SAAS-FORK: shared assistant message typography — keep MessageRowV2 prose consistent.
export const ASSISTANT_MESSAGE_BODY_CLASS = 'min-w-0 text-[14px] leading-[1.65] text-foreground/95';

export const ASSISTANT_PROSE_CLASS = [
  'prose prose-sm prose-neutral max-w-none dark:prose-invert',
  'prose-p:my-2 prose-p:leading-[1.65]',
  'prose-headings:mt-4 prose-headings:mb-1.5 prose-headings:font-semibold prose-headings:tracking-tight',
  'prose-h2:text-[1.0625rem] prose-h3:text-[0.9375rem]',
  'prose-ol:my-2 prose-ul:my-2 prose-li:my-0.5',
  'prose-pre:my-3 prose-table:my-2 prose-table:text-[13px]',
  'prose-hr:my-5 prose-hr:border-border/50',
  'prose-strong:text-foreground prose-strong:font-semibold',
].join(' ');
