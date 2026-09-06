// PD-SAAS-FORK: docx-preview paginated adapter
import type { DocumentAdapter, PageDimensions } from '../types';

const DOCX_PAGE_PX: PageDimensions = { width: 794, height: 1123 };
const PAGE_OVERFLOW_TOLERANCE_PX = 32;
/** Word 默认页边距约 2.54 cm（1 英寸） */
const DEFAULT_PAGE_MARGINS_PX = {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
};

export type SectionPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type DocxVirtualPage = {
  pageWidth: number;
  pageHeight: number;
  root: HTMLElement;
};

function findDocxSections(host: HTMLElement): HTMLElement[] {
  const wrapper = host.querySelector('.docx-wrapper');
  if (wrapper) {
    const scoped = Array.from(wrapper.querySelectorAll(':scope > section'))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (scoped.length > 0) return scoped;
  }

  const directSections = Array.from(
    host.querySelectorAll('section.docx, .docx-wrapper > section'),
  ).filter((element): element is HTMLElement => element instanceof HTMLElement);
  if (directSections.length > 0) return directSections;

  return [];
}

export function parseCssLength(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?[\d.]+)\s*(px|pt|in|cm|mm)?$/i);
  if (!match) return fallback;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return fallback;
  const unit = (match[2] ?? 'px').toLowerCase();
  switch (unit) {
    case 'px':
      return amount;
    case 'pt':
      return amount * (96 / 72);
    case 'in':
      return amount * 96;
    case 'cm':
      return amount * (96 / 2.54);
    case 'mm':
      return amount * (96 / 25.4);
    default:
      return fallback;
  }
}

export function getSectionPageSize(section: HTMLElement): PageDimensions {
  const width = Math.max(
    parseCssLength(section.style.width, 0),
    section.offsetWidth,
    section.getBoundingClientRect().width,
    DOCX_PAGE_PX.width,
  );
  const height = Math.max(
    parseCssLength(section.style.minHeight, 0),
    parseCssLength(section.style.height, 0),
    DOCX_PAGE_PX.height,
  );
  return { width, height };
}

export function getSectionPadding(section: HTMLElement): SectionPadding {
  const padding = {
    top: parseCssLength(section.style.paddingTop, 0),
    right: parseCssLength(section.style.paddingRight, 0),
    bottom: parseCssLength(section.style.paddingBottom, 0),
    left: parseCssLength(section.style.paddingLeft, 0),
  };
  if (padding.top + padding.right + padding.bottom + padding.left < 8) {
    return { ...DEFAULT_PAGE_MARGINS_PX };
  }
  return padding;
}

function estimateBlockHeight(block: HTMLElement): number {
  const textLen = block.textContent?.length ?? 0;
  if (block.tagName === 'TABLE') return Math.max(120, Math.ceil(textLen / 4));
  return Math.max(22, Math.ceil(textLen / 90) * 22);
}

function measureBlockHeight(block: HTMLElement): number {
  return Math.max(
    block.offsetHeight,
    block.scrollHeight,
    block.getBoundingClientRect().height,
    estimateBlockHeight(block),
  );
}

function constrainHorizontalOverflow(root: HTMLElement): void {
  if (root.tagName === 'TABLE') {
    root.style.maxWidth = '100%';
    root.style.tableLayout = 'fixed';
    root.style.wordBreak = 'break-word';
  }
  root.querySelectorAll('table').forEach((table) => {
    if (table instanceof HTMLElement) {
      table.style.maxWidth = '100%';
      table.style.tableLayout = 'fixed';
      table.style.wordBreak = 'break-word';
    }
  });
  root.querySelectorAll('img').forEach((img) => {
    if (img instanceof HTMLElement) {
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    }
  });
}

function applyPageContainment(
  root: HTMLElement,
  pageSize: PageDimensions,
  padding: SectionPadding,
): void {
  root.style.width = `${pageSize.width}px`;
  root.style.height = `${pageSize.height}px`;
  root.style.minHeight = `${pageSize.height}px`;
  root.style.maxHeight = `${pageSize.height}px`;
  root.style.boxSizing = 'border-box';
  root.style.overflow = 'hidden';
  root.style.paddingTop = `${padding.top}px`;
  root.style.paddingRight = `${padding.right}px`;
  root.style.paddingBottom = `${padding.bottom}px`;
  root.style.paddingLeft = `${padding.left}px`;
}

