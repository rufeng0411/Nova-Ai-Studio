// PD-SAAS-FORK: N2 Bot β HUD — chat first, then dispatch workers. Shared by popout / overlay / mobile.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authenticatedFetch } from '../../utils/api';
import {
  getRuntimeFeatureFlags,
  isN2BotHudEnabled,
  subscribeRuntimeFeatureFlags,
} from '../../shared/runtimeFeatureFlags';
import { registerN2BotOverlayCapabilityCapture } from '../../shared/capabilityTryBridge';
import { CAPABILITY_PROMPT_EVENT } from '../../shared/capabilityPromptInjection';
import {
  setSessionSidebarCompleted,
  setSessionSidebarLocked,
  isSessionSidebarCompleted,
  isSessionSidebarLocked,
} from '../../lib/sessionSidebarState';
import { routeN2Utterance, needsFileBeforeDelegate, shouldDispatchWorker } from '../../../../src/saas/n2Bot/routeN2Utterance';
import { resolvePeekTarget, isPeekResolveAsk } from '../../../../src/saas/n2Bot/resolvePeekTarget';
import { resolveSessionVoiceAction } from '../../../../src/saas/n2Bot/sessionVoiceActions';
import type { N2ChatMessage, N2ElicitCard, N2OpsItem } from '../../../../src/saas/n2Bot/n2BotTypes';
import { n2Copy } from './n2BotCopy';
import N2OpsRail from './N2OpsRail';
import N2BotThread from './N2BotThread';
import {
  hasOpenedN2BotBefore,
  markN2BotOpened,
  playNovaVoice,
  prefetchNovaVoice,
  readN2GreetingSnapshot,
  stopNovaVoice,
  writeN2GreetingSnapshot,
} from './n2BotGreetingCache';
import { greetingForOpen } from '../../../../src/saas/n2Bot/novaPersona';
import N2BotPeek from './N2BotPeek';
import './n2BotHud.css';

const TemplatesHubPanel = lazy(() => import('../../components/templates-hub/TemplatesHubPanel'));

type OrbState = 'idle' | 'listen' | 'think' | 'talk' | 'ask' | 'ok' | 'need' | 'sleep';

