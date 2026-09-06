import { describe, expect, it } from 'vitest';
import {
  applyPatches,
  buildHtmlStudioEditorShadowHtml,
  buildHtmlStudioEditorSrcdoc,
  parseEditableFields,
  scopeDocumentStylesForEditor,
  scriptsChanged,
} from './htmlPatchEngine';
import { resolveHtmlEditAdapter } from './htmlStudioSupport';
import type { ArtifactContract } from './artifactContract';

describe('htmlPatchEngine', () => {
  it('parses generic headings and paragraphs', () => {
    const html = '<html><body><h1>Title</h1><p>Body</p></body></html>';
    const fields = parseEditableFields(html, 'generic');
    expect(fields.length).toBeGreaterThanOrEqual(2);
    const patched = applyPatches(html, [{ id: fields[0].id, text: 'New Title' }], 'generic');
    expect(patched).toContain('New Title');
  });

  it('syncs NGRS title to report-data JSON', () => {
    const html = `<!DOCTYPE html><html><body>
      <h1 data-ngrs-title>Old</h1>
      <script id="report-data" type="application/json">{"title":"Old","subtitle":""}</script>
    </body></html>`;
    const fields = parseEditableFields(html, 'ngrs');
    const titleField = fields.find((field) => field.kind === 'ngrsTitle');
    expect(titleField).toBeTruthy();
    const patched = applyPatches(html, [{ id: titleField!.id, text: 'New GEO Title' }], 'ngrs');
    expect(patched).toContain('New GEO Title');
    expect(patched).toContain('"title": "New GEO Title"');
  });

  it('syncs NGRS action list items to report-data JSON', () => {
    const html = `<!DOCTYPE html><html><body>
      <ul data-ngrs-action-list><li>Action A</li><li>Action B</li></ul>
      <script id="report-data" type="application/json">{"actions":["Action A","Action B"]}</script>
    </body></html>`;
    const fields = parseEditableFields(html, 'ngrs');
    const actionField = fields.find((field) => field.id.endsWith('-li-1'));
    expect(actionField).toBeTruthy();
    const patched = applyPatches(
      html,
      [{ id: actionField!.id, text: 'Updated action' }],
      'ngrs',
    );
    expect(patched).toContain('Updated action');
    expect(patched).toContain('"Updated action"');
  });

  it('detects script changes', () => {
    const before = '<script>console.log(1)</script>';
    const after = '<script>console.log(2)</script>';
    expect(scriptsChanged(before, after)).toBe(true);
  });

  it('scopes body background rules onto editor root', () => {
    const css = 'body { background: #F0F1F4; color: #1A1F26; }';
    const scoped = scopeDocumentStylesForEditor(css);
    expect(scoped).toContain('.html-studio-doc-root { background: #F0F1F4');
    expect(scoped).not.toMatch(/\bbody\s*\{/);
  });

  it('scopes :root variables onto editor root', () => {
    const css = ':root { --ngrs-bg: #F0F1F4; }';
    const scoped = scopeDocumentStylesForEditor(css);
    expect(scoped).toContain('.html-studio-doc-root { --ngrs-bg: #F0F1F4');
    expect(scoped).not.toContain(':root');
  });

  it('builds editor srcdoc with contenteditable fields', () => {
    const html = '<html><body><h1 data-nova-field-id="f1">Title</h1></body></html>';
    const srcdoc = buildHtmlStudioEditorSrcdoc(html, 'body { margin: 0; }');
    expect(srcdoc).toContain('contenteditable="true"');
    expect(srcdoc).toContain('nova-html-editable');
    expect(srcdoc).toContain('body { margin: 0; }');
  });

  it('builds shadow editor markup with scoped root', () => {
    const html = '<html><body class="report"><h1 data-nova-field-id="f1">Title</h1></body></html>';
    const markup = buildHtmlStudioEditorShadowHtml(html, 'body { background: #fff; }');
    expect(markup).toContain('contenteditable="true"');
    expect(markup).toContain('html-studio-doc-root');
    expect(markup).toContain('.html-studio-doc-root { background: #fff; }');
    expect(markup).not.toMatch(/\bbody\s*\{/);
  });
});

describe('resolveHtmlEditAdapter', () => {
  const baseContract = {
    pages: [],
    carrierScope: 'report_html',
  } as unknown as ArtifactContract;

  it('returns htmlStudio for artifacts report html', () => {
    expect(
      resolveHtmlEditAdapter(
        baseContract,
        'report.html',
        'artifacts/geo/report.html',
      ),
    ).toBe('htmlStudio');
  });

  it('returns none for slides with manifest pages', () => {
    const contract = {
      ...baseContract,
      carrierScope: 'slide_deck_png',
      pages: [{ pageId: '1', index: 0, points: [], status: 'completed' }],
    } as unknown as ArtifactContract;
    expect(
      resolveHtmlEditAdapter(
        contract,
        'slide-01.png',
        'artifacts/slides-deck/slide-01.png',
      ),
    ).toBe('none');
  });
});
