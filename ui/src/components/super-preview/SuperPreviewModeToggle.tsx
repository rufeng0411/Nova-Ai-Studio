// PD-SAAS-FORK: SuperPreview view/edit mode toggle (design canvas gate)
import { Eye, Pencil } from 'lucide-react';
import { PreviewChromeGroup, PreviewChromeIconButton } from './PreviewChromeBar';

export type SuperPreviewMode = 'view' | 'edit';

type SuperPreviewModeToggleProps = {
  mode: SuperPreviewMode;
  onModeChange: (mode: SuperPreviewMode) => void;
  editDisabled?: boolean;
  editDisabledReason?: string;
};

export default function SuperPreviewModeToggle({
  mode,
  onModeChange,
  editDisabled = false,
  editDisabledReason,
}: SuperPreviewModeToggleProps) {
  return (
    <PreviewChromeGroup role="group" aria-label="预览模式">
      <PreviewChromeIconButton
        data-testid="super-preview-mode-view"
        active={mode === 'view'}
        title="查看"
        aria-label="查看"
        aria-pressed={mode === 'view'}
        onClick={() => onModeChange('view')}
      >
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
      </PreviewChromeIconButton>
      <PreviewChromeIconButton
        data-testid="super-preview-mode-edit"
        active={mode === 'edit'}
        title={editDisabled ? editDisabledReason : '编辑'}
        aria-label="编辑"
        aria-pressed={mode === 'edit'}
        disabled={editDisabled}
        onClick={() => {
          if (!editDisabled) onModeChange('edit');
        }}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
      </PreviewChromeIconButton>
    </PreviewChromeGroup>
  );
}
