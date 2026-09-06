// PD-SAAS-FORK: HTML FieldEditor patch engine — parse editable fields, apply text patches, NGRS JSON sync
import DOMPurify from 'dompurify';

export type HtmlFieldKind =
  | 'heading'
  | 'paragraph'
  | 'listItem'
  | 'tableCell'
  | 'ngrsTitle'
  | 'ngrsSubtitle'
  | 'ngrsBadge'
  | 'ngrsActionItem'
  | 'ngrsSection';

export type HtmlFieldDescriptor = {
  id: string;
  kind: HtmlFieldKind;
  selector: string;
  jsonPath?: string;
  label?: string;
};

export type HtmlFieldPatch = {
  id: string;
  text: string;
  html?: string;
};

const READONLY_SELECTOR =
  'script, style, canvas, svg, [data-nova-readonly], [data-ngrs-header-gauge], [data-ngrs-kpi-grid], [data-ngrs-chart-grid]';

const NGRS_FIELD_SPECS: Array<{
  attr: string;
  kind: HtmlFieldKind;
  jsonPath?: string;
  tag?: string;
}> = [
  { attr: 'data-ngrs-title', kind: 'ngrsTitle', jsonPath: 'title', tag: 'h1' },
  { attr: 'data-ngrs-subtitle', kind: 'ngrsSubtitle', jsonPath: 'subtitle', tag: 'p' },
  { attr: 'data-ngrs-badge', kind: 'ngrsBadge', jsonPath: 'reportType' },
  { attr: 'data-ngrs-action-list', kind: 'ngrsActionItem', jsonPath: 'actions' },
  { attr: 'data-ngrs-sections', kind: 'ngrsSection', jsonPath: 'sections' },
];

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export function extractScriptBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script[\s\S]*?<\/script>/gi;
  let match: RegExpExecArray | null = re.exec(html);
  while (match) {
    blocks.push(match[0]);
    match = re.exec(html);
  }
  return blocks;
}

export function scriptsChanged(before: string, after: string): boolean {
  const beforeScripts = extractScriptBlocks(before);
  const afterScripts = extractScriptBlocks(after);
  if (beforeScripts.length !== afterScripts.length) return true;
  for (let i = 0; i < beforeScripts.length; i += 1) {
    if (hashString(beforeScripts[i]) !== hashString(afterScripts[i])) return true;
  }
  return false;
}

function fieldIdFromElement(el: Element, index: number): string {
  const explicit = el.getAttribute('data-nova-field-id');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  return `${tag}-${index}`;
}

