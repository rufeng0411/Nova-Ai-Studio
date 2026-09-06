// PD-SAAS-FORK: batch → upstream vendor manifest（§18.4 权威清单）
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './vendorSkillPackCore.mjs';

/** @typedef {{ id: string; vendorRoot: string; repo: string; localDirEnv?: string; sparsePaths?: string[]; license?: string; mappings: Array<{ sourcePath: string; vendoredSlug: string }>; overlaySlugs?: string[] }} VendorBatchPack */

/** @type {Record<string, VendorBatchPack[]>} */
export const VENDOR_BATCH_MANIFEST = {
  batch_dev_quality_superpowers: [{
    id: 'superpowers',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'superpowers'),
    repo: 'https://github.com/obra/superpowers.git',
    localDirEnv: 'SUPERPOWERS_LOCAL_DIR',
    license: 'See obra/superpowers',
    mappings: [{ sourcePath: 'skills/brainstorming', vendoredSlug: 'obra-brainstorming' }],
  }],
  batch_dev_quality_mattpocock: [{
    id: 'mattpocock',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'mattpocock'),
    repo: 'https://github.com/mattpocock/skills.git',
    localDirEnv: 'MATTPOCOCK_SKILLS_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'matt-tdd' }],
  }],
  batch_browser: [{
    id: 'agent-browser',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'browser-agent'),
    repo: 'https://github.com/vercel-labs/agent-browser.git',
    localDirEnv: 'AGENT_BROWSER_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'dev-agent-browser' }],
  }],
  batch_video_shotcraft: [{
    id: 'video-shotcraft',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'video-shotcraft'),
    repo: 'https://github.com/Vincentwei1021/video-shotcraft.git',
    localDirEnv: 'VIDEO_SHOTCRAFT_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'create-video-shotcraft' }],
  }],
  batch_crawl_stack: [{
    id: 'scrapling',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'crawl-stack'),
    repo: 'https://github.com/D4Vinci/Scrapling.git',
    localDirEnv: 'SCRAPLING_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'fc-scrapling' }],
  }],
  batch_knowledge_graph: [{
    id: 'graphify',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'graphify'),
    repo: 'https://github.com/Graphify-Labs/graphify.git',
    localDirEnv: 'GRAPHIFY_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'dev-graphify' }],
  }],
  batch_superpowers_zh: [{
    id: 'superpowers-zh',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'superpowers-zh'),
    repo: 'https://github.com/superpowers-zh/superpowers-zh.git',
    localDirEnv: 'SUPERPOWERS_ZH_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'superpowers-zh' }],
  }],
  batch_immersive_web: [{
    id: 'scroll-world',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'scroll-world'),
    repo: 'https://github.com/oso95/scroll-world.git',
    localDirEnv: 'SCROLL_WORLD_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'create-scroll-world' }],
  }],
  batch_research_studio: [{
    id: 'research-studio',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'research-studio'),
    repo: 'https://github.com/microsoft/ResearchStudio.git',
    localDirEnv: 'RESEARCH_STUDIO_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'dev-research-studio' }],
  }],
  batch_frontend: [{
    id: 'shadcn-ui',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'frontend-skills'),
    repo: 'https://github.com/shadcn/ui.git',
    localDirEnv: 'SHADCN_UI_LOCAL_DIR',
    sparsePaths: ['packages/shadcn'],
    license: 'See upstream',
    mappings: [{ sourcePath: 'packages/shadcn', vendoredSlug: 'dev-shadcn-ui' }],
  }],
  batch_chinese_social: [{
    id: 'skill-hub-cn',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'skill-hub-cn'),
    repo: 'https://github.com/kevinaimonster/skill-hub.git',
    localDirEnv: 'SKILL_HUB_CN_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'cn-skill-hub' }],
  }],
  batch_content: [{
    id: 'baoyu-skills',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'baoyu'),
    repo: 'https://github.com/JimLiu/baoyu-skills.git',
    localDirEnv: 'BAOYU_SKILLS_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'content-baoyu' }],
  }],
  batch_marketing_audit: [{
    id: 'squirrelscan',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'marketing-audit'),
    repo: 'https://github.com/squirrelscan/skills.git',
    localDirEnv: 'SQUIRRELSCAN_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'mkt-squirrelscan' }],
  }],
  batch_office_legal: [{
    id: 'lawvable',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'office-legal'),
    repo: 'https://github.com/lawvable/agent-skills.git',
    localDirEnv: 'LAWVABLE_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'legal-lawvable-pack' }],
  }],
  batch_devops_security: [{
    id: 'trailofbits',
    vendorRoot: path.join(REPO_ROOT, 'skills', 'vendor', 'devops-security'),
    repo: 'https://github.com/trailofbits/skills.git',
    localDirEnv: 'TRAILOFBITS_SKILLS_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'dev-trailofbits-pack' }],
  }],
};

export function runVendorBatch(batchKey, logTag) {
  const packs = VENDOR_BATCH_MANIFEST[batchKey];
  if (!packs?.length) {
    throw new Error(`Unknown vendor batch: ${batchKey}`);
  }
  let total = 0;
  for (const pack of packs) {
    try {
      const result = vendorSkillMappings({
        logTag: `${logTag}:${pack.id}`,
        vendorRoot: pack.vendorRoot,
        repo: pack.repo,
        localDirEnv: pack.localDirEnv,
        sparsePaths: pack.sparsePaths,
        license: pack.license,
        mappings: pack.mappings,
        overlaySlugs: pack.overlaySlugs || [],
      });
      total += result.count;
    } catch (error) {
      console.warn(`${logTag} skip ${pack.id}: ${error.message}`);
    }
  }
  console.log(`${logTag} done skills=${total} batch=${batchKey}`);
  return total;
}
