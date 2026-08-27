/* Mandovara Interior OS — service worker.
 *
 * Chrome will not offer "Install app" without a service worker that has a
 * fetch handler, so this is what makes the product installable.
 *
 * DELIBERATELY CONSERVATIVE ABOUT WHAT IT CACHES.
 * This app holds one tenant's client list, pricing and payroll, and installed
 * PWAs commonly live on shared showroom tablets. So:
 *   - immutable build assets and fonts  -> cache-first (safe, content-hashed)
 *   - every navigation and API call     -> network-first, NEVER stored
 *   - offline navigations               -> a static offline page, not stale data
 *
 * Field capture already survives offline through the IndexedDB outboxes in
 * src/lib/measure-outbox.ts and attendance-outbox.ts. That queue is the
 * offline story for data; this worker only keeps the shell loadable.
 */

// Bump this on any deploy where server-action IDs change (typically every
// deploy that touches server code). New VERSION → browser installs the new
// SW → activate handler pings all controlled tabs to reload → users pick
// up the new client bundle without a manual hard refresh.
const VERSION      = "mandovara-v3-20260827";
const SHELL_CACHE  = `${VERSION}-shell`;
const ASSET_CACHE  = `${VERSION}-assets`;
const OFFLINE_URL  = "/offline";

// In dev mode (localhost / 127.0.0.1) Turbopack reuses the same /_next/static/
// chunk URLs as file content changes, so caching them produces stale bundles.
// Never cache build output in dev — only the static app shell.
const DEV = (
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1"
);

const SHELL = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        // Nudge every open tab to reload once. Without this, existing tabs
        // keep serving the old JS bundle and any server-action call from
        // them 404s ("Server Action X was not found on the server").
        for (const c of clients) c.postMessage({ type: "SW_ACTIVATED" });
      }),
  );
});

function isImmutableAsset(url) {
  if (DEV) return false; // Turbopack dev chunks are NOT immutable — never cache them
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never let a service worker sit in front of auth or server actions.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login")) return;

  // Content-hashed build output and static assets: cache-first.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Navigations: always go to the network so nobody sees another session's
  // data or a stale page. Fall back to the offline page only when truly down.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())),
    );
  }
});

// Lets the page trigger an immediate update instead of waiting for a reload.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