function parseReportDataJson(doc: Document): Record<string, unknown> | null {
  const el = doc.getElementById('report-data');
  if (!el?.textContent) return null;
  try {
    const parsed = JSON.parse(el.textContent) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function setJsonPath(root: Record<string, unknown>, jsonPath: string | undefined, text: string, kind: HtmlFieldKind): void {
  if (!jsonPath) return;
  if (jsonPath === 'actions' && kind === 'ngrsActionItem') {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    root.actions = lines;
    return;
  }
  root[jsonPath] = text;
}

export function parseEditableFields(html: string, profile: 'ngrs' | 'generic' | 'slide' = 'generic'): HtmlFieldDescriptor[] {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return collectEditableFields(doc, profile);
}

function collectEditableFields(doc: Document, profile: 'ngrs' | 'generic' | 'slide'): HtmlFieldDescriptor[] {
  const fields: HtmlFieldDescriptor[] = [];
  let counter = 0;

  if (profile === 'ngrs') {
    for (const spec of NGRS_FIELD_SPECS) {
      const nodes = doc.querySelectorAll(`[${spec.attr}]`);
      nodes.forEach((node) => {
        if (node.closest(READONLY_SELECTOR)) return;
        counter += 1;
        const id = fieldIdFromElement(node, counter);
        node.setAttribute('data-nova-field-id', id);
        fields.push({
          id,
          kind: spec.kind,
          selector: `[data-nova-field-id="${id}"]`,
          jsonPath: spec.jsonPath,
          label: spec.attr,
        });
        if (spec.kind === 'ngrsActionItem') {
          const items = node.querySelectorAll('li');
          items.forEach((li, liIndex) => {
            counter += 1;
            const liId = `${id}-li-${liIndex + 1}`;
            li.setAttribute('data-nova-field-id', liId);
            fields.push({
              id: liId,
              kind: 'listItem',
              selector: `[data-nova-field-id="${liId}"]`,
              jsonPath: 'actions',
              label: `action-${liIndex + 1}`,
            });
          });
        }
      });
    }
    const sectionHost = doc.querySelector('[data-ngrs-sections]');
    sectionHost?.querySelectorAll('section h2, section h3, section p').forEach((node) => {
      if (node.closest(READONLY_SELECTOR)) return;
      counter += 1;
      const id = fieldIdFromElement(node, counter);
      node.setAttribute('data-nova-field-id', id);
      const kind: HtmlFieldKind = node.tagName === 'P' ? 'paragraph' : 'heading';
      fields.push({ id, kind, selector: `[data-nova-field-id="${id}"]`, label: node.tagName.toLowerCase() });
    });
  }

  const genericSelectors: Array<{ selector: string; kind: HtmlFieldKind }> = [
    { selector: 'h1, h2, h3, h4, h5, h6', kind: 'heading' },
    { selector: 'p', kind: 'paragraph' },
    { selector: 'li', kind: 'listItem' },
    { selector: 'td, th', kind: 'tableCell' },
  ];

  for (const { selector, kind } of genericSelectors) {
    doc.querySelectorAll(selector).forEach((node) => {
      if (node.closest(READONLY_SELECTOR)) return;
      if (node.getAttribute('data-nova-field-id')) return;
      if (profile === 'ngrs' && node.closest('[data-ngrs-sections]') && kind !== 'tableCell') return;
      counter += 1;
      const id = fieldIdFromElement(node, counter);
      node.setAttribute('data-nova-field-id', id);
      fields.push({ id, kind, selector: `[data-nova-field-id="${id}"]`, label: kind });
    });
  }

  return fields;
}

export function prepareEditableHtml(html: string, profile: 'ngrs' | 'generic' | 'slide' = 'generic'): {
  html: string;
  fields: HtmlFieldDescriptor[];
} {
  if (typeof DOMParser === 'undefined') return { html, fields: [] };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fields = collectEditableFields(doc, profile);
  return { html: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`, fields };
}

export function getFieldText(html: string, field: HtmlFieldDescriptor): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector(field.selector);
  if (!el) return '';
  return stripTags(el.innerHTML);
}

export function applyPatches(
  html: string,
  patches: HtmlFieldPatch[],
  profile: 'ngrs' | 'generic' | 'slide' = 'generic',
): string {
  if (typeof DOMParser === 'undefined' || patches.length === 0) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fields = collectEditableFields(doc, profile);
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const reportData = profile === 'ngrs' ? parseReportDataJson(doc) : null;

  for (const patch of patches) {
    const field = fieldMap.get(patch.id);
    if (!field) continue;
    const el = doc.querySelector(field.selector);
    if (!el) continue;
    const nextHtml = patch.html ?? escapeHtml(patch.text).replace(/\n/g, '<br/>');
    el.innerHTML = nextHtml;
    if (reportData) {
      setJsonPath(reportData, field.jsonPath, patch.text, field.kind);
    }
  }

  if (reportData) {
    const dataEl = doc.getElementById('report-data');
    if (dataEl) {
      dataEl.textContent = JSON.stringify(reportData, null, 2);
    }
  }

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function inlineSiblingStyles(html: string, styleContents: string[]): string {
  if (styleContents.length === 0) return html;
  const block = styleContents.map((css) => `<style>${css}</style>`).join('\n');
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${block}\n</head>`);
  }
  return `${block}\n${html}`;
}

/** Root class for FieldEditor — sibling CSS `html`/`body` rules are scoped here. */
export const HTML_STUDIO_EDITOR_ROOT_CLASS = 'html-studio-doc-root';

/** Map document-level selectors onto the in-app editor root so theme backgrounds match iframe preview. */
export function scopeDocumentStylesForEditor(
  css: string,
  scope = `.${HTML_STUDIO_EDITOR_ROOT_CLASS}`,
): string {
  if (!css.trim()) return css;
  return css
    .replace(/:root\b/g, scope)
    .replace(/(^|[,{}\s])html(?=[\s,{.#[:>+~]|$)/g, `$1${scope}`)
    .replace(/(^|[,{}\s])body(?=[\s,{.#[:>+~]|$)/g, `$1${scope}`);
}

export function extractDocumentBodyShell(html: string): {
  innerHTML: string;
  className: string;
  style: string;
} {
  if (typeof DOMParser === 'undefined') {
    return { innerHTML: html, className: '', style: '' };
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach((node) => node.remove());
  const body = doc.body;
  return {
    innerHTML: body?.innerHTML ?? html,
    className: body?.getAttribute('class') ?? '',
    style: body?.getAttribute('style') ?? '',
  };
}

export function stripHtmlStudioEditorAttributes(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('[data-nova-field-id]').forEach((node) => {
    node.removeAttribute('data-nova-field-id');
  });
  doc.querySelectorAll('[contenteditable]').forEach((node) => {
    node.removeAttribute('contenteditable');
    node.classList.remove('nova-html-editable');
  });
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

const HTML_STUDIO_EDITOR_CHROME_CSS = `
  .nova-html-editable { cursor: text; outline: 1px dashed rgba(124,107,207,.22); outline-offset: 2px; }
  .nova-html-editable:hover { outline-color: rgba(124,107,207,.4); }
  .nova-html-editable:focus { outline: 2px solid rgba(124,107,207,.55); outline-offset: 2px; }
  [data-nova-readonly], canvas, svg { cursor: not-allowed !important; pointer-events: none !important; outline: none !important; }
  .${HTML_STUDIO_EDITOR_ROOT_CLASS} { min-height: 100%; box-sizing: border-box; }
`;

function applyEditableFieldAttributes(doc: Document): void {
  doc.querySelectorAll('[data-nova-field-id]').forEach((node) => {
    node.setAttribute('contenteditable', 'true');
    node.setAttribute('spellcheck', 'true');
    node.classList.add('nova-html-editable');
  });
}

/** Build Shadow DOM markup — scoped CSS + body shell; keeps keyboard focus in-editor. */
export function buildHtmlStudioEditorShadowHtml(annotatedHtml: string, documentCss: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(annotatedHtml, 'text/html');
  doc.querySelectorAll('script').forEach((node) => node.remove());
  applyEditableFieldAttributes(doc);
  const body = doc.body;
  const scopedCss = scopeDocumentStylesForEditor(documentCss);
  const rootClass = HTML_STUDIO_EDITOR_ROOT_CLASS;
  const cls = [rootClass, body?.getAttribute('class') ?? ''].filter(Boolean).join(' ');
  const styleAttr = body?.getAttribute('style') ?? '';
  const inner = DOMPurify.sanitize(body?.innerHTML ?? '', {
    ADD_ATTR: ['contenteditable', 'data-nova-field-id', 'class', 'style', 'spellcheck'],
  });
  const styleEsc = styleAttr.replace(/"/g, '&quot;');
  return `<style>${scopedCss}\n${HTML_STUDIO_EDITOR_CHROME_CSS}</style><div class="${cls}"${styleAttr ? ` style="${styleEsc}"` : ''}>${inner}</div>`;
}

/** Build isolated iframe srcdoc for FieldEditor — full document + scoped CSS + contenteditable fields. */
export function buildHtmlStudioEditorSrcdoc(annotatedHtml: string, scopedCss: string): string {
  if (typeof DOMParser === 'undefined') return annotatedHtml;
  const doc = new DOMParser().parseFromString(annotatedHtml, 'text/html');
  applyEditableFieldAttributes(doc);
  const style = doc.createElement('style');
  style.textContent = `${scopedCss}\n${HTML_STUDIO_EDITOR_CHROME_CSS}`;
  doc.head.appendChild(style);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

export const HTML_STUDIO_MAX_BYTES = 2 * 1024 * 1024;
