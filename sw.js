// Shred Coach offline cache. Bump VERSION when you upload new files.
const VERSION = "shred-coach-v8";
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Serve from the phone first (instant, works offline), then refresh the copy in the background when online.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("index.html") : null);
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
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
