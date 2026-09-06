// PD-SAAS-FORK: pure validators for marketing contact / collect (testable)

export function validateContactPayload(body) {
  const displayName = String(body?.displayName ?? body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const phone = String(body?.phone ?? '').trim();
  const company = String(body?.company ?? '').trim();
  const message = String(body?.message ?? '').trim();
  const website = String(body?.website ?? '').trim(); // honeypot
  const captchaId = String(body?.captchaId ?? '').trim();
  const captchaAnswer = String(body?.captchaAnswer ?? '').trim();

  if (website) return { ok: true, honeypot: true };

  if (!displayName) return { ok: false, error: '请填写您如何称呼' };
  if (!email) return { ok: false, error: '请填写您的邮箱' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: '请填写有效的邮箱地址' };
  if (!phone) return { ok: false, error: '请填写您的手机' };
  if (!company) return { ok: false, error: '请填写您的公司' };
  if (!message) return { ok: false, error: '请填写您的诉求' };
  if (displayName.length > 80 || company.length > 120 || message.length > 4000) {
    return { ok: false, error: '填写内容过长，请精简后重试' };
  }
  if (!captchaId || !captchaAnswer) return { ok: false, error: '请填写图形验证码' };

  return {
    ok: true,
    honeypot: false,
    value: { displayName, email, phone, company, message, captchaId, captchaAnswer },
  };
}

export function validateCollectPayload(body) {
  const path = String(body?.path ?? '').trim() || '/';
  if (path.length > 512 || path.includes('..')) {
    return { ok: false, error: 'invalid_path' };
  }
  const referrer = String(body?.referrer ?? '').slice(0, 1024);
  const utmSource = String(body?.utmSource ?? body?.utm_source ?? '').slice(0, 120);
  const utmMedium = String(body?.utmMedium ?? body?.utm_medium ?? '').slice(0, 120);
  const utmCampaign = String(body?.utmCampaign ?? body?.utm_campaign ?? '').slice(0, 120);
  const sessionKey = String(body?.sessionKey ?? body?.session_key ?? '').slice(0, 64);
  return {
    ok: true,
    value: { path, referrer, utmSource, utmMedium, utmCampaign, sessionKey },
  };
}

/** Four-digit numeric invite codes only (default seed 6898). */
export function normalizeInviteCode(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\D/g, '')
    .slice(0, 4);
}

export function getDefaultInviteCode(env = process.env) {
  const raw = normalizeInviteCode(env.PILOTDECK_MARKETING_DEFAULT_INVITE || '6898');
  return /^\d{4}$/.test(raw) ? raw : '6898';
}

export function isDefaultInviteCode(code, env = process.env) {
  return normalizeInviteCode(code) === getDefaultInviteCode(env);
}
