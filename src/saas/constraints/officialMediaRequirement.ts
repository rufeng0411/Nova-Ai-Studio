/**
 * PD-SAAS-FORK: Compile official-media source constraints separately from SDM.
 */
export type OfficialMediaPolicy =
  | "none"
  | "official_preferred"
  | "official_only";

export type OfficialMediaSourceTier =
  | "brand_official"
  | "authorized_partner_official"
  | "platform_verified_official";

export type OfficialMediaRequirement = {
  officialMediaPolicy: OfficialMediaPolicy;
  allowedSourceTiers: OfficialMediaSourceTier[];
  allowPlaceholders: boolean;
  forbidGenerateImage: boolean;
};

const OFFICIAL_SOURCE_PATTERNS = [
  /(?:图片|配图|图像|图|素材|车辆图片)[^。；，,\n]{0,24}(?:需要|必须|须|只|仅|要)?[^。；，,\n]{0,8}(?:来自|来(?:自)?|使用|采用|选用|替换为)[^。；，,\n]{0,16}(?:品牌|联名方|品牌方|厂商|账号)?官方(?!摄影|视觉|拍摄|海报|广告|风格|风|感|调性|质感)(?:渠道|素材|图片|账号|小红书|Instagram)?/iu,
  /(?:只用|仅用|必须使用|须使用|使用)[^。；，,\n]{0,8}官方(?:渠道)?(?:图片|配图|图像|素材)/iu,
  /(?:品牌|联名方|品牌方|厂商)官方(?:渠道|账号|素材|图片)[^。；，,\n]{0,16}(?:图片|配图|图像|素材)?/iu,
  /(?:非官方)(?:图片|配图|素材)[^。；，,\n]{0,16}(?:替换|换成|改为)[^。；，,\n]{0,12}(?:真实)?官方(?:图片|配图|素材)/iu,
  // PD-SAAS-FORK VAP: 「图和资料要来自官网」 and similar without the word「官方」.
  /(?:图和资料|图片|配图|图像|图|素材|资料)[^。；，,\n]{0,24}(?:要|须|必须|只能|仅)?[^。；，,\n]{0,8}来自(?:官网|官方网站|品牌官网)/iu,
  /(?:来自|使用|采用)[^。；，,\n]{0,8}(?:官网|官方网站|品牌官网)/iu,
  /(?:官网|官方网站)[^。；，,\n]{0,16}(?:图片|配图|素材|资料)/iu,
] as const;

const EXPLICIT_URL_WITH_MEDIA =
  /https?:\/\/[^\s，。；、]+/iu;
const MEDIA_INTENT =
  /(?:图|配图|图片|图像|素材|资料|海报|主视觉|幻灯|landing|官网)/iu;

const EXPLICIT_GENERATE_IMAGE_DENY =
  /(?:禁止|不得|不要|不可|不能|严禁)[^。；，,\n]{0,12}(?:AI|人工智能|模型)?[^。；，,\n]{0,8}(?:生图|生成图片|生成图像|绘图)/iu;
const EXPLICIT_PLACEHOLDER_ALLOW =
  /(?:允许|可以|可用|接受)[^。；，,\n]{0,8}(?:占位|占位图|临时图)/iu;
const EXPLICIT_PLACEHOLDER_DENY =
  /(?:禁止|不得|不要|不可|不能|不允许)[^。；，,\n]{0,8}(?:占位|占位图|临时图)/iu;
const OFFICIAL_PREFERENCE =
  /(?:优先|尽量|最好)[^。；，,\n]{0,10}(?:使用|采用|选用)?[^。；，,\n]{0,8}官方(?:图片|配图|素材|渠道)/iu;

export function hasExplicitOfficialMediaSourceRequirement(
  userText: string,
): boolean {
  const normalized = String(userText ?? "").trim();
  if (!normalized) return false;
  return OFFICIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Explicit product/marketing URL + media intent → at least official_preferred. */
export function hasUrlBackedMediaPreference(userText: string): boolean {
  const normalized = String(userText ?? "").trim();
  if (!normalized) return false;
  return EXPLICIT_URL_WITH_MEDIA.test(normalized) && MEDIA_INTENT.test(normalized);
}

export function compileOfficialMediaRequirement(
  userText: string,
): OfficialMediaRequirement {
  const normalized = String(userText ?? "").trim();
  const officialOnly =
    hasExplicitOfficialMediaSourceRequirement(normalized);
  const officialPreferred =
    !officialOnly
    && (
      OFFICIAL_PREFERENCE.test(normalized)
      || hasUrlBackedMediaPreference(normalized)
    );
  const tiers: OfficialMediaSourceTier[] = [];

  if (officialOnly || officialPreferred) {
    tiers.push("brand_official");
    if (/联名方|合作方|授权方/iu.test(normalized)) {
      tiers.push("authorized_partner_official");
    }
    if (
      /小红书|Instagram|微博|微信|公众号|抖音|懂车帝|汽车之家|autohome|dongchedi/iu
        .test(normalized)
    ) {
      tiers.push("platform_verified_official");
    }
  }

  const explicitlyAllowsPlaceholders =
    EXPLICIT_PLACEHOLDER_ALLOW.test(normalized);
  const explicitlyDeniesPlaceholders =
    EXPLICIT_PLACEHOLDER_DENY.test(normalized);
  const forbidGenerateImage =
    officialOnly || EXPLICIT_GENERATE_IMAGE_DENY.test(normalized);

  return {
    officialMediaPolicy: officialOnly
      ? "official_only"
      : officialPreferred
        ? "official_preferred"
        : "none",
    allowedSourceTiers: tiers,
    allowPlaceholders: explicitlyDeniesPlaceholders
      ? false
      : explicitlyAllowsPlaceholders
        ? true
        : !officialOnly,
    forbidGenerateImage,
  };
}
