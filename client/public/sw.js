// Service worker do Logicar: app instalável, funcionamento básico sem rede e notificações push.
// Estratégia: /assets/* (ficheiros com hash) em cache primeiro; páginas pela rede com página offline
// de recurso; /api/* e /uploads/* nunca vão para a cache (dados pessoais e sempre atuais).
const CACHE = 'logicar-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/socket.io')) return;

  // Ficheiros com hash no nome: nunca mudam, por isso a cache serve primeiro
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
    return;
  }

  // Navegação: sempre pela rede (versão mais recente); sem rede, a página offline
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});

// Push: payload JSON { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Logicar';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      lang: 'pt-PT',
      data: { url: data.url || '/dashboard' },
    }),
  );
});

// Ao tocar na notificação: foca uma janela da app aberta (e navega) ou abre uma nova
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) return existing.focus().then((w) => w.navigate(target));
      return self.clients.openWindow(target);
    }),
  );
});
