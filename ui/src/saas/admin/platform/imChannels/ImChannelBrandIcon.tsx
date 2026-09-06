/**
 * PD-SAAS-FORK: IM channel brand marks (WeCom / DingTalk / WhatsApp).
 * Inline SVG with official brand colors for crisp admin UI.
 */
export type ImBrandId = 'wecom' | 'dingtalk' | 'whatsapp';

type Props = {
  brand: ImBrandId;
  size?: number;
  className?: string;
  title?: string;
};

/** Official-ish brand fills */
const BRAND = {
  wecom: '#07C160',
  dingtalk: '#0089FF',
  whatsapp: '#25D366',
} as const;

export default function ImChannelBrandIcon({
  brand,
  size = 22,
  className,
  title,
}: Props) {
  const label =
    title
    || (brand === 'wecom' ? '企业微信' : brand === 'dingtalk' ? '钉钉' : 'WhatsApp');

  return (
    <span
      className={className ?? 'saas-admin-im-brand-icon'}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      title={label}
    >
      {brand === 'wecom' ? <WecomMark /> : null}
      {brand === 'dingtalk' ? <DingtalkMark /> : null}
      {brand === 'whatsapp' ? <WhatsappMark /> : null}
    </span>
  );
}

/** 企业微信 / WeCom — green speech-bubble mark */
function WecomMark() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
      <rect width="48" height="48" rx="10" fill={BRAND.wecom} />
      <path
        fill="#fff"
        d="M18.2 14.5c-5.4 0-9.8 3.7-9.8 8.3 0 2.6 1.5 4.9 3.8 6.4l-.9 3.3 3.7-1.9c1 .3 2 .4 3.2.4.3 0 .7 0 1-.1-.2-.7-.3-1.4-.3-2.1 0-4.8 4.6-8.7 10.3-8.7.3 0 .7 0 1 .1-1.2-3.4-5.1-5.7-9.9-5.7h-.1zm-3.6 5.2a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8zm7.3 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z"
      />
      <path
        fill="#fff"
        d="M35.2 22.2c-4.8 0-8.7 3.3-8.7 7.4 0 2.3 1.3 4.4 3.4 5.7l-.8 2.9 3.3-1.7c.9.2 1.8.4 2.8.4 4.8 0 8.7-3.3 8.7-7.3s-3.9-7.4-8.7-7.4zm-3.2 5.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zm6.4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z"
        opacity="0.95"
      />
    </svg>
  );
}

/** 钉钉 — blue rounded mark with stylized “D / nail” glyph */
function DingtalkMark() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
      <rect width="48" height="48" rx="10" fill={BRAND.dingtalk} />
      <path
        fill="#fff"
        d="M24.2 10.5c-.4 2.6-1.6 5.2-3.4 7.4-1.2 1.5-2.1 2.4-3.6 3.5 2.6.2 5.1.1 7.6-.4-.3 1.6-.8 3.1-1.5 4.5-2.1-.4-4-.7-6.1-.7 1.9 2.4 4.2 4.3 6.9 5.5l-1.1 2.6c-4.2-1.6-7.6-4.2-10-7.7-.3-.5-.1-1.1.4-1.4 2.2-1.3 3.7-2.6 5.1-4.4 1.8-2.3 3-5 3.5-7.9.1-.6.8-.9 1.3-.6.4.2.7.6.7 1.1l.2-.1z"
      />
      <path
        fill="#fff"
        d="M28.5 27.2c2.4 1.4 4.5 3.3 6 5.6.3.5.1 1.1-.4 1.4-.5.3-1.1.1-1.4-.4-1.3-2-3.1-3.6-5.2-4.8-.5-.3-.7-.9-.4-1.4.3-.5.9-.7 1.4-.4z"
        opacity="0.9"
      />
      <circle cx="31.5" cy="18.5" r="2.2" fill="#fff" />
    </svg>
  );
}

/** WhatsApp — official green + phone glyph (Simple Icons-compatible path) */
function WhatsappMark() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
      <rect width="48" height="48" rx="10" fill={BRAND.whatsapp} />
      <path
        fill="#fff"
        d="M24 11.2c-7.1 0-12.8 5.7-12.8 12.8 0 2.3.6 4.4 1.7 6.3L11 37l6.9-1.8c1.8 1 3.9 1.5 6.1 1.5 7.1 0 12.8-5.7 12.8-12.8S31.1 11.2 24 11.2zm0 23.3c-2.1 0-4.1-.6-5.8-1.6l-.4-.2-4.1 1.1 1.1-4-.3-.4a10.5 10.5 0 0 1-1.6-5.7c0-5.8 4.7-10.5 10.5-10.5S34.5 17.4 34.5 23.2 29.8 34.5 24 34.5zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.1 4.9 4.3 1.8.8 2.5.9 3.4.7.5-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"
      />
    </svg>
  );
}
