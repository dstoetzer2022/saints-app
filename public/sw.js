// ── Service worker (Phase 4.3) ──────────────────────────────────────────────
// App-shell caching so the dugout iPad / a scout's phone can launch straight
// into the app with no signal (stadium concourses are notoriously dead).
//
// Scoped deliberately to STATIC assets only (JS/CSS/fonts/images/the HTML
// shell) — never Base44 API calls. The app already has its own, more nuanced
// data-freshness layer (leagueCache.js's 10-min TTL + force-refresh,
// poolCache.js's rebuild-time snapshots); a blanket service-worker cache on
// top of that would risk silently serving stale season data with no
// coordinated invalidation. Live Scout's own offline resilience is handled
// separately by the IndexedDB outbox (useOfflineAutosave), not this file.
//
// Strategy: stale-while-revalidate for same-origin GETs. Serves the cached
// copy immediately (instant paint, works offline), then silently refetches
// in the background to keep the cache warm for next time — so it can never
// serve indefinitely-stale JS as long as the device gets online occasionally.
const CACHE_NAME = 'saints-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin (Cloudinary, Base44 API) — untouched
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/functions/')) return; // safety net alongside origin check

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached); // offline — fall back to whatever's cached, even if that's nothing
      return cached || network;
    })
  );
});