function api(path: string, init?: RequestInit) {
  return authenticatedFetch(`/api/saas/n2-bot${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

export default function N2BotHudPage(props: { overlay?: boolean; onClose?: () => void }) {
  const { i18n } = useTranslation();
  const copy = useMemo(() => n2Copy(i18n.language), [i18n.language]);
  const openedBefore = hasOpenedN2BotBefore();
  const snapshot = readN2GreetingSnapshot();
  const [enabled, setEnabled] = useState(() => isN2BotHudEnabled());
  const [messages, setMessages] = useState<N2ChatMessage[]>(() => [{
    id: 'n2b-greet',
    role: 'nova',
    text: greetingForOpen({
      hasOpenedBefore: openedBefore,
      snapshot,
      locale: copy.locale,
    }),
  }]);
  const [orb, setOrb] = useState<OrbState>('idle');
  const [input, setInput] = useState('');
  const [cards, setCards] = useState<N2OpsItem[]>([]);
  const [elicit, setElicit] = useState<N2ElicitCard | null>(null);
  const [focusId, setFocusId] = useState<string | undefined>();
  const [peek, setPeek] = useState<{ path: string; kind: string; page: number; files?: N2OpsItem['files'] } | null>(null);
  const [live, setLive] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  const [opsDegraded, setOpsDegraded] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [allowedSend, setAllowedSend] = useState(false);
  const pendingDelete = useRef<{ sessionIds: string[]; confirmToken: string } | null>(null);
  const inFlightOps = useRef(false);
  const n2SessionId = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const liveRef = useRef(false);
  const msgSeq = useRef(0);
  const messagesRef = useRef<N2ChatMessage[]>([]);
  const handleRef = useRef<(
    raw: string,
    extra?: { capability?: { slug?: string }; optionId?: string; from?: 'text' | 'voice' },
  ) => Promise<void>>(async () => undefined);

  useEffect(() => {
    const sync = () => setEnabled(isN2BotHudEnabled());
    sync();
    return subscribeRuntimeFeatureFlags(sync);
  }, []);

  useEffect(() => {
    document.title = 'N2 Bot β';
    markN2BotOpened();
    void api('/session', { method: 'POST', body: '{}' });
  }, []);

  const stopLive = useCallback(() => {
    liveRef.current = false;
    setLive(false);
    setOrb((prev) => (prev === 'listen' ? 'idle' : prev));
    try {
      recognitionRef.current?.stop();
    } catch {
      // typing still works
    }
    recognitionRef.current = null;
  }, []);

  const speak = useCallback((text: string) => {
    const id = `n2b-n-${++msgSeq.current}`;
    setMessages((prev) => [...prev, { id, role: 'nova', text }]);
    if (!liveRef.current && !speaker) return;
    playNovaVoice(text);
    void prefetchNovaVoice(text);
  }, [speaker]);

  const refreshOps = useCallback(async () => {
    if (inFlightOps.current) return;
    if (document.visibilityState === 'hidden') return;
    inFlightOps.current = true;
    try {
      const res = await api('/ops');
      if (res.status === 401) {
        setAuthLost(true);
        return;
      }
      if (!res.ok) {
        setOpsDegraded(true);
        return;
      }
      const data = await res.json() as { items?: N2OpsItem[]; stewardSessionId?: string; n2SessionId?: string };
      n2SessionId.current = data.n2SessionId ?? data.stewardSessionId ?? null;
      setOpsDegraded(false);
      const items = data.items ?? [];
      setCards(items);
      writeN2GreetingSnapshot(
        items.filter((i) => i.status === 'run').length,
        items.filter((i) => i.status === 'need').length,
      );
    } finally {
      inFlightOps.current = false;
    }
  }, []);

  useEffect(() => {
    void refreshOps();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshOps();
    }, 2500);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshOps();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshOps]);

  useEffect(() => {
    const capture = (prompt: string, capability?: { slug?: string; displayName?: string }) => {
      void handleRef.current(prompt, { capability });
      return true;
    };
    registerN2BotOverlayCapabilityCapture(capture);
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; capability?: { slug?: string; displayName?: string } }>).detail;
      const prompt = String(detail?.prompt || '').trim();
      if (!prompt) return;
      void handleRef.current(prompt, { capability: detail?.capability });
    };
    window.addEventListener(CAPABILITY_PROMPT_EVENT, onPrompt);
    return () => {
      registerN2BotOverlayCapabilityCapture(null);
      window.removeEventListener(CAPABILITY_PROMPT_EVENT, onPrompt);
    };
  }, []);

  const ownedIds = cards.map((c) => c.workerSessionId);
  messagesRef.current = messages;

  const handleUtterance = async (
    raw: string,
    extra?: { capability?: { slug?: string }; optionId?: string; from?: 'text' | 'voice' },
  ) => {
    const text = raw.trim();
    if (!text) return;
    if (extra?.from !== 'voice') stopLive();
    setInput('');
    const userId = `n2b-u-${++msgSeq.current}`;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'user' && last.text === text) return prev;
      return [
        ...prev,
        {
          id: userId,
          role: 'user',
          text,
          via: extra?.from === 'voice' ? 'voice' : 'text',
        },
      ];
    });
    const route = routeN2Utterance({
      text,
      pendingElicit: elicit ? { optionIds: elicit.options.map((o) => o.id) } : undefined,
      lastFocusCardId: focusId,
      hasAttachments: attachments.length > 0,
    });

    if (route.kind === 'wake' || route.kind === 'thanks' || route.kind === 'identity') {
      setOrb('talk');
      speak(route.kind === 'identity' ? copy.identity : route.kind === 'thanks' ? copy.thanks : copy.wake);
      setOrb('idle');
      return;
    }
    if (route.kind === 'chat' && route.tier === 'T2') {
      const timer = window.setTimeout(() => setOrb('think'), 400);
      try {
        const res = await api('/chat', {
          method: 'POST',
          body: JSON.stringify({
            text,
            locale: copy.locale,
            history: [
              ...messagesRef.current.map((msg) => ({
                role: msg.role === 'nova' ? 'assistant' : 'user',
                text: msg.text,
              })),
              { role: 'user', text },
            ],
          }),
        });
        const data = await res.json() as { text?: string };
        speak(data.text || copy.stillHere);
      } catch {
        speak(copy.stillHere);
      } finally {
        window.clearTimeout(timer);
        setOrb('idle');
      }
      return;
    }
    if (route.kind === 'progress' || route.kind === 'status') {
      const running = cards.filter((c) => c.status === 'run').length;
      const waiting = cards.filter((c) => c.status === 'need').length;
      speak(running || waiting
        ? greetingForOpen({ hasOpenedBefore: true, snapshot: { running, waiting }, locale: copy.locale })
        : copy.idle);
      return;
    }
    if (route.kind === 'stopall') {
      await api('/control', { method: 'POST', body: JSON.stringify({ action: 'stopall' }) });
      speak(copy.stopAll);
      void refreshOps();
      return;
    }
    if (route.kind === 'pause' && focusId) {
      await api('/control', { method: 'POST', body: JSON.stringify({ action: 'pause', sessionId: focusId }) });
      speak(copy.pause);
      void refreshOps();
      return;
    }
    if (route.kind === 'resume' && focusId) {
      await api('/control', { method: 'POST', body: JSON.stringify({ action: 'resume', sessionId: focusId }) });
      speak(copy.resume);
      void refreshOps();
      return;
    }
    if (route.kind === 'peek_close') {
      setPeek(null);
      return;
    }
    if (route.kind === 'peek_next' && peek) {
      setPeek({ ...peek, page: peek.page + 1 });
      return;
    }
    if (route.kind === 'peek_prev' && peek) {
      setPeek({ ...peek, page: Math.max(1, peek.page - 1) });
      return;
    }
    if (route.kind === 'open' || route.kind === 'peek_switch') {
      const hit = resolvePeekTarget({
        text,
        cards,
        lastFocusCardId: focusId,
        lastPeekPath: peek?.path,
      });
      if (!hit) {
        speak(copy.stillHere);
        return;
      }
      if (isPeekResolveAsk(hit)) {
        setElicit({
          id: 'choose-file',
          kind: 'choose',
          title: hit.ask,
          body: '',
          options: [
            { id: 'fallback', label: hit.fallback.path.split('/').pop() || '打开', recommended: true },
          ],
        });
        setPeek({ path: hit.fallback.path, kind: hit.fallback.kind, page: 1, files: cards.find((c) => c.workerSessionId === hit.fallback.workerSessionId)?.files });
        setFocusId(hit.fallback.workerSessionId);
        return;
      }
      const card = cards.find((c) => c.workerSessionId === hit.workerSessionId);
      setFocusId(hit.workerSessionId);
      setPeek({ path: hit.path, kind: hit.kind, page: 1, files: card?.files });
      return;
    }
    if (route.kind === 'save') {
      if (peek?.path) {
        const a = document.createElement('a');
        a.href = `/api/file/content?path=${encodeURIComponent(peek.path)}`;
        a.download = peek.path.split(/[/\\]/).pop() || 'download';
        a.click();
        speak(copy.save);
      }
      return;
    }
    if (route.kind === 'continue_blocked' || route.kind === 'retry') {
      if (focusId) {
        await api('/control', { method: 'POST', body: JSON.stringify({ action: 'resume', sessionId: focusId }) });
        await api('/delegate', {
          method: 'POST',
          body: JSON.stringify({ command: text, followUpWorkerSessionId: focusId }),
        });
      }
      speak(copy.received);
      void refreshOps();
      return;
    }
    if (route.kind === 'share') {
      const sharePath = peek?.path;
      if (sharePath) {
        const url = `${window.location.origin}/s/${encodeURIComponent(sharePath)}`;
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        speak(copy.shareReady);
      }
      return;
    }
    if (route.kind === 'send') {
      setElicit({
        id: 'allow-send',
        kind: 'allow_send',
        title: copy.sendNeedAllow,
        body: '',
        options: [
          { id: 'allow', label: copy.allowSend, recommended: true },
          { id: 'cancel', label: copy.close },
        ],
      });
      setOrb('ask');
      return;
    }
    if (route.kind === 'allow') {
      const sharePath = peek?.path;
      if (sharePath) {
        const url = `${window.location.origin}/s/${encodeURIComponent(sharePath)}`;
        await navigator.clipboard?.writeText(url).catch(() => undefined);
      }
      setElicit(null);
      speak(copy.sendAllowed);
      return;
    }
    if (route.kind === 'schedule') {
      await api('/schedule', {
        method: 'POST',
        body: JSON.stringify({ text, workerSessionId: focusId }),
      });
      speak(copy.locale === 'en' ? 'Scheduled. I will call you.' : '记下了。到点我叫你。');
      void refreshOps();
      return;
    }
    if (
      route.kind === 'lock'
      || route.kind === 'unlock'
      || route.kind === 'complete_task'
      || route.kind === 'uncomplete_task'
      || route.kind === 'delete_record'
      || route.kind === 'confirm_delete'
      || route.kind === 'close'
    ) {
      const action = resolveSessionVoiceAction({
        kind: route.kind,
        text,
        cards,
        lastFocusCardId: focusId,
        viewerOwnedIds: ownedIds,
        stewardSessionId: n2SessionId.current,
        pendingDelete: pendingDelete.current ?? undefined,
        locale: copy.locale,
        flagsBySessionId: Object.fromEntries(cards.map((c) => [
          c.workerSessionId,
          {
            locked: isSessionSidebarLocked(c.workerSessionId),
            completed: isSessionSidebarCompleted(c.workerSessionId),
          },
        ])),
      });
      if (action.type === 'lock') {
        action.sessionIds.forEach((id) => setSessionSidebarLocked(id, true));
        speak(copy.locale === 'en' ? 'Locked.' : '锁上了。');
        return;
      }
      if (action.type === 'unlock') {
        action.sessionIds.forEach((id) => setSessionSidebarLocked(id, false));
        speak(copy.locale === 'en' ? 'Unlocked.' : '解锁了。');
        return;
      }
      if (action.type === 'complete') {
        action.sessionIds.forEach((id) => setSessionSidebarCompleted(id, true));
        speak(copy.locale === 'en' ? 'Marked complete.' : '这件算任务完成了。');
        return;
      }
      if (action.type === 'uncomplete') {
        action.sessionIds.forEach((id) => setSessionSidebarCompleted(id, false));
        speak(copy.locale === 'en' ? 'Unmarked. What next?' : '取消完成了。还想做什么？');
        return;
      }
      if (action.type === 'delete_card') {
        setElicit(action.card);
        if (action.card.sessionIds?.length && action.card.confirmToken) {
          pendingDelete.current = {
            sessionIds: action.card.sessionIds,
            confirmToken: action.card.confirmToken,
          };
          void api('/session-actions', {
            method: 'POST',
            body: JSON.stringify({
              action: 'delete',
              sessionIds: action.card.sessionIds,
            }),
          });
        }
        speak(copy.deleteAsk);
        setOrb('ask');
        return;
      }
      if (action.type === 'delete_blocked_locked') {
        setElicit(action.card);
        speak(copy.deleteAsk);
        setOrb('ask');
        return;
      }
      if (action.type === 'delete_execute') {
        await api('/session-actions', {
          method: 'POST',
          body: JSON.stringify({
            action: 'delete',
            sessionIds: action.sessionIds,
            confirmToken: action.confirmToken,
          }),
        });
        pendingDelete.current = null;
        setElicit(null);
        speak(copy.locale === 'en' ? 'Deleted.' : '删掉了。');
        void refreshOps();
        return;
      }
      if (action.type === 'cancel') {
        pendingDelete.current = null;
        setElicit(null);
        speak(copy.idle);
        return;
      }
    }
    if (route.kind === 'quality_feedback' && focusId) {
      speak(copy.received);
      await api('/delegate', {
        method: 'POST',
        body: JSON.stringify({
          command: text,
          followUpWorkerSessionId: focusId,
          capabilityContext: extra?.capability,
        }),
      });
      return;
    }
    if (needsFileBeforeDelegate(text, attachments.length > 0)) {
      speak(copy.needFile);
      setElicit({
        id: 'need-file',
        kind: 'need_file',
        title: copy.needFile,
        body: '',
        options: [{ id: 'cancel', label: copy.close }],
      });
      return;
    }
    if (shouldDispatchWorker(route, text, attachments.length > 0) || extra?.capability) {
      speak(copy.received);
      await api('/delegate', {
        method: 'POST',
        body: JSON.stringify({
          command: text,
          followUpWorkerSessionId: focusId,
          capabilityContext: extra?.capability,
          attachmentNames: attachments.map((f) => f.name),
        }),
      });
      setAttachments([]);
      void refreshOps();
      return;
    }
    speak(copy.stillHere);
  };

  handleRef.current = handleUtterance;

  const onPickOption = (id: string) => {
    if (id === 'cancel') {
      pendingDelete.current = null;
      setElicit(null);
      speak(copy.idle);
      return;
    }
    if (id === 'allow') {
      setAllowedSend(true);
      void handleUtterance('允许', { optionId: id });
      return;
    }
    if (id === 'unlock_delete' && elicit?.sessionIds?.length) {
      const ids = elicit.sessionIds;
      ids.forEach((sid) => setSessionSidebarLocked(sid, false));
      setFocusId(ids[0]);
      setElicit(null);
      void handleUtterance('删掉');
      return;
    }
    if (id === 'unlock_only' && elicit?.sessionIds?.length) {
      elicit.sessionIds.forEach((sid) => setSessionSidebarLocked(sid, false));
      setElicit(null);
      speak(copy.locale === 'en' ? 'Unlocked.' : '解锁了。');
      return;
    }
    if (id === 'fallback') {
      setElicit(null);
      return;
    }
    void handleUtterance(id === 'confirm' ? '确定' : id, { optionId: id });
  };

  const startLive = (forceOn?: boolean) => {
    const next = forceOn ? true : !liveRef.current;
    if (!next) {
      stopLive();
      return;
    }
    liveRef.current = true;
    setLive(true);
    setOrb('listen');
    try {
      const SR = (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
        || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
      if (!SR) return;
      if (recognitionRef.current) return;
      const rec = new SR();
      rec.lang = copy.locale === 'en' ? 'en-US' : 'zh-CN';
      rec.continuous = true;
      rec.onresult = (event: SpeechRecognitionEvent) => {
        const last = event.results[event.results.length - 1];
        const said = last?.[0]?.transcript?.trim();
        if (said) {
          void handleRef.current(said, { from: 'voice' });
        }
      };
      rec.start();
      recognitionRef.current = rec;
    } catch {
      // typing still works
    }
  };

  if (!enabled && !getRuntimeFeatureFlags()) {
    // flags still loading: keep HUD for popout routes when env injected later
  }

  return (
    <div
      className={`n2b-root ${props.overlay ? 'is-overlay' : ''}`}
      data-n2-bot="1"
      data-testid="n2-bot-hud"
    >
      {props.overlay && (
        <button type="button" className="n2b-close" onClick={props.onClose}>{copy.close}</button>
      )}
      {typeof window !== 'undefined' && window.location.pathname.includes('/m/tools/n2-bot') && (
        <a className="n2b-back" href="/m/app-1.1-beta">{copy.back}</a>
      )}
      {authLost && <p className="n2b-auth">{copy.loginHint}</p>}
      {opsDegraded && <p className="n2b-auth">{copy.opsDegraded}</p>}
      <section className="n2b-comm">
        <header className="n2b-comm-top">
          <button
            type="button"
            className={`n2b-orb is-${orb}`}
            data-testid="n2-bot-orb"
            aria-label="Nova"
          />
          <div className="n2b-who-block">
            <p className="n2b-who">Nova</p>
            <p className="n2b-who-sub">N2 Bot β · {copy.online}</p>
          </div>
          <button
            type="button"
            className={`n2b-speaker ${speaker ? 'is-on' : ''}`}
            onClick={() => setSpeaker((v) => !v)}
          >
            {speaker ? copy.speakerOn : copy.speakerOff}
          </button>
        </header>
        {live ? (
          <div className="n2b-listen-shell" data-testid="n2-bot-listen-shell">
            <div className="n2b-wave" aria-hidden="true" />
            <p>{copy.listening}</p>
          </div>
        ) : null}
        <N2BotThread
          messages={messages}
          elicit={elicit}
          onPickOption={onPickOption}
        />
        <form
          className="n2b-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUtterance(input, { from: 'text' });
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files || []);
            if (files.length) setAttachments((prev) => [...prev, ...files]);
          }}
        >
          <input
            value={input}
            onChange={(event) => {
              stopNovaVoice();
              if (live) stopLive();
              setInput(event.target.value);
            }}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
          />
          <button
            type="button"
            className={`n2b-live ${live ? 'is-on' : ''}`}
            data-testid="n2-bot-live-talk"
            aria-pressed={live}
            onClick={() => startLive()}
          >
            {copy.liveTalk}
          </button>
          <button type="submit">{copy.send}</button>
          <button type="button" data-testid="n2-bot-hub-toggle" onClick={() => setHubOpen((v) => !v)}>{copy.hub}</button>
        </form>
        {hubOpen && (
          <div className="n2b-hub">
            <Suspense fallback={null}>
              <TemplatesHubPanel />
            </Suspense>
          </div>
        )}
      </section>
      <aside className="n2b-ops" data-testid="n2-bot-ops">
        <N2OpsRail
          items={cards}
          copy={copy}
          focusId={focusId}
          allowedSend={allowedSend}
          onFocus={setFocusId}
          onPause={(sessionId) => {
            void api('/control', {
              method: 'POST',
              body: JSON.stringify({ action: 'pause', sessionId }),
            }).then(() => refreshOps());
          }}
          onAllowSend={() => {
            void handleUtterance('允许');
          }}
        />
        {peek && (
          <N2BotPeek
            path={peek.path}
            kind={peek.kind}
            page={peek.page}
            files={peek.files}
            onClose={() => setPeek(null)}
            onPage={(delta) => setPeek((p) => (p ? { ...p, page: Math.max(1, p.page + delta) } : p))}
            onSwitch={(path, kind) => setPeek((p) => (p ? { ...p, path, kind, page: 1 } : p))}
            onSave={() => {
              if (!peek?.path) return;
              const a = document.createElement('a');
              a.href = `/api/file/content?path=${encodeURIComponent(peek.path)}`;
              a.download = peek.path.split(/[/\\]/).pop() || 'download';
              a.click();
            }}
          />
        )}
      </aside>
    </div>
  );
}
