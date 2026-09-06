import type { ReactNode } from 'react';
import { PreviewChromeCloseButton } from '../super-preview/PreviewChromeBar';

type PreviewPanelFooterProps = {
  onClose: () => void;
  closeLabel: string;
  leading?: ReactNode;
};

/** Bottom bar close control — replaces legacy "Press Esc to close" hint in preview panels. */
export default function PreviewPanelFooter({ onClose, closeLabel, leading }: PreviewPanelFooterProps) {
  return (
    <div
      className="text-xxs flex flex-shrink-0 items-center justify-between border-t border-border bg-sidebar px-4 py-1.5"
      data-testid="preview-panel-footer"
    >
      <div className="flex min-w-0 items-center gap-3 text-muted-foreground">{leading ?? <span aria-hidden />}</div>
      <PreviewChromeCloseButton onClose={onClose} label={closeLabel} />
    </div>
  );
}