function cloneHeaderFooter(section: HTMLElement, tag: 'header' | 'footer'): HTMLElement | null {
  const element = section.querySelector(tag);
  if (!(element instanceof HTMLElement)) return null;
  return element.cloneNode(true) as HTMLElement;
}

function buildArticleForPage(blocks: HTMLElement[]): HTMLElement {
  const article = document.createElement('article');
  article.style.marginBottom = 'auto';
  article.style.overflow = 'hidden';
  article.style.maxWidth = '100%';
  article.style.width = '100%';
  article.style.zIndex = '1';
  for (const block of blocks) {
    const clone = block.cloneNode(true) as HTMLElement;
    constrainHorizontalOverflow(clone);
    article.appendChild(clone);
  }
  return article;
}

function composePageSection(
  section: HTMLElement,
  blocks: HTMLElement[],
  pageSize: PageDimensions,
  padding: SectionPadding,
  options: { includeHeader: boolean; includeFooter: boolean },
): HTMLElement {
  const page = document.createElement('section');
  page.className = section.className;
  page.style.display = 'flex';
  page.style.flexFlow = 'column nowrap';
  page.style.position = 'relative';
  applyPageContainment(page, pageSize, padding);

  if (options.includeHeader) {
    const header = cloneHeaderFooter(section, 'header');
    if (header) page.appendChild(header);
  }
  page.appendChild(buildArticleForPage(blocks));
  if (options.includeFooter) {
    const footer = cloneHeaderFooter(section, 'footer');
    if (footer) page.appendChild(footer);
  }
  return page;
}

function splitOneSectionIntoPages(section: HTMLElement): DocxVirtualPage[] {
  const pageSize = getSectionPageSize(section);
  const padding = getSectionPadding(section);
  const contentAreaHeight = Math.max(pageSize.height - padding.top - padding.bottom, 240);
  const article = section.querySelector('article');

  if (!(article instanceof HTMLElement)) {
    const root = section.cloneNode(true) as HTMLElement;
    applyPageContainment(root, pageSize, padding);
    constrainHorizontalOverflow(root);
    return [{ pageWidth: pageSize.width, pageHeight: pageSize.height, root }];
  }

  const blocks = Array.from(article.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  if (blocks.length === 0) {
    const root = composePageSection(section, [], pageSize, padding, {
      includeHeader: true,
      includeFooter: true,
    });
    return [{ pageWidth: pageSize.width, pageHeight: pageSize.height, root }];
  }

  const blockHeights = blocks.map(measureBlockHeight);
  const totalHeight = blockHeights.reduce((sum, height) => sum + height, 0);
  if (totalHeight <= contentAreaHeight + PAGE_OVERFLOW_TOLERANCE_PX) {
    const root = composePageSection(section, blocks, pageSize, padding, {
      includeHeader: true,
      includeFooter: true,
    });
    return [{ pageWidth: pageSize.width, pageHeight: pageSize.height, root }];
  }

  const pageBlockGroups: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let currentHeight = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const blockHeight = blockHeights[index];

    if (blockHeight > contentAreaHeight) {
      if (current.length > 0) {
        pageBlockGroups.push(current);
        current = [];
        currentHeight = 0;
      }
      pageBlockGroups.push([block]);
      continue;
    }

    if (currentHeight + blockHeight > contentAreaHeight && current.length > 0) {
      pageBlockGroups.push(current);
      current = [block];
      currentHeight = blockHeight;
      continue;
    }

    current.push(block);
    currentHeight += blockHeight;
  }
  if (current.length > 0) pageBlockGroups.push(current);

  const groupCount = pageBlockGroups.length;
  return pageBlockGroups.map((group, groupIndex) => ({
    pageWidth: pageSize.width,
    pageHeight: pageSize.height,
    root: composePageSection(section, group, pageSize, padding, {
      includeHeader: groupIndex === 0,
      includeFooter: groupIndex === groupCount - 1,
    }),
  }));
}

