// Service worker al aplicatiei de admin (scope /admin): primeste notificari push si le afiseaza.
const SW = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // necesar pentru instalare pe unele telefoane; nu schimba comportamentul

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Villa Les Mouettes";
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || "",
      tag: d.tag || "vlm",
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 150, 500, 150, 900],
      icon: "/admin-icons/icon-192.png",
      badge: "/admin-icons/badge.png",
      timestamp: Date.now(),
      data: { url: d.url || "/admin" },
    });
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    wins.forEach((c) => c.postMessage({ type: "push", payload: d }));
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.indexOf("/admin") !== -1 && "focus" in c) { try { await c.navigate(url); } catch (e) {} return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
`;

export async function GET() {
  return new Response(SW, { headers: { "content-type": "application/javascript; charset=utf-8", "service-worker-allowed": "/admin", "cache-control": "no-cache" } });
}
