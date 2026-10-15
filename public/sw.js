// Service worker pro Web Push: zobrazí upozornění na uzavírku na trase občana.
self.addEventListener("push", (event) => {
  let data = { title: "Cesty KHK", body: "Nové upozornění" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // Push bez textu: zůstane výchozí zpráva.
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
