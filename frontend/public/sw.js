self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      body: event.data ? event.data.text() : "",
    };
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || "PricePulse",
      {
        body:
          data.body ||
          "Your price alert was triggered.",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
      }
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow("http://localhost:5174/");
      }
    })
  );
});