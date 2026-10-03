import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value) {
  const url = String(value ?? "").trim();

  if (!url) {
    return "";
  }

  if (!/^https?:\/\//i.test(url)) {
    return "";
  }

  return url;
}

function formatMoney(value) {
  const numero = Number(value ?? 0);

  if (!Number.isFinite(numero)) {
    return "$0.00";
  }

  return `$${numero.toFixed(2)}`;
}

function formatDateSafe(value) {
  try {
    const fecha = value ? new Date(value) : new Date();

    if (Number.isNaN(fecha.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("es-US", {
      timeZone: "America/Chicago",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(fecha);
  } catch {
    return "";
  }
}

export async function sendCompraRechazadaEmail({
  to,
  nombre = "cliente",

  rifaNombre = "Evento",
  portadaUrl = "",

  cantidadTickets = 0,
  montoTotal = 0,

  referencia = "",
  metodoPago = "",

  fechaIso = null,

  eventoUrl = "",
  verificarUrl = "",
}) {
  const emailDestino = String(to ?? "").trim();

  if (!emailDestino) {
    throw new Error(
      "No se proporcionó un correo para enviar la notificación de rechazo"
    );
  }

  const nombreSafe =
    escapeHtml(nombre || "cliente");

  const rifaNombreSafe =
    escapeHtml(rifaNombre || "Evento");

  const portadaSafe =
    safeUrl(portadaUrl);

  const eventoUrlSafe =
    safeUrl(eventoUrl);

  const verificarUrlSafe =
    safeUrl(verificarUrl);

  const referenciaSafe =
    escapeHtml(referencia || "No especificada");

  const metodoPagoSafe =
    escapeHtml(metodoPago || "No especificado");

  const cantidadSafe =
    Number(cantidadTickets ?? 0);

  const montoSafe =
    formatMoney(montoTotal);

  const fechaSafe =
    escapeHtml(
      formatDateSafe(
        fechaIso || new Date().toISOString()
      )
    );

  const html = `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <title>Compra rechazada</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#f3f4f6;
      font-family:Arial,Helvetica,sans-serif;
      color:#111827;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#f3f4f6;"
    >
      <tr>
        <td
          align="center"
          style="padding:24px 12px;"
        >

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width:680px;
              background:#ffffff;
              border-radius:18px;
              overflow:hidden;
              box-shadow:0 8px 30px rgba(0,0,0,0.08);
            "
          >

            <!-- HEADER -->
            <tr>
              <td
                align="center"
                style="
                  padding:28px 24px;
                  background:linear-gradient(
                    135deg,
                    #991b1b,
                    #dc2626,
                    #7f1d1d
                  );
                  color:#ffffff;
                "
              >
                <div
                  style="
                    font-size:28px;
                    line-height:1.2;
                    font-weight:900;
                    letter-spacing:0.5px;
                  "
                >
                  SORTEOS LSD
                </div>

                <div
                  style="
                    margin-top:8px;
                    font-size:14px;
                    line-height:1.5;
                    color:#fee2e2;
                  "
                >
                  Actualización sobre tu compra
                </div>
              </td>
            </tr>

            <!-- CONTENIDO -->
            <tr>
              <td
                style="
                  padding:28px 24px 10px;
                "
              >
                <div
                  style="
                    font-size:22px;
                    font-weight:800;
                    color:#111827;
                  "
                >
                  Hola, ${nombreSafe} 👋
                </div>

                <div
                  style="
                    margin-top:12px;
                    font-size:15px;
                    line-height:1.7;
                    color:#4b5563;
                  "
                >
                  Te informamos que tu compra para
                  <strong>${rifaNombreSafe}</strong>
                  no pudo ser aprobada.
                </div>
              </td>
            </tr>

            <!-- ALERTA -->
            <tr>
              <td
                style="
                  padding:10px 24px 14px;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background:#fef2f2;
                    border:1px solid #fecaca;
                    border-radius:14px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:18px;
                      "
                    >
                      <div
                        style="
                          font-size:14px;
                          font-weight:900;
                          color:#991b1b;
                        "
                      >
                        ❌ COMPRA RECHAZADA
                      </div>

                      <div
                        style="
                          margin-top:8px;
                          font-size:13px;
                          line-height:1.6;
                          color:#7f1d1d;
                        "
                      >
                        Esta compra no fue aprobada y
                        no tiene tickets asignados.
                        Si consideras que hubo un error,
                        puedes comunicarte con nosotros.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${
              portadaSafe
                ? `
            <!-- PORTADA -->
            <tr>
              <td
                style="
                  padding:4px 24px 18px;
                "
              >
                <img
                  src="${portadaSafe}"
                  alt="${rifaNombreSafe}"
                  width="632"
                  style="
                    display:block;
                    width:100%;
                    max-width:632px;
                    height:auto;
                    border:0;
                    border-radius:14px;
                  "
                />
              </td>
            </tr>
            `
                : ""
            }

            <!-- RESUMEN -->
            <tr>
              <td
                style="
                  padding:4px 24px 18px;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background:#f9fafb;
                    border:1px solid #e5e7eb;
                    border-radius:14px;
                  "
                >
                  <tr>
                    <td
                      colspan="2"
                      style="
                        padding:16px 16px 10px;
                        font-size:13px;
                        font-weight:900;
                        color:#374151;
                      "
                    >
                      RESUMEN DE LA COMPRA
                    </td>
                  </tr>

                  <tr>
                    <td
                      width="50%"
                      valign="top"
                      style="
                        padding:8px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              EVENTO
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#111827;
                                font-weight:900;
                              "
                            >
                              ${rifaNombreSafe}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>

                    <td
                      width="50%"
                      valign="top"
                      style="
                        padding:8px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              ESTADO
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#b91c1c;
                                font-weight:900;
                              "
                            >
                              ❌ RECHAZADA
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td
                      width="50%"
                      valign="top"
                      style="
                        padding:8px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              TICKETS SOLICITADOS
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#111827;
                                font-weight:900;
                              "
                            >
                              ${escapeHtml(cantidadSafe)}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>

                    <td
                      width="50%"
                      valign="top"
                      style="
                        padding:8px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              MONTO
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#111827;
                                font-weight:900;
                              "
                            >
                              ${montoSafe}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td
                      width="50%"
                      valign="top"
                      style="
                        padding:8px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              REFERENCIA
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#111827;
                                font-weight:900;
                              "
                            >
                              ${referenciaSafe}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>

                    <td
                      width="50%"
                      valign="top"
                      style="
                        padding:8px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              MÉTODO DE PAGO
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#111827;
                                font-weight:900;
                              "
                            >
                              ${metodoPagoSafe}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td
                      colspan="2"
                      style="
                        padding:8px 8px 16px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background:#ffffff;
                          border:1px solid #e5e7eb;
                          border-radius:10px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:12px;
                            "
                          >
                            <div
                              style="
                                font-size:10px;
                                color:#6b7280;
                                font-weight:700;
                              "
                            >
                              FECHA Y HORA DEL RECHAZO
                            </div>

                            <div
                              style="
                                margin-top:5px;
                                font-size:14px;
                                color:#111827;
                                font-weight:900;
                              "
                            >
                              ${fechaSafe || "No disponible"}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- INFORMACIÓN -->
            <tr>
              <td
                style="
                  padding:0 24px 22px;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    background:#fff7ed;
                    border:1px solid #fed7aa;
                    border-radius:14px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:16px;
                        font-size:13px;
                        line-height:1.6;
                        color:#9a3412;
                      "
                    >
                      <strong>¿Crees que hubo un error?</strong>
                      <br />
                      Puedes comunicarte con nosotros para
                      revisar tu comprobante o realizar una
                      nueva compra.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BOTONES -->
            ${
              eventoUrlSafe || verificarUrlSafe
                ? `
            <tr>
              <td
                align="center"
                style="
                  padding:0 24px 28px;
                "
              >
                ${
                  eventoUrlSafe
                    ? `
                <a
                  href="${eventoUrlSafe}"
                  style="
                    display:inline-block;
                    margin:5px;
                    padding:13px 20px;
                    background:#111827;
                    color:#ffffff;
                    text-decoration:none;
                    border-radius:10px;
                    font-size:13px;
                    font-weight:800;
                  "
                >
                  Ver evento
                </a>
                `
                    : ""
                }

                ${
                  verificarUrlSafe
                    ? `
                <a
                  href="${verificarUrlSafe}"
                  style="
                    display:inline-block;
                    margin:5px;
                    padding:13px 20px;
                    background:#e5e7eb;
                    color:#111827;
                    text-decoration:none;
                    border-radius:10px;
                    font-size:13px;
                    font-weight:800;
                  "
                >
                  Mis tickets
                </a>
                `
                    : ""
                }
              </td>
            </tr>
            `
                : ""
            }

            <!-- FOOTER -->
            <tr>
              <td
                align="center"
                style="
                  padding:20px 24px 26px;
                  background:#111827;
                  color:#d1d5db;
                "
              >
                <div
                  style="
                    font-size:13px;
                    font-weight:800;
                    color:#ffffff;
                  "
                >
                  SORTEOS LSD
                </div>

                <div
                  style="
                    margin-top:7px;
                    font-size:11px;
                    line-height:1.6;
                  "
                >
                  Este correo fue enviado automáticamente.
                  <br />
                  No compartas información sensible por correo.
                </div>

                <div
                  style="
                    margin-top:10px;
                    font-size:11px;
                  "
                >
                  Instagram: @sorteoslsd
                </div>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  const from =
    process.env.EMAIL_FROM ||
    "SORTEOS LSD <notificaciones@sorteoslsd.com>";

  const subject =
    `❌ Compra rechazada - ${rifaNombre || "Evento"}`;

  const { data, error } = await resend.emails.send({
    from,
    to: emailDestino,
    subject,
    html,
  });

  if (error) {
    throw new Error(
      error.message ||
        "No se pudo enviar el correo de compra rechazada"
    );
  }

  return {
    ok: true,
    data,
  };
}