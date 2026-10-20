/* =========================================================
   SORTEOS LSD ADMIN - SERVICE WORKER
   WEB PUSH + BADGE DE NOTIFICACIONES

   IMPORTANTE:
   Este Service Worker NO cachea páginas, APIs,
   compras, tickets ni información del Admin.

   Solo guarda localmente el número del badge
   de notificaciones del icono de la aplicación.
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
    (async () => {
      /* =====================================================
         1. MOSTRAR NOTIFICACIÓN
         Se mantiene la notificación que ya funcionaba.
      ===================================================== */

      await self.registration.showNotification(
        title,
        options
      );

      /* =====================================================
         2. SUMAR CONTADOR AL ICONO DE LA APP
      ===================================================== */

      if ("setAppBadge" in self.navigator) {
        try {
          const cache = await caches.open(
            "sorteos-admin-badge"
          );

          const response = await cache.match(
            "/admin-badge-count"
          );

          let count = 0;

          if (response) {
            count =
              Number(await response.text()) || 0;
          }

          count += 1;

          await cache.put(
            "/admin-badge-count",
            new Response(String(count))
          );

          await self.navigator.setAppBadge(
            count
          );
        } catch (error) {
          console.error(
            "No se pudo actualizar el badge:",
            error
          );
        }
      }
    })()
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