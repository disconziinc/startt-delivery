self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Novo pedido", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Novo pedido recebido";
  const options = {
    body: payload.body || "Abra o painel da loja para acompanhar o pedido.",
    icon: payload.icon || "/favicon-192x192.png",
    badge: payload.badge || "/favicon-192x192.png",
    tag: payload.tag || `startt-order-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.url || "/",
      orderId: payload.orderId || "",
      companyId: payload.companyId || "",
    },
    actions: [{ action: "open", title: "Ver pedido" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
