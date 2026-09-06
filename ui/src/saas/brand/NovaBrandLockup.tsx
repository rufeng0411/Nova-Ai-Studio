/**
 * PD-SAAS-FORK: N2 icon with optional yellow brand caption (no English wordmark image).
 */
import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { useTranslation } from 'react-i18next';
import novaLogoMark from './novaLogoMark';
import { NOVA_BRAND_CAPTION_EN, NOVA_BRAND_CAPTION_ZH } from './productInfo';

type NovaBrandLockupProps<T extends ElementType = 'div'> = {
  as?: T;
  logoClassName?: string;
  showCaption?: boolean;
  captionClassName?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

export default function NovaBrandLockup<T extends ElementType = 'div'>({
  as,
  logoClassName = 'nova-brand-logo',
  showCaption = false,
  captionClassName = 'nova-brand-caption',
  ...rest
}: NovaBrandLockupProps<T>) {
  const { t, i18n } = useTranslation('common');
  const Tag = as ?? 'div';
  const brandCaption =
    i18n.language === 'en' ? NOVA_BRAND_CAPTION_EN : NOVA_BRAND_CAPTION_ZH;

  return (
    <Tag {...rest}>
      <img
        src={novaLogoMark}
        alt={t('productInfo.title')}
        className={logoClassName}
        draggable={false}
      />
      {showCaption ? <span className={captionClassName}>{brandCaption}</span> : null}
    </Tag>
  );
}
