/** PD-SAAS-FORK: Nova user-facing product version (login footer, about dialog). */
import { NOVA_PRODUCT_BUILD } from './productBuild.generated';

export const NOVA_PRODUCT_VERSION = '2.0';

export const NOVA_PRODUCT_NAME = 'Nova Ai-Studio';

/** Login / Logo caption (zh). Keep in sync with i18n `productInfo.brandCaption`. */
export const NOVA_BRAND_CAPTION_ZH = 'Nova Ai Studio 2.0 · 企业级智能体平台';

/** Login / Logo caption (en). */
export const NOVA_BRAND_CAPTION_EN = 'Nova Ai Studio 2.0 · Enterprise agent platform';

export { NOVA_PRODUCT_BUILD };

/** © Nova Ai-Studio · v2.0 build#YYYYMMDDHHmmss */
export function formatNovaProductCopyright(): string {
  return `© ${NOVA_PRODUCT_NAME} · v${NOVA_PRODUCT_VERSION} build#${NOVA_PRODUCT_BUILD}`;
}
