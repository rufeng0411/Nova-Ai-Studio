/**
 * PD-SAAS-FORK: convert static *.bento.html (no #bento-doc) into valid Bento shell + doc
 */
import { randomUUID } from 'node:crypto';

const BENTO_DOC_RE = /(<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>)([\s\S]*?)(<\/script>)/i;
const STATIC_SLIDE_OPEN_RE = /<(div|section)\s+class="slide[\s"]/gi;

export function hasBentoDocBlock(html) {
  return BENTO_DOC_RE.test(String(html ?? ''));
}

export function escapeBentoJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function spliceBentoDocIntoShell(shellHtml, doc, { preserveDocId = false } = {}) {
  const shell = String(shellHtml ?? '');
  const nextDoc = { ...doc };
  if (!preserveDocId || !nextDoc.docId) {
    nextDoc.docId = nextDoc.docId || randomUUID();
  }
  if (nextDoc.format !== 'bento/slides') {
    throw new Error('Document format must be "bento/slides"');
  }
  const match = BENTO_DOC_RE.exec(shell);
  if (!match) {
    throw new Error('Shell missing #bento-doc block');
  }
  const serialized = escapeBentoJson(nextDoc);
  return {
    html: shell.replace(BENTO_DOC_RE, `$1\n${serialized}\n$3`),
    doc: nextDoc,
  };
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSpeakerNotes(block) {
  const notes = block.match(/<div\s+class="notes"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  return notes ? stripTags(notes).slice(0, 480) : '';
}

function extractSlideBody(block) {
  const withoutNotes = block.replace(/<div\s+class="notes"[\s\S]*?<\/div>/gi, '');
  const bodyParts = [];
  for (const m of withoutNotes.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(m[1]);
    if (text) bodyParts.push(text);
  }
  for (const m of withoutNotes.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)) {
    const text = stripTags(m[1]);
    if (text) bodyParts.push(`• ${text}`);
  }
  for (const m of withoutNotes.matchAll(/<(?:li|span\s+class="toc-text")[^>]*>([\s\S]*?)<\/(?:li|span)>/gi)) {
    const text = stripTags(m[1]);
    if (text) bodyParts.push(`• ${text}`);
  }
  return bodyParts.join('\n').slice(0, 1200);
}

export function splitStaticSlides(html) {
  const source = String(html ?? '');
  const matches = [...source.matchAll(STATIC_SLIDE_OPEN_RE)];
  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    const openTag = block.match(/^<(div|section)\s+class="slide([^"]*)"/i);
    const classAttr = openTag?.[2] ?? '';
    const isCover = index === 0 || /\bcover\b/i.test(classAttr);
    const h1 = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const h2 = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
    const title = stripTags(h1 || h2 || `Slide ${index + 1}`);
    const body = extractSlideBody(block);
    const notes = extractSpeakerNotes(block);
    return { isCover, title, body, notes };
  });
}

function textElement(id, html, opts) {
  return {
    id,
    type: 'text',
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rotation: 0,
    opacity: 1,
    html: html.replace(/\n/g, '<br>'),
    fontSize: opts.fontSize,
    fontFamily: 'system-ui, "Noto Sans SC", sans-serif',
    fontWeight: opts.fontWeight ?? 700,
    color: opts.color,
    align: opts.align ?? 'left',
    valign: 'top',
    lineHeight: opts.lineHeight ?? 1.15,
  };
}

function shapeRect(id, fill, x, y, w, h) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x,
    y,
    w,
    h,
    fill,
    stroke: 'none',
    strokeWidth: 0,
    radius: 0,
    rotation: 0,
    opacity: 1,
  };
}

function buildNotes(slide) {
  const raw = slide.notes
    ? slide.notes.slice(0, 480)
    : (() => {
      const base = [slide.title, slide.body].filter(Boolean).join(' — ');
      return base.length >= 80
        ? base.slice(0, 480)
        : `${base}${base ? '。' : ''}本页由 Nova 从静态 HTML 自动修复为可编辑 Bento 演示稿，可在右栏继续改字、改色与版式。`;
    })();
  const padded = raw.length >= 20
    ? raw
    : `${raw}${raw ? '。' : ''}本页由 Nova 自动修复为可编辑 Bento 演示稿。`;
  return padded.slice(0, 480);
}

