#!/usr/bin/env node
/**
 * P1 MCP integration template smoke — docs + catalog slugs (no live MCP required).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function check(file, pattern, label) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (!pattern.test(text)) failures.push(label);
}

check('docs/media-mcp-integration-guide.md', /Firecrawl/i, 'firecrawl doc');
check('docs/media-mcp-integration-guide.md', /Postiz/i, 'postiz doc');
check('docs/media-mcp-integration-guide.md', /Figma/i, 'figma doc');
check('docs/media-capability-admin-guide.md', /Wonda/i, 'wonda admin doc');

const catalogPath = path.join(root, 'config/capabilities.catalog.json');
if (fs.existsSync(catalogPath)) {
  const catalog = fs.readFileSync(catalogPath, 'utf8');
  for (const slug of ['mcp-figma', 'create-wonda', 'mcp-cn-central-policy', 'comp-policy-search']) {
    if (!catalog.includes(`"slug": "${slug}"`)) failures.push(`catalog slug ${slug}`);
  }
}

check(
  'products/_example/config/mcp.json.example',
  /"cn-central-policy"/,
  'mcp.json.example cn-central-policy',
);
check(
  'docs/cn-compliance-mcp-setup.zh-CN.md',
  /后台.*MCP|平台设置/,
  'cn-compliance mcp setup doc',
);

if (failures.length > 0) {
  console.error('FAIL smoke:mcp-p1', failures.join(', '));
  process.exit(1);
}
console.log('smoke:mcp-p1 passed');
