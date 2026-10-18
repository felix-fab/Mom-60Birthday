// Service Worker – macht die Seite installierbar (PWA) und funktioniert offline.
const CACHE = "mom60-v2";

// Kern-Dateien, die für die Offline-Nutzung gecacht werden
const CORE = [
  "/display",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Beim Installieren die Kern-Dateien vorab cachen
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Alte Caches aufräumen
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Strategie: immer erst Netz (die App braucht die Live-Verbindung),
// bei Fehler auf den Cache zurückgreifen.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Erfolgreiche Antworten für spätere Offline-Nutzung cachen
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/display")))
  );
});
