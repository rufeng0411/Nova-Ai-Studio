/**
 * Lightweight GFM-ish markdown → HTML for /about PDF generation.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function parseTable(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length && isTableRow(lines[i])) {
    rows.push(
      lines[i]
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim()),
    );
    i += 1;
  }
  if (rows.length < 2) return null;
  const sep = rows[1].every((c) => /^:?-+:?$/.test(c));
  const head = rows[0];
  const body = sep ? rows.slice(2) : rows.slice(1);
  let html = '<table><thead><tr>';
  for (const cell of head) {
    html += `<th>${inlineFormat(cell)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of body) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td>${inlineFormat(cell)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return { html, next: i };
}

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let listType = null;

  const flushList = () => {
    if (listType) {
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flushList();
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    if (line.trim() === '---') {
      flushList();
      out.push('<hr class="section-rule" />');
      i += 1;
      continue;
    }

    if (isTableRow(line)) {
      flushList();
      const t = parseTable(lines, i);
      if (t) {
        out.push(t.html);
        i = t.next;
        continue;
      }
    }

    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      out.push(`<h${level}>${inlineFormat(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      flushList();
      out.push(`<blockquote>${inlineFormat(bq[1])}</blockquote>`);
      i += 1;
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (listType !== 'ul') {
        flushList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      i += 1;
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== 'ol') {
        flushList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${inlineFormat(ol[1])}</li>`);
      i += 1;
      continue;
    }

    if (line.trim() === '') {
      flushList();
      i += 1;
      continue;
    }

    flushList();
    out.push(`<p>${inlineFormat(line)}</p>`);
    i += 1;
  }

  flushList();
  if (inCode && codeBuf.length) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }

  return out.join('\n');
}