/** docx-preview 仅识别显式分页符 — 按块 + 页边距切虚拟页。 */
export function splitDocxSectionsIntoPages(sections: HTMLElement[]): DocxVirtualPage[] {
  return sections.flatMap((section) => splitOneSectionIntoPages(section));
}

function buildScaledPageFrame(page: DocxVirtualPage, scale: number): HTMLDivElement {
  const safeScale = Math.max(scale, 0.05);
  const { pageWidth, pageHeight, root } = page;
  const displayWidth = Math.max(Math.round(pageWidth * safeScale), 1);
  const displayHeight = Math.max(Math.round(pageHeight * safeScale), 1);

  const centerWrap = document.createElement('div');
  centerWrap.className = 'flex max-h-full max-w-full items-center justify-center';
  centerWrap.style.width = '100%';
  centerWrap.style.height = '100%';

  const pageFrame = document.createElement('div');
  pageFrame.className = 'shrink-0 bg-white shadow-sm';
  pageFrame.style.width = `${displayWidth}px`;
  pageFrame.style.height = `${displayHeight}px`;
  pageFrame.style.maxWidth = '100%';
  pageFrame.style.maxHeight = '100%';

  const scaleSlot = document.createElement('div');
  scaleSlot.style.width = `${displayWidth}px`;
  scaleSlot.style.height = `${displayHeight}px`;
  scaleSlot.style.position = 'relative';
  scaleSlot.style.overflow = 'hidden';
  scaleSlot.style.margin = '0 auto';

  const pageShell = document.createElement('div');
  pageShell.className = 'docx-page-shell';
  pageShell.style.width = `${pageWidth}px`;
  pageShell.style.height = `${pageHeight}px`;
  pageShell.style.overflow = 'hidden';
  pageShell.style.transform = `scale(${safeScale})`;
  pageShell.style.transformOrigin = 'top left';
  pageShell.style.position = 'absolute';
  pageShell.style.left = '0';
  pageShell.style.top = '0';

  pageShell.appendChild(root.cloneNode(true));
  scaleSlot.appendChild(pageShell);
  pageFrame.appendChild(scaleSlot);
  centerWrap.appendChild(pageFrame);
  return centerWrap;
}

export class DocxDocumentAdapter implements DocumentAdapter {
  private pages: DocxVirtualPage[] = [];

  private host: HTMLDivElement | null = null;

  get pageCount(): number {
    return Math.max(this.pages.length, 1);
  }

  getPageDimensions(pageIndex = 0): PageDimensions {
    const page = this.pages[pageIndex];
    if (!page) return DOCX_PAGE_PX;
    return { width: page.pageWidth, height: page.pageHeight };
  }

  async load(buffer: ArrayBuffer): Promise<void> {
    const { renderAsync } = await import('docx-preview');
    this.host = document.createElement('div');
    this.host.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(this.host);
    await renderAsync(new Uint8Array(buffer), this.host, undefined, {
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreLastRenderedPageBreak: false,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: true,
      className: 'docx',
    });

    let sections = findDocxSections(this.host);
    if (sections.length === 0 && this.host.innerHTML.trim()) {
      const fallback = document.createElement('section');
      fallback.className = 'docx';
      fallback.style.width = `${DOCX_PAGE_PX.width}px`;
      fallback.style.minHeight = `${DOCX_PAGE_PX.height}px`;
      fallback.innerHTML = this.host.querySelector('.docx-wrapper')?.innerHTML ?? this.host.innerHTML;
      sections = [fallback];
    }

    this.pages = splitDocxSectionsIntoPages(sections);
    if (this.pages.length === 0) {
      const empty = document.createElement('section');
      empty.className = 'docx';
      empty.style.width = `${DOCX_PAGE_PX.width}px`;
      empty.style.minHeight = `${DOCX_PAGE_PX.height}px`;
      this.pages = splitDocxSectionsIntoPages([empty]);
    }
  }

  async renderPage(pageIndex: number, container: HTMLElement, scale: number): Promise<void> {
    const page = this.pages[pageIndex];
    if (!page) {
      container.replaceChildren();
      return;
    }
    container.replaceChildren(buildScaledPageFrame(page, scale));
  }

  destroy(): void {
    this.host?.remove();
    this.host = null;
    this.pages = [];
  }
}
