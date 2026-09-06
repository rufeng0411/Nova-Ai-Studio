// PD-SAAS-FORK: greeting snapshot + first-open flag. First paint never awaits ops.

import { authenticatedFetch } from '../../utils/api';

const OPENED_KEY = 'n2-bot:has-opened';
const SNAP_KEY = 'n2-bot:ops-snapshot';
const SNAP_TTL_MS = 15 * 60 * 1000;

const memoryAudio = new Map<string, string>();
let playing: HTMLAudioElement | null = null;

export type N2GreetingSnapshot = {
  running: number;
  waiting: number;
  at: number;
};

export function hasOpenedN2BotBefore(): boolean {
  try {
    return localStorage.getItem(OPENED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markN2BotOpened(): void {
  try {
    localStorage.setItem(OPENED_KEY, '1');
  } catch {
    // ignore
  }
}

export function readN2GreetingSnapshot(): N2GreetingSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as N2GreetingSnapshot;
    if (!parsed || Date.now() - parsed.at > SNAP_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeN2GreetingSnapshot(running: number, waiting: number): void {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify({ running, waiting, at: Date.now() }));
  } catch {
    // ignore
  }
}

export function speakBrowserFemale(text: string): void {
  try {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = /[A-Za-z]/.test(text) ? 'en-US' : 'zh-CN';
    utter.rate = 1.05;
    const voices = speechSynthesis.getVoices();
    const female = voices.find((v) => /female|女|Tingting|Xiaoxiao|Google US English/i.test(`${v.name} ${v.lang}`))
      || voices.find((v) => v.lang.toLowerCase().startsWith(utter.lang.slice(0, 2)));
    if (female) utter.voice = female;
    speechSynthesis.speak(utter);
  } catch {
    // ignore
  }
}

export function stopNovaVoice(): void {
  try {
    speechSynthesis.cancel();
  } catch {
    // ignore
  }
  try {
    playing?.pause();
    playing = null;
  } catch {
    // ignore
  }
}

export function playNovaVoice(text: string): void {
  const cached = memoryAudio.get(text);
  if (cached) {
    try {
      speechSynthesis.cancel();
      playing?.pause();
      const audio = new Audio(cached);
      playing = audio;
      void audio.play();
      return;
    } catch {
      // fall through to browser voice
    }
  }
  speakBrowserFemale(text);
}

export async function prefetchNovaVoice(text: string): Promise<void> {
  if (!text || memoryAudio.has(text)) return;
  try {
    const res = await authenticatedFetch('/api/saas/n2-bot/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('audio')) return;
    const blob = await res.blob();
    if (blob.size < 32) return;
    memoryAudio.set(text, URL.createObjectURL(blob));
  } catch {
    // no Key / network — browser voice already playing
  }
}
