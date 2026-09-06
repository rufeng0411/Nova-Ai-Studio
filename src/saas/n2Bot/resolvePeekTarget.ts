// PD-SAAS-FORK: resolve HUD Peek target from utterance + ops cards. No glob.

import type { N2OpsFile, N2OpsItem } from "./n2BotTypes.js";

export type PeekResolveOk = {
  workerSessionId: string;
  path: string;
  kind: string;
};

export type PeekResolveAsk = {
  ask: string;
  fallback: PeekResolveOk;
};

export type PeekResolveResult = PeekResolveOk | PeekResolveAsk;

export type ResolvePeekTargetInput = {
  text: string;
  cards: N2OpsItem[];
  lastFocusCardId?: string;
  lastPeekPath?: string;
};

const TYPE_WORD: Array<{ re: RegExp; kinds: string[] }> = [
  { re: /pdf|提案/i, kinds: ["pdf"] },
  { re: /html|网页/i, kinds: ["html", "htm"] },
  { re: /markdown|md|提纲/i, kinds: ["md", "markdown"] },
  { re: /图|png|jpg|jpeg|webp/i, kinds: ["png", "jpg", "jpeg", "webp"] },
  { re: /word|docx|doc/i, kinds: ["docx", "doc"] },
  { re: /ppt|pptx|幻灯/i, kinds: ["pptx", "ppt"] },
];

function extOf(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
}

function fileKind(file: N2OpsFile): string {
  return (file.kind || extOf(file.path) || "file").toLowerCase();
}

function filesOf(card: N2OpsItem): N2OpsFile[] {
  return Array.isArray(card.files) ? card.files : [];
}

function scoreTitle(text: string, title: string): number {
  const t = text.toLowerCase();
  const n = title.toLowerCase();
  if (!n) return 0;
  if (t.includes(n)) return 8;
  const tokens = n.split(/[\s·_\-]+/).filter((x) => x.length >= 2);
  return tokens.reduce((acc, tok) => acc + (t.includes(tok) ? 3 : 0), 0);
}

function pickCard(input: ResolvePeekTargetInput): N2OpsItem | null {
  const { text, cards, lastFocusCardId } = input;
  if (!cards.length) return null;
  const scored = cards
    .map((card) => ({ card, score: scoreTitle(text, card.title) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 1) return scored[0].card;
  if (scored.length > 1 && scored[0].score > scored[1].score) return scored[0].card;

  if (lastFocusCardId) {
    const focused = cards.find((c) => c.workerSessionId === lastFocusCardId);
    if (focused) return focused;
  }

  const done = cards.filter((c) => c.status === "done");
  if (done.length === 1) return done[0];
  if (done.length > 1) {
    return done[0];
  }

  const live = cards.filter((c) => c.status === "run" || c.status === "done");
  if (live.length === 1) return live[0];
  return cards[0] ?? null;
}

function filterFilesByType(text: string, files: N2OpsFile[]): N2OpsFile[] {
  for (const rule of TYPE_WORD) {
    if (rule.re.test(text)) {
      const hit = files.filter((f) => rule.kinds.includes(fileKind(f)) || rule.re.test(f.label) || rule.re.test(f.path));
      if (hit.length) return hit;
    }
  }
  return files;
}

function pickByIndex(text: string, files: N2OpsFile[]): N2OpsFile | null {
  if (/最后|last/i.test(text)) return files[files.length - 1] ?? null;
  const ordinal = text.match(/(?:第\s*([一二三四五12345])|第\s*(\d+)|(\d+)\s*份|第二份|第一个|第二份)/);
  if (/第二份|第二个|2\s*份/.test(text)) return files[1] ?? files[0] ?? null;
  if (/第一份|第一个|1\s*份/.test(text)) return files[0] ?? null;
  if (ordinal) {
    const n = Number(ordinal[2] || ordinal[3] || "1");
    if (Number.isFinite(n) && n >= 1) return files[n - 1] ?? null;
  }
  return null;
}

function asOk(card: N2OpsItem, file: N2OpsFile): PeekResolveOk {
  return {
    workerSessionId: card.workerSessionId,
    path: file.path,
    kind: fileKind(file),
  };
}

export function resolvePeekTarget(input: ResolvePeekTargetInput): PeekResolveResult | null {
  const text = String(input.text ?? "").trim();
  const card = pickCard(input);
  if (!card) return null;
  const all = filesOf(card);
  if (!all.length) return null;

  const typed = filterFilesByType(text, all);
  const indexed = pickByIndex(text, typed);
  if (indexed) return asOk(card, indexed);

  if (typed.length === 1) return asOk(card, typed[0]);
  if (all.length === 1) return asOk(card, all[0]);

  const nameHit = typed.filter((f) => {
    const blob = `${f.label} ${f.path}`.toLowerCase();
    return /提案|报告|清单/.test(text) && /提案|报告|清单/.test(blob);
  });
  if (nameHit.length === 1) return asOk(card, nameHit[0]);

  const uniqueTitle = scoreTitle(text, card.title) > 0
    && input.cards.filter((c) => scoreTitle(text, c.title) > 0).length === 1;
  if (uniqueTitle && !/某一个|哪一份|哪一个/.test(text)) {
    return asOk(card, typed[0] ?? all[0]);
  }

  const fallbackFile = typed[0] ?? all[0];
  const titles = input.cards.map((c) => c.title).filter(Boolean);
  const ask = titles.length >= 2 && !input.lastFocusCardId && scoreTitle(text, card.title) === 0
    ? `${titles.slice(0, 2).join("还是")}？说一声`
    : typed.length > 1
      ? "提案点还是附录？"
      : `${titles[0] ?? "这一件"}还是另一件？说一声`;

  return {
    ask,
    fallback: asOk(card, fallbackFile),
  };
}

export function isPeekResolveAsk(value: PeekResolveResult | null): value is PeekResolveAsk {
  return Boolean(value && "ask" in value);
}
