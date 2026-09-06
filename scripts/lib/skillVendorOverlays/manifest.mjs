// PD-SAAS-FORK: post-vendor overlay manifest — bump 后 applySkillOverlays 恢复 Nova 定制段
import { HF_OVERLAY_SLUGS } from './novaExecOverlay.mjs';

/** @typedef {'copy' | 'ensure_section' | 'ensure_contains' | 'nova_exec' | 'inject_after_frontmatter'} OverlayActionType */

/**
 * @typedef {object} OverlayEntry
 * @property {string} slug
 * @property {string} skillDir — repo-relative
 * @property {Array<{ type: OverlayActionType, from?: string, to?: string, marker?: string, text?: string }>} actions
 * @property {Array<{ type: 'file_exists' | 'contains' | 'nova_exec', path?: string, text?: string, slug?: string }>} checks
 */

/** @type {OverlayEntry[]} */
export const OVERLAY_ENTRIES = [
  {
    slug: 'cyber-ppt',
    skillDir: 'skills/vendor/cyber-ppt/cyber-ppt',
    actions: [],
    checks: [
      { type: 'contains', path: 'SKILL.md', text: 'NOVA-EXEC-BEGIN' },
      { type: 'contains', path: 'SKILL.md', text: 'presentation.pptx' },
      { type: 'contains', path: 'SKILL.md', text: '禁止' },
    ],
  },
  {
    slug: 'geo-keyword-research',
    skillDir: 'skills/vendor/seo-geo/geo-keyword-research',
    actions: [],
    checks: [
      { type: 'contains', path: 'SKILL.md', text: 'NOVA-EXEC-BEGIN' },
      { type: 'contains', path: 'SKILL.md', text: 'keywords.md' },
      { type: 'file_exists', path: 'references/nova-keyword-template.md' },
    ],
  },
  {
    slug: 'anth-docx',
    skillDir: 'skills/vendor/anthropics-skills/anth-docx',
    actions: [
      { type: 'copy', from: 'anth-docx/references/pilotdeck-setup.md', to: 'references/pilotdeck-setup.md' },
      { type: 'ensure_section', marker: '## PilotDeck integration', from: 'anth-docx/skill-append.md' },
    ],
    checks: [
      { type: 'file_exists', path: 'references/pilotdeck-setup.md' },
      { type: 'contains', path: 'SKILL.md', text: '## PilotDeck integration' },
      { type: 'contains', path: 'SKILL.md', text: 'read_skill anth-docx' },
    ],
  },
  {
    slug: 'anth-pptx',
    skillDir: 'skills/vendor/anthropics-skills/anth-pptx',
    actions: [
      { type: 'inject_after_frontmatter', from: 'anth-pptx/skill-append.md' },
    ],
    checks: [
      { type: 'contains', path: 'SKILL.md', text: 'NOVA-EXEC-BEGIN' },
      { type: 'contains', path: 'SKILL.md', text: 'presentation.pptx' },
      { type: 'contains', path: 'SKILL.md', text: '禁止' },
      { type: 'contains', path: 'SKILL.md', text: 'read_skill anth-pptx' },
    ],
  },
  {
    slug: 'ppt-master',
    skillDir: 'skills/vendor/ppt-master',
    actions: [
      { type: 'copy', from: 'ppt-master/launch.profile.json', to: 'launch.profile.json' },
      { type: 'inject_after_frontmatter', from: 'ppt-master/skill-append.md' },
    ],
    checks: [
      { type: 'contains', path: 'SKILL.md', text: 'NOVA-EXEC-BEGIN' },
      { type: 'contains', path: 'SKILL.md', text: 'presentation.pptx' },
      { type: 'contains', path: 'SKILL.md', text: '禁止' },
      { type: 'contains', path: 'SKILL.md', text: 'Flask' },
      { type: 'contains', path: 'SKILL.md', text: 'ask_user_question' },
      { type: 'file_exists', path: 'launch.profile.json' },
      { type: 'file_exists', path: 'workflows/routing.md' },
      { type: 'file_exists', path: 'scripts/confirm_ui/static/catalogs.json' },
      { type: 'file_exists', path: 'LICENSE' },
      { type: 'contains', path: 'SKILL.md', text: 'python3 "${SKILL_DIR}/scripts/attribution_guard.py"' },
      { type: 'contains', path: 'SKILL.md', text: '4.8.0' },
    ],
  },
  {
    slug: 'create-ai-music',
    skillDir: 'skills/vendor/creation-ecosystem/create-ai-music',
    actions: [
      {
        type: 'ensure_contains',
        text: 'PilotDeck 默认通过 **Wonda**',
        from: 'create-ai-music/wonda-append.md',
      },
    ],
    checks: [
      { type: 'contains', path: 'SKILL.md', text: 'PilotDeck 默认通过 **Wonda**' },
    ],
  },
  {
    slug: 'create-vid-seedance-codec',
    skillDir: 'skills/vendor/creation-ecosystem/create-vid-seedance-codec',
    actions: [],
    checks: [
      { type: 'contains', path: 'SKILL.md', text: '夜场氛围 BGM 词' },
      { type: 'contains', path: 'SKILL.md', text: 'Bossa Nova' },
    ],
  },
  ...HF_OVERLAY_SLUGS.map((slug) => {
    const isLegacy = ['hf-website-to-video', 'hf-gsap', 'hf-hyperframes-media'].includes(slug);
    return {
      slug,
      skillDir: `skills/vendor/hyperframes/${slug}`,
      actions: isLegacy ? [] : [{ type: 'nova_exec' }],
      checks: isLegacy
        ? [
            { type: 'contains', path: 'SKILL.md', text: 'NOVA-EXEC-BEGIN' },
            { type: 'file_exists', path: 'NOVA-EXEC.md' },
          ]
        : [
            { type: 'nova_exec', slug },
            { type: 'contains', path: 'SKILL.md', text: 'NOVA-EXEC-BEGIN' },
            { type: 'file_exists', path: 'NOVA-EXEC.md' },
          ],
    };
  }),
];

export function resolveOverlaySlugs(requested) {
  if (!requested || requested.length === 0) {
    return OVERLAY_ENTRIES.map((e) => e.slug);
  }
  const set = new Set(requested.flatMap((id) => {
    if (id === 'hf-*' || id === 'hf-all') return HF_OVERLAY_SLUGS;
    return [id];
  }));
  return OVERLAY_ENTRIES.filter((e) => set.has(e.slug)).map((e) => e.slug);
}

export function getOverlayEntry(slug) {
  return OVERLAY_ENTRIES.find((e) => e.slug === slug);
}
