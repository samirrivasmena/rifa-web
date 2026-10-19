import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   SORTEOS LSD ADMIN
   SERVICIO DE WEB PUSH
========================================================= */

let vapidConfigurado = false;

/* =========================================================
   CONFIGURAR VAPID
========================================================= */

function configurarVapid() {
  if (vapidConfigurado) {
    return true;
  }

  const publicKey = String(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
  ).trim();

  const privateKey = String(
    process.env.VAPID_PRIVATE_KEY || ""
  ).trim();

  const subject = String(
    process.env.VAPID_SUBJECT || ""
  ).trim();

  /* -------------------------------------------------------
     COMPROBAR VARIABLES

     IMPORTANTE:
     Solo mostramos true/false.
     Nunca mostramos las claves en los logs.
  ------------------------------------------------------- */

  if (!publicKey || !privateKey || !subject) {
    console.error(
      "Admin Push: variables VAPID incompletas",
      {
        publicKey: Boolean(publicKey),
        privateKey: Boolean(privateKey),
        subject: Boolean(subject),
      }
    );

    return false;
  }

  try {
    webpush.setVapidDetails(
      subject,
      publicKey,
      privateKey
    );

    vapidConfigurado = true;

    return true;
  } catch (error) {
    console.error(
      "Admin Push: error configurando VAPID:",
      error
    );

    return false;
  }
}

/* =========================================================
   ELIMINAR SUSCRIPCIÓN EXPIRADA
========================================================= */

async function eliminarSuscripcion(endpoint) {
  try {
    const { error } = await supabaseAdmin
      .from("admin_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      console.error(
        "Admin Push: no se pudo eliminar una suscripción expirada:",
        error
      );
    }
  } catch (error) {
    console.error(
      "Admin Push: no se pudo eliminar una suscripción expirada:",
      error
    );
  }
}

/* =========================================================
   ENVIAR PUSH A LOS DISPOSITIVOS ADMIN
========================================================= */

export async function enviarPushAdmins({
  title = "🔔 Sorteos LSD Admin",
  body = "Tienes una nueva notificación.",
  url = "/admin",
  tag = "sorteos-admin",
} = {}) {
  try {
    /* -----------------------------------------------------
       CONFIGURAR VAPID
    ----------------------------------------------------- */

    if (!configurarVapid()) {
      return {
        ok: false,
        enviados: 0,
        error: "Configuración VAPID incompleta",
      };
    }

    /* -----------------------------------------------------
       OBTENER DISPOSITIVOS REGISTRADOS
    ----------------------------------------------------- */

    const {
      data: subscriptions,
      error,
    } = await supabaseAdmin
      .from("admin_push_subscriptions")
      .select(
        "id, endpoint, p256dh, auth"
      );

    if (error) {
      console.error(
        "Admin Push: error obteniendo suscripciones:",
        error
      );

      return {
        ok: false,
        enviados: 0,
        error:
          "No se pudieron obtener las suscripciones",
      };
    }

    /* -----------------------------------------------------
       NO HAY DISPOSITIVOS
    ----------------------------------------------------- */

    if (
      !Array.isArray(subscriptions) ||
      subscriptions.length === 0
    ) {
      return {
        ok: true,
        enviados: 0,
        fallidos: 0,
        total: 0,
      };
    }

    /* -----------------------------------------------------
       PREPARAR NOTIFICACIÓN
    ----------------------------------------------------- */

    const payload = JSON.stringify({
      title,
      body,
      url,
      tag,
    });

    /* -----------------------------------------------------
       ENVIAR A TODOS LOS DISPOSITIVOS
    ----------------------------------------------------- */

    const resultados =
      await Promise.allSettled(
        subscriptions.map(
          async (item) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: item.endpoint,

                  keys: {
                    p256dh: item.p256dh,
                    auth: item.auth,
                  },
                },
                payload,
                {
                  TTL: 60,
                }
              );

              return {
                ok: true,
                id: item.id,
              };
            } catch (errorPush) {
              const statusCode =
                Number(
                  errorPush?.statusCode ||
                    errorPush?.status
                ) || 0;

              /*
               * 404 / 410:
               * La suscripción ya no existe
               * o expiró.
               *
               * La eliminamos de Supabase.
               */

              if (
                statusCode === 404 ||
                statusCode === 410
              ) {
                await eliminarSuscripcion(
                  item.endpoint
                );

                return {
                  ok: false,
                  eliminada: true,
                  id: item.id,
                  statusCode,
                };
              }

              console.error(
                "Admin Push: error enviando notificación:",
                statusCode || errorPush
              );

              return {
                ok: false,
                id: item.id,
                statusCode,
              };
            }
          }
        )
      );

    /* -----------------------------------------------------
       CONTAR RESULTADOS
    ----------------------------------------------------- */

    const enviados = resultados.filter(
      (resultado) =>
        resultado.status === "fulfilled" &&
        resultado.value?.ok === true
    ).length;

    const fallidos = resultados.filter(
      (resultado) =>
        resultado.status === "rejected" ||
        resultado.value?.ok === false
    ).length;

    /* -----------------------------------------------------
       RESULTADO
    ----------------------------------------------------- */

    return {
      ok: true,
      enviados,
      fallidos,
      total: subscriptions.length,
    };
  } catch (error) {
    console.error(
      "Admin Push: error general:",
      error
    );

    /*
     * Una falla en Push nunca debe romper
     * posteriormente la lógica de una compra.
     */

    return {
      ok: false,
      enviados: 0,
      error:
        "Error enviando notificaciones",
    };
  }
}