export function buildBentoDoc(slides, title) {
  const theme = {
    background: '#F8F6F0',
    color: '#1A1D23',
    accent: '#2E7D32',
    fontFamily: 'system-ui, "Noto Sans SC", sans-serif',
  };

  const bentoSlides = slides.map((slide, index) => {
    const id = `s-${index + 1}`;
    const bg = slide.isCover ? '#1A1D23' : theme.background;
    const headlineColor = slide.isCover ? '#F8F6F0' : theme.color;
    const elements = [
      shapeRect(`${id}-bg`, bg, 0, 0, 1280, 720),
    ];
    if (slide.isCover) {
      elements[0].fx = { ambient: 'kenburns', ken: { dir: 'drift', scale: 1.06, duration: 18 } };
    }
    elements.push(
      shapeRect(`${id}-bar`, slide.isCover ? '#44D62C' : theme.accent, 56, slide.isCover ? 520 : 140, 280, 10),
      textElement(slide.isCover || index === 1 ? 'headline' : `${id}-title`, slide.title, {
        x: 56,
        y: slide.isCover ? 220 : 56,
        w: 1168,
        h: slide.isCover ? 200 : 88,
        fontSize: slide.isCover ? 56 : 40,
        fontWeight: 900,
        color: headlineColor,
        lineHeight: 1.08,
      }),
    );
    if (slide.body) {
      elements.push(textElement(`${id}-body`, slide.body, {
        x: 56,
        y: slide.isCover ? 560 : 168,
        w: 1168,
        h: slide.isCover ? 120 : 520,
        fontSize: slide.isCover ? 22 : 18,
        fontWeight: 500,
        color: slide.isCover ? 'rgba(248,246,240,0.88)' : 'rgba(26,29,35,0.82)',
        lineHeight: 1.35,
      }));
    }
    return {
      id,
      background: bg,
      transition: index === 1 ? 'morph' : index === 0 ? 'none' : 'slide',
      notes: buildNotes(slide),
      elements,
    };
  });

  if (bentoSlides.length > 3) {
    const penultimate = bentoSlides[bentoSlides.length - 2];
    const closing = bentoSlides[bentoSlides.length - 1];
    penultimate.transition = 'morph';
    closing.transition = 'morph';
    for (const el of penultimate.elements) {
      if (el.type === 'text' && el.id?.endsWith('-title')) {
        el.id = 'closing-headline';
      }
    }
    for (const el of closing.elements) {
      if (el.type === 'text' && el.id?.endsWith('-title')) {
        el.id = 'closing-headline';
      }
    }
  }

  return {
    format: 'bento/slides',
    version: 1,
    title: title || slides[0]?.title || 'Repaired Bento Deck',
    meta: { repairedFrom: 'static-html', author: 'Nova Repair' },
    size: { width: 1280, height: 720 },
    theme,
    slides: bentoSlides,
  };
}

export function repairStaticHtmlToBento(html, shellHtml, options = {}) {
  const source = String(html ?? '');
  if (hasBentoDocBlock(source)) {
    return { alreadyValid: true, html: source, slideCount: 0, title: null };
  }

  const slides = splitStaticSlides(source);
  if (slides.length === 0) {
    throw new Error('No static slides found in input HTML.');
  }

  const title = options.title || slides[0]?.title || 'Repaired Deck';
  const doc = buildBentoDoc(slides, title);
  const { html: repairedHtml, doc: nextDoc } = spliceBentoDocIntoShell(shellHtml, doc, options);
  return {
    alreadyValid: false,
    html: repairedHtml,
    doc: nextDoc,
    slideCount: slides.length,
    title: nextDoc.title,
  };
}
