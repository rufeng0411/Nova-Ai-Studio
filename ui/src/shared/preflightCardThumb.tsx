// PD-SAAS-FORK: Preflight card thumb — real iframe/img preview, SVG fallback
import type { PreflightCatalogEntry } from './preflightSelection';
import { PreflightScaledIframe } from './PreflightScaledIframe';
import { resolvePreflightPreviewSources } from './preflightPreviewResolve';
import {
  buildPreflightThumbSvg,
  ColorSwatches,
  type PreflightThumbKind,
} from './preflightThumbRender';

type PreflightCardThumbProps = {
  item: PreflightCatalogEntry;
  kind: PreflightThumbKind;
  eager?: boolean;
};

export function PreflightCardThumb({ item, kind, eager }: PreflightCardThumbProps) {
  const { previewUrl, previewImageUrl } = resolvePreflightPreviewSources(item, kind, 'card');
  const svg = buildPreflightThumbSvg(kind, item);

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-border/40 bg-muted"
      data-eager={eager ? 'true' : 'false'}
      data-testid="preflight-card-thumb"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0b0c10]">
        {previewUrl ? (
          <PreflightScaledIframe
            src={previewUrl}
            title={item.label}
            variant="card"
            loading={eager ? 'eager' : 'lazy'}
          />
        ) : previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt=""
            className="h-full w-full object-cover object-center"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <div
            className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
      {item.ratio && kind === 'ppt-canvas' ? (
        <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white">
          {item.ratio.includes('/') ? item.ratio : item.dim}
        </span>
      ) : null}
    </div>
  );
}

export { ColorSwatches };
