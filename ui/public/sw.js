// Service Worker for PilotDeck PWA
// Cache only manifest (needed for PWA install). HTML and JS are never pre-cached
// so a rebuild + refresh always picks up the latest assets.
// Bump this token whenever a cached asset's contents change (icons, manifest).
// The activate handler below purges every cache whose name doesn't match,
// so existing PWAs pick up the new visuals on the next page load.
const CACHE_NAME = 'nova-v5';
const urlsToCache = [
  '/manifest.json',
  '/logo-256.png'
];

// PD-SAAS-FORK: Nova-branded offline fallback page (zh-CN). Served when a
// navigation request fails while the network is down.
const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Nova Ai-Studio</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #fafafa; color: #18181b; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }
  @media (prefers-color-scheme: dark) { body { background: #0c1117; color: #e4e4e7; } }
  .card { text-align: center; padding: 32px 24px; max-width: 320px; }
  .card img { width: 72px; height: 72px; margin-bottom: 20px; }
  h1 { font-size: 17px; font-weight: 600; margin: 0 0 8px; }
  p { font-size: 13.5px; line-height: 1.6; margin: 0 0 24px; color: #71717a; }
  @media (prefers-color-scheme: dark) { p { color: #a1a1aa; } }
  button { appearance: none; border: 1px solid #d4d4d8; background: transparent; color: inherit;
           border-radius: 10px; padding: 10px 28px; font-size: 14px; cursor: pointer; }
  @media (prefers-color-scheme: dark) { button { border-color: #3f3f46; } }
</style>
</head>
<body>
<div class="card">
  <img src="/logo-256.png" alt="Nova Ai-Studio" />
  <h1>当前处于离线状态</h1>
  <p>网络连接不可用，请检查网络后重试。已加载的内容仍可继续浏览。</p>
  <button onclick="location.reload()">重新加载</button>
</div>
</body>
</html>`;

// PD-SAAS-FORK: a Service Worker must never run against the Vite dev server.
// It cache-firsts /assets/ and returns an Offline fallback on transient fetch
// failures, which manifests as a stuck "Loading…" / white screen / Offline page
// during local development (and survives rebuilds). When this SW finds itself on
// the dev port it self-destructs: clears caches, unregisters, and reloads every
// controlled client so they fetch fresh assets straight from Vite. Production
// keeps the normal PWA behavior.
const IS_DEV_HOST = self.location.port === '5173';

// Install event
self.addEventListener('install', event => {
  if (IS_DEV_HOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Fetch event — network-first for everything except hashed assets
self.addEventListener('fetch', event => {
  // PD-SAAS-FORK: never intercept anything on the dev server.
  if (IS_DEV_HOST) {
    return;
  }
  const url = event.request.url;

  // Never intercept API requests or WebSocket upgrades
  if (url.includes('/api/') || url.includes('/ws')) {
    return;
  }

  // Navigation requests (HTML) — always go to network, no caching.
  // PD-SAAS-FORK: offline fallback is the Nova-branded zh-CN page above.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
      )
    );
    return;
  }

  // Hashed assets (JS/CSS in /assets/) — cache-first + background refresh (repeat visits instant)
  if (url.includes('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkUpdate = fetch(event.request)
          .then((response) => {
            if (response.ok) void cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);

        if (cached) {
          void networkUpdate;
          return cached;
        }
        return networkUpdate;
      }),
    );
    return;
  }

  // Everything else — network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Activate event — purge old caches
self.addEventListener('activate', event => {
  // PD-SAAS-FORK: on the dev server, self-destruct and reload controlled clients.
  if (IS_DEV_HOST) {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(name => caches.delete(name)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.navigate(client.url); } catch { /* ignore */ }
      }
    })());
    return;
  }
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Push notification event
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Nova Ai-Studio', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: '/logo-256.png',
    badge: '/logo-128.png',
    data: payload.data || {},
    tag: payload.data?.tag || `${payload.data?.sessionId || 'global'}:${payload.data?.code || 'default'}`,
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Nova Ai-Studio', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const sessionId = event.notification.data?.sessionId;
  const provider = event.notification.data?.provider || null;
  const urlPath = sessionId ? `/session/${sessionId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          client.postMessage({
            type: 'notification:navigate',
            sessionId: sessionId || null,
            provider,
            urlPath
          });
          return;
        }
      }
      return self.clients.openWindow(urlPath);
    })
  );
});
