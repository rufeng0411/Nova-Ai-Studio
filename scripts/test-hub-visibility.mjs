#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Hub 可见性 + 金融 Tab 门禁
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyTaxonomyToSkill,
  matchesHubFilter,
  matchesMajorCategory,
} from './lib/capabilityHubTaxonomy.mjs';
import {
  filterCapabilitiesByHubVisibility,
  isCapabilityDirectlyVisibleInHubAdmin,
  isCapabilityVisibleForHubAdmin,
  isCategoryVisible,
  loadHubVisibility,
  mergeHubVisibilityPatch,
  normalizeHubVisibilityDoc,
} from './lib/hubVisibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const capabilities = (catalog.skills || []).map((s) => applyTaxonomyToSkill({ ...s }));

  const financeVisible = capabilities.filter(
    (item) => !item.hidden_in_hub && matchesMajorCategory('finance', item),
  );
  assert(financeVisible.length >= 40, `finance tab should have >=40 visible skills, got ${financeVisible.length}`);

  const pricing = capabilities.find((item) => item.slug === 'mkt-pricing');
  assert(pricing && matchesMajorCategory('finance', pricing), 'mkt-pricing should belong to finance');
  assert(matchesMajorCategory('marketing', pricing), 'mkt-pricing should dual-show in marketing');

  const metrics = capabilities.find((item) => item.slug === 'pmd-finance-metrics-quickref');
  assert(metrics && !metrics.hidden_in_hub, 'pmd-finance-metrics-quickref should be hub visible');

  const doc = normalizeHubVisibilityDoc(loadHubVisibility(true));
  const baselineCount = filterCapabilitiesByHubVisibility(capabilities, doc).length;
  const hiddenDoc = mergeHubVisibilityPatch(doc, {
    capabilities: { 'mkt-pricing': false },
  });
  const afterHide = filterCapabilitiesByHubVisibility(capabilities, hiddenDoc);
  assert(afterHide.length === baselineCount - 1, 'hiding slug should reduce hub capabilities by 1');

  assert(isCategoryVisible('finance', doc) === (doc.categories.finance !== false), 'finance visibility follows hub-visibility.json');
  assert(!isCategoryVisible('development', doc), 'development should be hidden by default');
  assert(!isCategoryVisible('brainstorming', doc), 'brainstorming should be hidden by default');
  assert(!isCategoryVisible('enterprise_compliance', doc), 'enterprise_compliance should be hidden by default');

  const ecOnlySlugs = capabilities
    .filter((item) => {
      if (item.major_category !== 'enterprise_compliance' || item.hidden_in_hub) return false;
      return (item.secondary_categories ?? []).length === 0;
    })
    .map((item) => item.slug);
  const hiddenEcDoc = mergeHubVisibilityPatch(doc, {
    categories: { enterprise_compliance: false },
  });
  const shownEcDoc = normalizeHubVisibilityDoc({
    ...doc,
    categories: { ...doc.categories, enterprise_compliance: undefined },
  });
  delete shownEcDoc.categories.enterprise_compliance;
  const afterEcHide = filterCapabilitiesByHubVisibility(capabilities, hiddenEcDoc);
  const afterEcShow = filterCapabilitiesByHubVisibility(capabilities, shownEcDoc);
  for (const slug of ecOnlySlugs) {
    assert(!afterEcHide.some((item) => item.slug === slug), `ec-only ${slug} should hide when tab off`);
    assert(afterEcShow.some((item) => item.slug === slug), `ec-only ${slug} should show when tab on`);
  }
  assert(isCategoryVisible('enterprise_compliance', shownEcDoc), 'enterprise_compliance visible after restore');

  // 后台卡片眼睛：分类隐藏时仍应反映 slug 级开关（不应被分类级联成永远闭眼）
  const sampleEc = capabilities.find((item) => item.slug === 'comp-contract-review');
  assert(sampleEc, 'comp-contract-review fixture');
  const catHiddenDoc = mergeHubVisibilityPatch(doc, { categories: { enterprise_compliance: false } });
  assert(
    !isCapabilityVisibleForHubAdmin(sampleEc, 'enterprise_compliance', catHiddenDoc),
    'effective admin visibility respects hidden category',
  );
  assert(
    isCapabilityDirectlyVisibleInHubAdmin(sampleEc, 'enterprise_compliance', catHiddenDoc),
    'direct admin card visibility ignores category gate by default visible slug',
  );

  for (const major of ['media', 'education', 'finance']) {
    assert(!isCategoryVisible(major, doc), `${major} should be hidden per hub-visibility.json`);
    const hiddenMajorDoc = mergeHubVisibilityPatch(doc, { categories: { [major]: false } });
    const shownMajorDoc = normalizeHubVisibilityDoc({
      ...doc,
      categories: { ...doc.categories },
    });
    delete shownMajorDoc.categories[major];
    const majorSlugs = capabilities
      .filter((item) => {
        if (item.hidden_in_hub) return false;
        if (item.major_category !== major) return false;
        return (item.secondary_categories ?? []).length === 0;
      })
      .map((item) => item.slug);
    if (majorSlugs.length === 0) continue;
    const afterMajorHide = filterCapabilitiesByHubVisibility(capabilities, hiddenMajorDoc);
    const afterMajorShow = filterCapabilitiesByHubVisibility(capabilities, shownMajorDoc);
    for (const slug of majorSlugs.slice(0, 3)) {
      assert(!afterMajorHide.some((item) => item.slug === slug), `${major}-only ${slug} should hide when tab off`);
      assert(afterMajorShow.some((item) => item.slug === slug), `${major}-only ${slug} should show when tab on`);
    }
  }

  const hiddenFinanceDoc = mergeHubVisibilityPatch(doc, {
    categories: { finance: false },
  });
  const financeOnlySlugs = capabilities
    .filter((item) => {
      if (item.major_category !== 'finance') return false;
      const secondaries = item.secondary_categories ?? [];
      return secondaries.length === 0;
    })
    .map((item) => item.slug);
  const afterFinanceHide = filterCapabilitiesByHubVisibility(capabilities, hiddenFinanceDoc);
  for (const slug of financeOnlySlugs) {
    assert(!afterFinanceHide.some((item) => item.slug === slug), `finance-only ${slug} should hide when finance tab off`);
  }

  assert(
    matchesHubFilter(
      capabilities.find((item) => item.slug === 'anth-xlsx'),
      'finance',
      'finance',
      '',
      'all',
      'fin_fpa_model',
    ),
    'anth-xlsx should match finance fin_fpa_model',
  );

  // 子类隐藏 / 恢复：全量 doc 替换语义（与 PUT admin/hub-visibility 一致）
  const hiddenSubDoc = normalizeHubVisibilityDoc({
    ...doc,
    subcategories: { 'office:doc_ops': false },
  });
  assert(hiddenSubDoc.subcategories['office:doc_ops'] === false, 'office:doc_ops should be hidden');
  const restoredSubDoc = normalizeHubVisibilityDoc({
    ...hiddenSubDoc,
    subcategories: {},
  });
  assert(
    restoredSubDoc.subcategories['office:doc_ops'] === undefined,
    'empty subcategories map should mean visible (full replace)',
  );

  console.log('[test-hub-visibility] PASS');
  console.log(`  finance_visible=${financeVisible.length} baseline_hub=${baselineCount}`);
}

try {
  main();
} catch (error) {
  console.error('[test-hub-visibility] FAIL', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
