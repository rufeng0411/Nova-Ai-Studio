// PD-SAAS-FORK: Demo-aligned welcome — mode-toggle 能力/全案 + title-only cards

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import type { ProcessTemplate, ProcessTemplateCategory } from '../../../shared/processTemplates';
import { primeProcessTemplatesCache } from '../../../shared/templatesHubCache';

export type BetaWelcomeMode = 'caps' | 'playbooks';

export type BetaWelcomeCard = {
  id: string;
  title: string;
  prompt: string;
  tone: 'mkt' | 'geo' | 'office' | 'create' | 'edu' | 'dev';
};

export type BetaWelcomeProps = {
  projectName?: string;
  prompts: string[];
  onPickPrompt: (prompt: string) => void;
  onRefreshPrompts?: () => void;
  onOpenHub?: () => void;
  onOpenDiscover?: () => void;
  composer?: ReactNode;
  connectionBanner?: ReactNode;
};

const TONES: BetaWelcomeCard['tone'][] = ['mkt', 'geo', 'office', 'create', 'edu', 'dev'];

const CATEGORY_TONE: Record<ProcessTemplateCategory, BetaWelcomeCard['tone']> = {
  marketing: 'mkt',
  geo: 'geo',
  office: 'office',
  creation: 'create',
  enterprise: 'office',
};

function shuffle<T>(list: T[], rng: () => number = Math.random): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Short display title — Demo cards use names, not full try-prompt text. */
function shortTitleFromPrompt(prompt: string, maxLen = 22): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  // Prefer first clause before 「须交付」/newline/period
  const cut = clean.split(/[：:\n]|须交付|直接开始/)[0]?.trim() || clean;
  if (cut.length <= maxLen) return cut;
  return `${cut.slice(0, maxLen)}…`;
}

function capsToCards(prompts: string[]): BetaWelcomeCard[] {
  return prompts.slice(0, 6).map((prompt, i) => {
    const clean = prompt.replace(/\s+/g, ' ').trim();
    return {
      id: `wb-welcome-cap-${i}`,
      title: shortTitleFromPrompt(clean),
      prompt: clean,
      tone: TONES[i % TONES.length],
    };
  });
}

function playbooksToCards(templates: ProcessTemplate[], nonce: number): BetaWelcomeCard[] {
  return shuffle(templates)
    .slice(0, 6)
    .map((tpl, i) => ({
      id: `wb-welcome-pb-${nonce}-${tpl.id}-${i}`,
      title: (tpl.title || tpl.id).trim(),
      prompt: (tpl.prompt || '').trim() || `用「${tpl.title}」流程模板，成果写入系统分配任务目录。`,
      tone: (tpl.category && CATEGORY_TONE[tpl.category]) || TONES[i % TONES.length],
    }));
}

/** Demo-style 3-column welcome — only used when WorkbenchBetaSurface.active. */
export default function BetaWelcome({
  projectName,
  prompts,
  onPickPrompt,
  onRefreshPrompts,
  onOpenHub,
  onOpenDiscover,
  composer,
  connectionBanner,
}: BetaWelcomeProps) {
  const { t, i18n } = useTranslation('common');
  const [mode, setMode] = useState<BetaWelcomeMode>('caps');
  const [spinning, setSpinning] = useState(false);
  const [playbookNonce, setPlaybookNonce] = useState(0);
  const [templates, setTemplates] = useState<ProcessTemplate[]>(() =>
    primeProcessTemplatesCache(i18n.language),
  );

  useEffect(() => {
    setTemplates(primeProcessTemplatesCache(i18n.language));
  }, [i18n.language]);

  const capsCards = useMemo(() => capsToCards(prompts), [prompts]);
  const playbookCards = useMemo(
    () => playbooksToCards(templates, playbookNonce),
    [templates, playbookNonce],
  );
  const cards = mode === 'playbooks' ? playbookCards : capsCards;

  const onRefresh = () => {
    setSpinning(true);
    if (mode === 'playbooks') {
      setPlaybookNonce((n) => n + 1);
    } else {
      onRefreshPrompts?.();
    }
    window.setTimeout(() => setSpinning(false), 550);
  };

  return (
    <div className="wb-beta-welcome" data-testid="wb-beta-welcome">
      <div className="wb-beta-welcome-head">
        <div>
          <h1>
            {projectName
              ? t('workbenchBeta.welcome.greetingWithProject', {
                  project: projectName,
                  defaultValue: '今天想做点什么？',
                })
              : t('workbenchBeta.welcome.greeting', { defaultValue: '今天想做点什么？' })}
          </h1>
          <p className="wb-beta-welcome-sub">
            {t('workbenchBeta.welcome.sub', {
              defaultValue: '从能力或全案模板快速开跑——点卡片预填，输入框直接发送。',
            })}
          </p>
        </div>
        <div
          className="wb-beta-mode-toggle"
          role="tablist"
          aria-label={t('workbenchBeta.welcome.modeLabel', '快捷入口类型')}
          data-testid="wb-beta-welcome-mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'caps'}
            className={mode === 'caps' ? 'is-on' : undefined}
            data-mode="caps"
            data-testid="wb-beta-welcome-mode-caps"
            onClick={() => setMode('caps')}
          >
            {t('workbenchBeta.welcome.modeCaps', '能力')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'playbooks'}
            className={mode === 'playbooks' ? 'is-on' : undefined}
            data-mode="playbooks"
            data-testid="wb-beta-welcome-mode-playbooks"
            onClick={() => setMode('playbooks')}
          >
            {t('workbenchBeta.welcome.modePlaybooks', '全案')}
          </button>
        </div>
      </div>

      <div className="wb-beta-card-panel">
        <div
          className="wb-beta-card-grid"
          data-testid="wb-beta-welcome-cards"
          data-welcome-mode={mode}
          aria-live="polite"
        >
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`wb-beta-shortcut-card tone-${card.tone}`}
              data-testid={`wb-beta-welcome-card-${card.tone}`}
              title={card.title}
              onClick={() => onPickPrompt(card.prompt)}
            >
              <div className="wb-beta-card-top">
                <span className={`wb-beta-cap-ico tone-${card.tone}`} aria-hidden />
                <span className="wb-beta-card-title">{card.title}</span>
              </div>
            </button>
          ))}
        </div>
        {onRefreshPrompts || mode === 'playbooks' ? (
          <button
            type="button"
            className={`wb-beta-card-refresh${spinning ? ' is-spinning' : ''}`}
            data-testid="wb-beta-welcome-refresh"
            aria-label={t('workbenchBeta.welcome.refresh', '换一批')}
            title={t('workbenchBeta.welcome.refresh', '换一批')}
            onClick={onRefresh}
          >
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <div className="wb-beta-welcome-links">
        {onOpenHub ? (
          <button type="button" className="wb-beta-welcome-hub" onClick={onOpenHub}>
            {t('workbenchBeta.welcome.openHub', '不知道从哪开始？ → 打开能力库')}
          </button>
        ) : null}
        {onOpenDiscover ? (
          <button type="button" className="wb-beta-welcome-discover" onClick={onOpenDiscover}>
            {t('workbenchBeta.welcome.exploreAll', '探索全部能力 →')}
          </button>
        ) : null}
      </div>

      {connectionBanner}
      <div className="wb-beta-welcome-composer">{composer}</div>
    </div>
  );
}
