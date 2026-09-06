/**
 * PD-SAAS-FORK: Shared product highlights body (desktop dialog panel + mobile Me sub-page).
 */
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  Cpu,
  GitBranch,
  MessageSquare,
  RefreshCw,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import novaLogoMark from './novaLogoMark';
import {
  PRODUCT_HIGHLIGHT_ACCENT,
  PRODUCT_HIGHLIGHT_ORDER,
  PRODUCT_INFO_STAT_KEYS,
  type ProductHighlightId,
} from './productHighlights';
import { NOVA_PRODUCT_NAME } from './productInfo';
import NovaProductCopyright from './NovaProductCopyright';
import '../theme/productInfoDialog.css';

type ProductInfoOverviewProps = {
  layout?: 'dialog' | 'mobile';
  onDismiss?: () => void;
};

const HIGHLIGHT_ICONS: Record<ProductHighlightId, LucideIcon> = {
  'agent-harness': Cpu,
  conversation: MessageSquare,
  'token-savings': Route,
  flywheel: RefreshCw,
  'research-growth': ScanSearch,
  capabilities: Sparkles,
  models: Boxes,
  pipeline: GitBranch,
  security: ShieldCheck,
};

export default function ProductInfoOverview({ layout = 'dialog', onDismiss }: ProductInfoOverviewProps) {
  const { t } = useTranslation('common');
  const isMobile = layout === 'mobile';

  if (isMobile) {
    return (
      <div className="product-info-overview--mobile px-3.5 py-4 pb-8">
        <div className="mb-3.5 rounded-[var(--radius)] border border-border bg-card px-4 py-4">
          <img
            src={novaLogoMark}
            alt=""
            className="h-7 w-auto max-w-[2.75rem] select-none object-contain"
            draggable={false}
          />
          <p className="product-info-brand-caption mt-2">{t('productInfo.brandCaption')}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            {t('productInfo.tagline', { defaultValue: NOVA_PRODUCT_NAME })}
          </p>
        </div>

        <div
          className="mb-3.5 grid grid-cols-3 gap-2 rounded-[var(--radius)] border border-border bg-card px-3.5 py-3.5"
          aria-label={t('productInfo.highlightsSection')}
        >
          {PRODUCT_INFO_STAT_KEYS.map((key) => (
            <div key={key} className="text-center">
              <div className="text-[17px] font-bold tracking-tight text-foreground">
                {t(`productInfo.stats.${key}.value`)}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {t(`productInfo.stats.${key}.label`)}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card" role="list">
          {PRODUCT_HIGHLIGHT_ORDER.map((id, index) => {
            const Icon = HIGHLIGHT_ICONS[id];
            const accent = PRODUCT_HIGHLIGHT_ACCENT[id];
            const isLast = index === PRODUCT_HIGHLIGHT_ORDER.length - 1;
            return (
              <article
                key={id}
                role="listitem"
                className={`product-info-card product-info-card--mobile flex gap-3 px-4 py-3.5${isLast ? '' : ' border-b border-border'}`}
                data-accent={accent}
              >
                <span className="product-info-card-icon product-info-card-icon--mobile" aria-hidden>
                  <Icon strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold leading-snug text-foreground">
                    {t(`productInfo.highlights.${id}.title`)}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {t(`productInfo.highlights.${id}.summary`)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <NovaProductCopyright className="product-info-footer product-info-footer--mobile" />
      </div>
    );
  }

  return (
    <>
      <header className="product-info-hero">
        <div className="product-info-hero-row">
          <div className="product-info-brand">
            <div className="product-info-brand-mark">
              <img
                src={novaLogoMark}
                alt=""
                className="product-info-logo"
                draggable={false}
              />
              <p className="product-info-brand-caption">{t('productInfo.brandCaption')}</p>
            </div>
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="product-info-dismiss"
              onClick={onDismiss}
              aria-label={t('buttons.close')}
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        <p id="nova-product-info-title" className="product-info-tagline">
          {t('productInfo.tagline', { defaultValue: NOVA_PRODUCT_NAME })}
        </p>
      </header>

      <div className="product-info-metrics" aria-label={t('productInfo.highlightsSection')}>
        {PRODUCT_INFO_STAT_KEYS.map((key) => (
          <div key={key} className="product-info-metric">
            <strong>{t(`productInfo.stats.${key}.value`)}</strong>
            <span>{t(`productInfo.stats.${key}.label`)}</span>
          </div>
        ))}
      </div>

      <div className="product-info-board" role="list">
        {PRODUCT_HIGHLIGHT_ORDER.map((id) => {
          const Icon = HIGHLIGHT_ICONS[id];
          const accent = PRODUCT_HIGHLIGHT_ACCENT[id];
          return (
            <article
              key={id}
              role="listitem"
              className="product-info-card"
              data-accent={accent}
            >
              <span className="product-info-card-icon" aria-hidden>
                <Icon strokeWidth={1.75} />
              </span>
              <div className="product-info-card-body">
                <h3 className="product-info-card-title">
                  {t(`productInfo.highlights.${id}.title`)}
                </h3>
                <p className="product-info-card-summary">
                  {t(`productInfo.highlights.${id}.summary`)}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <NovaProductCopyright className="product-info-footer" />
    </>
  );
}
