// PD-SAAS-FORK: Composer natural-language → Preflight Studio (open-design / ppt-master)
import { resolvePreflightRouting, dispatchOpenPreflightStudio } from './preflightStudioBridge';
import { isPreflightStudioEnabled } from './preflightStudioGate';
import {
  clearPendingLaunchContext,
  parseLaunchContextCapability,
  readPendingLaunchContext,
} from './launchContextStorage';

export type PreflightDesignIntentSlug = 'open-design' | 'ppt-master';

export type PreflightDesignIntent = {
  slug: PreflightDesignIntentSlug;
  displayName: string;
  launchMode: 'visual';
};

const DISPLAY_NAME_ZH: Record<PreflightDesignIntentSlug, string> = {
  'open-design': '设计总控',
  'ppt-master': '原生可编辑 PPT',
};

const DISPLAY_NAME_EN: Record<PreflightDesignIntentSlug, string> = {
  'open-design': 'Open Design',
  'ppt-master': 'Native editable PPT',
};

const CONTINUATION_OR_GREETING =
  /^(?:继续|接着|好的|可以了|没问题|谢谢|你好|您好|hi|hello|hey|ok(?:ay)?|thanks?)[!.?…~\s]*$/i;

const LAUNCH_CONTEXT_MARKUP = /<launch-context/i;

const STYLE_ALREADY_SPECIFIED =
  /(?:用|采用|使用|基于|按照|follow(?:ing)?|using|with)\s*[\w\s.-]{2,32}\s*(?:风格|设计系统|模板|theme|design\s*system|template)/i;

const NAMED_DESIGN_SYSTEM =
  /\b(?:linear(?:-app)?|stripe|notion|supabase|vercel|airbnb|figma|agentic|graphite|tailwind)\b/i;

const EXPORT_OR_CONVERT_FOLLOWUP =
  /(?:导出|转换|转成|做成|export|convert)\s*(?:为|成|to)?\s*(?:pdf|ppt|pptx|word|docx|html)/i;

const OD_SURFACE =
  /(?:网页|网站|落地页|官网|页面|界面|ui|ux|web\s*page|website|landing\s*page|web\s*site|homepage|home\s*page|poster|海报|宣传(?:页|图|海报)?|banner|flyer|brochure|open\s*design|设计系统|设计总控)/i;

const OD_VERB =
  /(?:设计|做|制作|创建|搭建|开发|design|create|build|make)\s*(?:一个|一张|一套|个|页|份|a|an|the)?/i;

const OD_INTENT =
  /(?:我想|想要|需要|帮我|请|我要|i\s*(?:want|need|'d\s*like)|help\s*me|please)\s*(?:设计|做|制作|create|design|build)/i;

const PPT_SURFACE =
  /(?:ppt|pptx|幻灯|演示(?:稿|片)?|路演|deck|slide\s*deck|presentation|keynote|pitch\s*deck)/i;

const PPT_VERB =
  /(?:做|制作|设计|生成|创建|写|make|create|design|build|generate)\s*(?:一个|一份|一套|a|an|the)?/i;

export function resolvePreflightDisplayName(
  slug: PreflightDesignIntentSlug,
  locale?: string,
): string {
  const lang = (locale ?? '').toLowerCase();
  if (lang.startsWith('zh')) return DISPLAY_NAME_ZH[slug];
  return DISPLAY_NAME_EN[slug];
}

export function messageAlreadySpecifiesDesignStyle(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (STYLE_ALREADY_SPECIFIED.test(trimmed)) return true;
  if (NAMED_DESIGN_SYSTEM.test(trimmed)) return true;
  return false;
}

export function detectPreflightDesignIntent(
  rawText: string,
  locale?: string,
): PreflightDesignIntent | null {
  const text = rawText.trim();
  const hasStrongSignal =
    PPT_SURFACE.test(text)
    || OD_SURFACE.test(text)
    || /\bopen\s*design\b/i.test(text)
    || /设计总控/.test(text);
  if (!text || (text.length < 4 && !hasStrongSignal)) return null;
  if (CONTINUATION_OR_GREETING.test(text)) return null;
  if (LAUNCH_CONTEXT_MARKUP.test(text)) return null;
  if (EXPORT_OR_CONVERT_FOLLOWUP.test(text)) return null;
  if (messageAlreadySpecifiesDesignStyle(text)) return null;

  let slug: PreflightDesignIntentSlug | null = null;

  if (PPT_SURFACE.test(text) && (PPT_VERB.test(text) || OD_INTENT.test(text))) {
    slug = 'ppt-master';
  } else if (
    OD_SURFACE.test(text)
    || (OD_VERB.test(text) && /(?:网页|网站|页面|海报|web|site|page|poster|design)/i.test(text))
    || (OD_INTENT.test(text) && OD_SURFACE.test(text))
    || /\bopen\s*design\b/i.test(text)
    || /设计总控/.test(text)
  ) {
    slug = 'open-design';
  }

  if (!slug) return null;

  return {
    slug,
    displayName: resolvePreflightDisplayName(slug, locale),
    launchMode: 'visual',
  };
}

export type TryOpenPreflightFromComposerInput = {
  message: string;
  locale?: string;
  sessionId?: string | null;
  hasAttachments?: boolean;
};

export function tryOpenPreflightFromComposerMessage(
  input: TryOpenPreflightFromComposerInput,
): PreflightDesignIntent | null {
  if (!isPreflightStudioEnabled()) return null;

  const intent = detectPreflightDesignIntent(input.message, input.locale);
  if (!intent) return null;

  const pending = readPendingLaunchContext();
  if (pending) {
    const pendingCap = parseLaunchContextCapability(pending);
    if (pendingCap === intent.slug) {
      return null;
    }
    clearPendingLaunchContext();
  }

  const routing = resolvePreflightRouting({
    slug: intent.slug,
    launchMode: intent.launchMode,
    source: 'capability',
  });
  if (!routing.openPreflight) return null;

  return intent;
}

/** Intercept composer send → open Preflight rail; returns true when send should stop. */
export function interceptComposerPreflightDesign(
  input: TryOpenPreflightFromComposerInput,
): boolean {
  const intent = tryOpenPreflightFromComposerMessage(input);
  if (!intent) return false;

  dispatchOpenPreflightStudio({
    slug: intent.slug,
    displayName: intent.displayName,
    fallbackPrompt: input.message.trim(),
    sessionId: input.sessionId ?? undefined,
    source: 'composer',
    autoSubmitAfterConfirm: true,
  });
  return true;
}
