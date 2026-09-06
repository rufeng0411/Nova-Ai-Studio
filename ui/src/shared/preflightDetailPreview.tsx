// PD-SAAS-FORK: Preflight detail preview — iframe HTML or PNG (Super Preview column)
import type { PreflightCatalogEntry } from './preflightSelection';
import { PreflightScaledIframe } from './PreflightScaledIframe';
import { resolvePreflightPreviewSources } from './preflightPreviewResolve';
import { ColorSwatches, type PreflightThumbKind } from './preflightThumbRender';

type PreflightDetailPreviewProps = {
  item?: PreflightCatalogEntry;
  kind: PreflightThumbKind;
  className?: string;
};

export default function PreflightDetailPreview({ item, kind, className }: PreflightDetailPreviewProps) {
  if (!item) {
    return (
      <div className={`flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground ${className ?? ''}`}>
        点选左侧卡片查看风格预览
      </div>
    );
  }

  const { previewUrl, previewImageUrl } = resolvePreflightPreviewSources(item, kind, 'detail');

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-muted/20 ${className ?? ''}`}
      data-testid="preflight-detail-preview"
      data-kind={kind}
    >
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <div className="truncate text-[13px] font-semibold text-foreground">{item.label}</div>
        {item.desc || item.category || item.group ? (
          <div className="truncate text-[11px] text-muted-foreground">
            {[item.category, item.group, item.desc].filter(Boolean).join(' · ')}
          </div>
        ) : null}
        <ColorSwatches colors={item.colors} className="mt-2 flex gap-0.5" />
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#0b0c10]">
        {previewUrl ? (
          <PreflightScaledIframe src={previewUrl} title={item.label} variant="detail" loading="eager" />
        ) : previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt={item.label}
            className="h-full w-full object-contain object-center"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            预览加载中…
          </div>
        )}
      </div>
    </div>
  );
}
