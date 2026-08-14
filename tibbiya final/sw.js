// ============================================================
// طبيّة — sw.js
// Service Worker for offline caching and PWA support
// ============================================================

const CACHE_NAME = 'tibbiya-cache-v5';
const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './admin.html',
  './teacher.html',
  './terms.html',
  './css/style.css',
  './js/theme.js',
  './js/firebase-client.js',
  './js/auth-page.js',
  './js/app.js',
  './js/admin.js',
  './js/teacher.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('firebasestorage.googleapis.com')) return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchRes => {
        if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') return fetchRes;
        const responseToCache = fetchRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return fetchRes;
      });
    })
  );
});
