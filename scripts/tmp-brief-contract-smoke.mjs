import { createRequire } from 'node:module';
process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = '1';
process.env.PILOTDECK_SAAS_MODE = '1';
process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT = 'enforce';

const { register } = await import('tsx/esm/api');
register();
const { compileSessionDeliverableManifest } = await import('../src/saas/taskState/sessionDeliverableManifest.ts');

const goal =
  '为虚构品牌青盏茶语交付可投产的获客官网单页。使用能力官网落地页(od-saas-landing)。页面含英雄区。写入系统分配任务目录。';
const withSlug = compileSessionDeliverableManifest({
  userGoal: goal,
  capabilitySlug: 'od-saas-landing',
});
const noSlug = compileSessionDeliverableManifest({ userGoal: goal });
for (const [label, m] of [['withSlug', withSlug], ['noSlug', noSlug]]) {
  const hints = (m?.slots || []).flatMap((s) => s.pathHints || (s.pathHint ? [s.pathHint] : []));
  console.log(label, {
    profile: m?.profileId,
    slug: m?.capabilitySlug,
    anchorHasMust: /须交付/.test(m?.sessionGoalAnchor || ''),
    hasIndex: hints.some((h) => /index\.html/i.test(h)),
    hints: hints.slice(0, 6),
  });
}
