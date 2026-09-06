// PD-SAAS-FORK: HTML Studio chrome toolbar — save, undo, AI assist
import { useTranslation } from 'react-i18next';
import { Redo2, Save, Sparkles, Undo2 } from 'lucide-react';
import {
  PreviewChromeGroup,
  PreviewChromeIconButton,
} from '../../PreviewChromeBar';

type HtmlStudioToolbarProps = {
  dirty: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAiAssist: () => void;
  saveNotice?: string | null;
};

export default function HtmlStudioToolbar({
  dirty,
  saving,
  canUndo,
  canRedo,
  onSave,
  onUndo,
  onRedo,
  onAiAssist,
  saveNotice,
}: HtmlStudioToolbarProps) {
  const { t } = useTranslation('chat');

  return (
    <>
      <PreviewChromeGroup aria-label={t('htmlStudio.toolbar.editActions', { defaultValue: '编辑操作' }) as string}>
        <PreviewChromeIconButton
          title={t('htmlStudio.undo', { defaultValue: '撤销' }) as string}
          aria-label={t('htmlStudio.undo', { defaultValue: '撤销' }) as string}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
        <PreviewChromeIconButton
          title={t('htmlStudio.redo', { defaultValue: '恢复' }) as string}
          aria-label={t('htmlStudio.redo', { defaultValue: '恢复' }) as string}
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
        <PreviewChromeIconButton
          data-testid="html-studio-save"
          title={t('htmlStudio.save', { defaultValue: '保存' }) as string}
          aria-label={t('htmlStudio.save', { defaultValue: '保存' }) as string}
          active={dirty}
          disabled={!dirty || saving}
          onClick={onSave}
        >
          <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
      </PreviewChromeGroup>
      {saveNotice ? (
        <span className="sr-only" aria-live="polite">
          {saveNotice}
        </span>
      ) : null}
      <PreviewChromeGroup>
        <PreviewChromeIconButton
          title={t('htmlStudio.aiAssist', { defaultValue: '请 AI 协助修改版式' }) as string}
          aria-label={t('htmlStudio.aiAssist', { defaultValue: '请 AI 协助修改版式' }) as string}
          onClick={onAiAssist}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
      </PreviewChromeGroup>
    </>
  );
}
