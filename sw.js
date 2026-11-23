// Shred Coach offline cache. Bump VERSION when you upload new files.
const VERSION = "shred-coach-v11";
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  // cache:"reload" skips the browser's own 10-minute HTTP cache, so an update is never stuck on an old copy
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Pages: try the network first (fresh app when online), fall back to the saved copy after 2.5 s or when offline.
// Other files: serve the saved copy instantly and refresh it in the background.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === "navigate" || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  e.respondWith(caches.open(VERSION).then(async c => {
    const net = fetch(req, { cache: "no-cache" }).then(r => { if (r && r.ok) c.put(isPage ? "index.html" : req, r.clone()); return r; }).catch(() => null);
    const hit = isPage ? await c.match("index.html") : await c.match(req, { ignoreSearch: true });
    if (isPage) {
      const r = await Promise.race([net, new Promise(res => setTimeout(() => res(null), 2500))]);
      if (r && r.ok) return r;
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response("Offline", { status: 503 });
    }
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline", { status: 503 });
  }));
});

// Rest-over notifications pushed by the Cloudflare worker
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (x) { d = { title: "Rest over", body: "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Rest over", { body: d.body || "", tag: "rest", renotify: true, icon: "icon-192.png", badge: "icon-192.png" }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { for (const c of cs) if ("focus" in c) return c.focus(); return clients.openWindow("./"); }));
});
