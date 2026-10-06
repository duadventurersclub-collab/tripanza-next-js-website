self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: "Tripanza Workspace", body: event.data.text() || "New notification" }; }

    const options = {
      body: payload.body || "",
      data: { ...(payload.data || {}), url: payload.url || payload.data?.url || "/cs" },
      tag: payload.tag || "default",
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(payload.title || "Tripanza Workspace", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requested = new URL(event.notification.data?.url || "/cs", self.location.origin);
  const url = requested.origin === self.location.origin ? requested.href : new URL("/cs", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) { client.navigate(url); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("install", () => {
  self.skipWaiting();
});
