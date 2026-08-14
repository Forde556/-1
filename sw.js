const CACHE_NAME = "tibbiya-v2";
const SHELL = [
  "index.html",
  "app.html",
  "teacher.html",
  "css/style.css",
  "js/firebase-client.js",
  "js/i18n.js",
  "js/app.js",
  "js/auth-page.js",
  "js/teacher.js",
  "manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  // Never cache Firebase/Firestore/Google API calls — always go to network
  if (e.request.url.includes("googleapis.com") || e.request.url.includes("firebaseio.com") || e.request.url.includes("gstatic.com")) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
