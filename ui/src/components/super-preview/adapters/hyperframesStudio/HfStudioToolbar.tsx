// PD-SAAS-FORK: HyperFrames Studio toolbar — save / render / AI assist
import { useTranslation } from 'react-i18next';
import { Clapperboard, Save, Sparkles } from 'lucide-react';
import {
  PreviewChromeGroup,
  PreviewChromeIconButton,
} from '../../PreviewChromeBar';

type HfStudioToolbarProps = {
  dirty: boolean;
  saving: boolean;
  rendering: boolean;
  onSave: () => void;
  onRenderDraft: () => void;
  onRenderHigh: () => void;
  onAiAssist: () => void;
  saveNotice?: string | null;
  renderNotice?: string | null;
};

export default function HfStudioToolbar({
  dirty,
  saving,
  rendering,
  onSave,
  onRenderDraft,
  onRenderHigh,
  onAiAssist,
  saveNotice,
  renderNotice,
}: HfStudioToolbarProps) {
  const { t } = useTranslation('chat');

  return (
    <>
      <PreviewChromeGroup aria-label={t('hfStudio.toolbar.editActions', { defaultValue: '编辑操作' }) as string}>
        <PreviewChromeIconButton
          title={t('hfStudio.save', { defaultValue: '保存' }) as string}
          aria-label={t('hfStudio.save', { defaultValue: '保存' }) as string}
          active={dirty}
          disabled={!dirty || saving}
          onClick={onSave}
        >
          <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
      </PreviewChromeGroup>
      <PreviewChromeGroup>
        <PreviewChromeIconButton
          data-testid="hf-studio-render-btn"
          title={t('hfStudio.renderDraft', { defaultValue: '草稿渲染' }) as string}
          aria-label={t('hfStudio.renderDraft', { defaultValue: '草稿渲染' }) as string}
          disabled={rendering}
          onClick={onRenderDraft}
        >
          <Clapperboard className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
        <PreviewChromeIconButton
          title={t('hfStudio.renderHigh', { defaultValue: '高质量渲染' }) as string}
          aria-label={t('hfStudio.renderHigh', { defaultValue: '高质量渲染' }) as string}
          disabled={rendering}
          onClick={onRenderHigh}
        >
          <Clapperboard className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
        </PreviewChromeIconButton>
      </PreviewChromeGroup>
      <PreviewChromeGroup>
        <PreviewChromeIconButton
          title={t('hfStudio.aiAssist', { defaultValue: '请 AI 协助' }) as string}
          aria-label={t('hfStudio.aiAssist', { defaultValue: '请 AI 协助' }) as string}
          onClick={onAiAssist}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
        </PreviewChromeIconButton>
      </PreviewChromeGroup>
      {saveNotice || renderNotice ? (
        <span className="sr-only" aria-live="polite">
          {saveNotice ?? renderNotice}
        </span>
      ) : null}
    </>
  );
}
