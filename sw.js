const CACHE_NAME = 'naru-higure-vpn-files-v1';
const APP_ROOT = '/Naru-higure-tech-vpnfiles-/';
const APP_SHELL = [
  APP_ROOT,
  APP_ROOT + 'manifest.json',
  APP_ROOT + 'icons/icon-192.png',
  APP_ROOT + 'icons/icon-512.png',
  APP_ROOT + 'icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for pages so the latest site and Supabase-backed UI are used.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(APP_ROOT)));
    return;
  }

  // Cache only this site's static PWA files; leave Supabase/API traffic untouched.
  if (url.pathname.startsWith(APP_ROOT + 'icons/') || url.pathname === APP_ROOT + 'manifest.json') {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
