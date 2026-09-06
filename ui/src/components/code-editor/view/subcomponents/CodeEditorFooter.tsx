import type { ReactNode } from 'react';
import PreviewPanelFooter from '../../../shared/PreviewPanelFooter';

type CodeEditorFooterProps = {
  content: string;
  linesLabel: string;
  charactersLabel: string;
  shortcutsLabel?: string;
  onClose?: () => void;
  closeLabel?: string;
};

export default function CodeEditorFooter({
  content,
  linesLabel,
  charactersLabel,
  shortcutsLabel,
  onClose,
  closeLabel = '关闭',
}: CodeEditorFooterProps) {
  const leading: ReactNode = (
    <>
      <span>
        {linesLabel} {content.split('\n').length}
      </span>
      <span>
        {charactersLabel} {content.length}
      </span>
    </>
  );

  if (onClose) {
    return <PreviewPanelFooter onClose={onClose} closeLabel={closeLabel} leading={leading} />;
  }

  return (
    <div className="text-xxs flex flex-shrink-0 items-center justify-between border-t border-border bg-sidebar px-4 py-1.5">
      <div className="flex items-center gap-3 text-muted-foreground">{leading}</div>
      {shortcutsLabel ? (
        <div className="text-muted-foreground max-md:hidden">{shortcutsLabel}</div>
      ) : null}
    </div>
  );
}
