/* =========================================================
   SORTEOS LSD ADMIN - SERVICE WORKER
   WEB PUSH

   IMPORTANTE:
   Este Service Worker NO cachea páginas, APIs,
   compras, tickets ni información del Admin.
========================================================= */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* =========================================================
   RECIBIR NOTIFICACIÓN PUSH
========================================================= */

self.addEventListener("push", (event) => {
  let data = {};

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    try {
      data = {
        body: event.data ? event.data.text() : "",
      };
    } catch {
      data = {};
    }
  }

  const title =
    data?.title || "🔔 Sorteos LSD Admin";

  const options = {
    body:
      data?.body ||
      "Tienes una nueva notificación.",

    icon: "/admin-icon-192.png",
    badge: "/admin-icon-192.png",

    tag:
      data?.tag ||
      `sorteos-admin-${Date.now()}`,

    renotify: true,

    data: {
      url: data?.url || "/admin",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

/* =========================================================
   ABRIR ADMIN AL TOCAR LA NOTIFICACIÓN
========================================================= */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const destino =
      event.notification?.data?.url ||
      "/admin";

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(async (clientes) => {
          for (const cliente of clientes) {
            try {
              const urlCliente = new URL(
                cliente.url
              );

              if (
                urlCliente.origin ===
                self.location.origin
              ) {
                if ("navigate" in cliente) {
                  await cliente.navigate(
                    destino
                  );
                }

                return cliente.focus();
              }
            } catch {
              // Continuar buscando otra ventana.
            }
          }

          return self.clients.openWindow(
            destino
          );
        })
    );
  }
);