import { Resend } from "resend";

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTicketNumber(n, padLength = 4) {
  return String(n).padStart(padLength, "0");
}

function safeUrl(url = "") {
  const value = String(url || "").trim();

  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function formatMoney(value) {
  const number = Number(value || 0);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : "0.00";
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCompraAprobadaEmail({
  to,
  nombre = "cliente",
  rifaNombre = "Rifa",
  rifaDescripcion = "",
  portadaUrl = "",
  fechaEvento = "",
  horaEvento = "",
  tickets = 0,
  numerosTickets = [],
  totalPagar = 0,
  contactoWhatsApp =
    "https://wa.me/17088865291?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20el%20sorteo",
  contactoInstagram =
    "https://www.instagram.com/sorteoslsd/",
  eventoUrl = "",
  verificarUrl = "",
  padLength = 4,
}) {
  if (!to) {
    throw new Error("Falta el correo del destinatario");
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "Falta RESEND_API_KEY en las variables de entorno"
    );
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error(
      "Falta EMAIL_FROM en las variables de entorno"
    );
  }

  const nombreSafe = escapeHtml(nombre);
  const rifaNombreSafe = escapeHtml(rifaNombre);
  const rifaDescripcionSafe = escapeHtml(rifaDescripcion);
const fechaEventoFormateada = (() => {
  if (!fechaEvento) return "";

  const match = String(fechaEvento).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return String(fechaEvento);

  const [, year, month, day] = match;

  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `${Number(day)} de ${meses[Number(month) - 1]} de ${year}`;
})();

const fechaEventoSafe = escapeHtml(fechaEventoFormateada);
const horaEventoSafe = escapeHtml(horaEvento);

  const portadaSafe = safeUrl(portadaUrl);
  const eventoSafe = safeUrl(eventoUrl);
  const verificarSafe = safeUrl(verificarUrl);
  const whatsappSafe = safeUrl(contactoWhatsApp);
  const instagramSafe = safeUrl(contactoInstagram);

  /* =========================================================
     TICKETS
  ========================================================= */

const ticketsPorFila = 5;

const filasTicketsHtml =
  Array.isArray(numerosTickets) && numerosTickets.length > 0
    ? Array.from(
        {
          length: Math.ceil(numerosTickets.length / ticketsPorFila),
        },
        (_, filaIndex) => {
          const inicio = filaIndex * ticketsPorFila;

          const numerosFila = numerosTickets.slice(
            inicio,
            inicio + ticketsPorFila
          );

          const celdas = Array.from(
            { length: ticketsPorFila },
            (_, columnaIndex) => {
              const n = numerosFila[columnaIndex];

              if (n === undefined || n === null) {
                return `
                  <td
                    width="20%"
                    style="
                      width:20%;
                      padding:4px;
                    "
                  >
                    &nbsp;
                  </td>
                `;
              }

              const numero = escapeHtml(
                formatTicketNumber(n, padLength)
              );

              return `
                <td
                  width="20%"
                  align="center"
                  valign="middle"
                  style="
                    width:20%;
                    padding:4px;
                  "
                >
                  <div
                    style="
                      padding:10px 4px;
                      border-radius:10px;
                      background:#ffffff;
                      border:1px solid #e5e7eb;
                      color:#111827;
                      font-size:14px;
                      line-height:1.2;
                      font-weight:900;
                      letter-spacing:.3px;
                      text-align:center;
                      white-space:nowrap;
                    "
                  >
                    #${numero}
                  </div>
                </td>
              `;
            }
          ).join("");

          return `
            <tr>
              ${celdas}
            </tr>
          `;
        }
      ).join("")
    : "";

const ticketsTableHtml =
  filasTicketsHtml
    ? `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          width:100%;
          max-width:100%;
          table-layout:fixed;
          border-collapse:collapse;
        "
      >
        ${filasTicketsHtml}
      </table>
    `
    : `
      <div
        style="
          padding:14px;
          border-radius:10px;
          background:#ffffff;
          border:1px solid #e5e7eb;
          color:#6b7280;
          font-size:13px;
        "
      >
        No hay tickets para mostrar.
      </div>
    `;

  /* =========================================================
     FOTO PRINCIPAL DEL SORTEO
  ========================================================= */

const portadaHtml = portadaSafe
  ? `
    <tr>
      <td
        align="center"
        style="
          padding:18px 22px 0;
          background:#ffffff;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            border-collapse:separate;
            border-spacing:0;
          "
        >
          <tr>
            <td
              align="center"
              style="
                padding:0;
                border-radius:16px;
                overflow:hidden;
                background:#f3f4f6;
              "
            >
              <img
                src="${portadaSafe}"
                width="636"
                alt="${rifaNombreSafe}"
                border="0"
                style="
                  display:block;
                  width:100%;
                  max-width:636px;
                  height:auto;
                  margin:0 auto;
                  border:0;
                  outline:none;
                  text-decoration:none;
                  border-radius:16px;
                "
              />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
  : "";

  /* =========================================================
     FECHA Y HORA
  ========================================================= */

  const infoEventoHtml =
    fechaEvento || horaEvento
      ? `
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            margin-top:12px;
            border-collapse:collapse;
          "
        >
          <tr>
            ${
              fechaEvento
                ? `
                  <td
                    width="${
                      horaEvento
                        ? "50%"
                        : "100%"
                    }"
                    valign="top"
                    style="
                      padding-right:${
                        horaEvento
                          ? "6px"
                          : "0"
                      };
                    "
                  >
                    <div
                      style="
                        background:#ffffff;
                        border:1px solid #fecaca;
                        border-radius:12px;
                        padding:13px;
                      "
                    >
                      <div
                        style="
                          font-size:10px;
                          color:#9ca3af;
                          font-weight:800;
                          letter-spacing:.7px;
                        "
                      >
                        📅 FECHA
                      </div>

                      <div
                        style="
                          margin-top:5px;
                          font-size:14px;
                          font-weight:900;
                          color:#111827;
                        "
                      >
                        ${fechaEventoSafe}
                      </div>
                    </div>
                  </td>
                `
                : ""
            }

            ${
              horaEvento
                ? `
                  <td
                    width="${
                      fechaEvento
                        ? "50%"
                        : "100%"
                    }"
                    valign="top"
                    style="
                      padding-left:${
                        fechaEvento
                          ? "6px"
                          : "0"
                      };
                    "
                  >
                    <div
                      style="
                        background:#ffffff;
                        border:1px solid #fecaca;
                        border-radius:12px;
                        padding:13px;
                      "
                    >
                      <div
                        style="
                          font-size:10px;
                          color:#9ca3af;
                          font-weight:800;
                          letter-spacing:.7px;
                        "
                      >
                        🕐 HORA
                      </div>

                      <div
                        style="
                          margin-top:5px;
                          font-size:14px;
                          font-weight:900;
                          color:#111827;
                        "
                      >
                        ${horaEventoSafe}
                      </div>
                    </div>
                  </td>
                `
                : ""
            }
          </tr>
        </table>
      `
      : "";

  /* =========================================================
     BOTONES
  ========================================================= */

  const buttonsHtml =
    eventoSafe || verificarSafe
      ? `
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            margin-top:22px;
          "
        >
          <tr>
            <td align="center">

              ${
                eventoSafe
                  ? `
                    <a
                      href="${eventoSafe}"
                      style="
                        display:inline-block;
                        margin:4px;
                        padding:13px 22px;
                        border-radius:10px;
                        background:#dc2626;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:12px;
                        font-weight:900;
                        letter-spacing:.4px;
                      "
                    >
                      🎟️ VER EVENTO
                    </a>
                  `
                  : ""
              }

              ${
                verificarSafe
                  ? `
                    <a
                      href="${verificarSafe}"
                      style="
                        display:inline-block;
                        margin:4px;
                        padding:13px 22px;
                        border-radius:10px;
                        background:#111827;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:12px;
                        font-weight:900;
                        letter-spacing:.4px;
                      "
                    >
                      🔎 VERIFICAR TICKETS
                    </a>
                  `
                  : ""
              }

            </td>
          </tr>
        </table>
      `
      : "";

  /* =========================================================
     HTML DEL EMAIL
  ========================================================= */

  const html = `
    <!doctype html>

    <html>
      <head>
        <meta charset="utf-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <meta
          name="color-scheme"
          content="light"
        />

        <meta
          name="supported-color-schemes"
          content="light"
        />

        <title>
          Compra aprobada
        </title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background:#f3f4f6;
          font-family:Arial,Helvetica,sans-serif;
          -webkit-text-size-adjust:100%;
        "
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            background:#f3f4f6;
            border-collapse:collapse;
          "
        >
          <tr>
            <td
              align="center"
              style="
                padding:30px 12px;
              "
            >

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  max-width:680px;
                  background:#ffffff;
                  border-collapse:separate;
                  border-spacing:0;
                  border-radius:22px;
                  overflow:hidden;
                  box-shadow:0 10px 35px rgba(0,0,0,.10);
                "
              >

                <!-- HEADER -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:25px 20px;
                      background:linear-gradient(
                        135deg,
                        #ef4444 0%,
                        #dc2626 45%,
                        #7f1d1d 100%
                      );
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        line-height:1;
                        font-weight:900;
                        color:#ffffff;
                        letter-spacing:1.5px;
                      "
                    >
                      SORTEOS LSD
                    </div>

                    <div
                      style="
                        margin-top:8px;
                        color:#fecaca;
                        font-size:12px;
                        font-weight:700;
                      "
                    >
                      EXPERIENCIAS • PREMIOS • GANADORES
                    </div>

                  </td>
                </tr>

                ${portadaHtml}

                <!-- CONFIRMACIÓN -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:25px 22px 10px;
                      background:#ffffff;
                    "
                  >

                    <div
                      style="
                        display:inline-block;
                        padding:7px 13px;
                        border-radius:999px;
                        background:#dcfce7;
                        border:1px solid #86efac;
                        color:#166534;
                        font-size:11px;
                        font-weight:900;
                        letter-spacing:.4px;
                      "
                    >
                      ✓ COMPRA APROBADA
                    </div>

                    <h1
                      style="
                        margin:14px 0 5px;
                        color:#111827;
                        font-size:25px;
                        line-height:1.2;
                        font-weight:900;
                      "
                    >
                      ¡Ya estás participando! 🎉
                    </h1>

                    <p
                      style="
                        margin:7px auto 0;
                        max-width:500px;
                        color:#6b7280;
                        font-size:14px;
                        line-height:1.6;
                      "
                    >
                      Hola,
                      <strong
                        style="
                          color:#111827;
                        "
                      >
                        ${nombreSafe}
                      </strong>.
                      Tu compra fue aprobada correctamente.
                    </p>

                  </td>
                </tr>

                <!-- NOMBRE DE RIFA -->
                <tr>
                  <td
                    style="
                      padding:14px 22px 0;
                    "
                  >

                    <div
                      style="
                        padding:17px;
                        border-radius:14px;
                        background:#111827;
                        text-align:center;
                      "
                    >

                      <div
                        style="
                          color:#9ca3af;
                          font-size:10px;
                          font-weight:900;
                          letter-spacing:1px;
                        "
                      >
                        ESTÁS PARTICIPANDO EN
                      </div>

                      <div
                        style="
                          margin-top:6px;
                          color:#ffffff;
                          font-size:20px;
                          line-height:1.25;
                          font-weight:900;
                        "
                      >
                        ${rifaNombreSafe}
                      </div>

                    </div>

                  </td>
                </tr>

                <!-- RESUMEN -->
                <tr>
                  <td
                    style="
                      padding:14px 22px 0;
                    "
                  >

                    <div
                      style="
                        padding:17px;
                        border-radius:16px;
                        background:#fff7f7;
                        border:1px solid #fecaca;
                      "
                    >

                      <div
                        style="
                          margin-bottom:12px;
                          color:#b91c1c;
                          font-size:11px;
                          font-weight:900;
                          letter-spacing:.7px;
                        "
                      >
                        RESUMEN DE TU COMPRA
                      </div>

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>

                          <td
                            width="50%"
                            valign="top"
                            style="
                              padding-right:6px;
                            "
                          >
                            <div
                              style="
                                padding:13px;
                                border-radius:12px;
                                background:#ffffff;
                                border:1px solid #fee2e2;
                              "
                            >
                              <div
                                style="
                                  color:#9ca3af;
                                  font-size:10px;
                                  font-weight:800;
                                "
                              >
                                🎟️ TICKETS
                              </div>

                              <div
                                style="
                                  margin-top:5px;
                                  color:#111827;
                                  font-size:20px;
                                  font-weight:900;
                                "
                              >
                                ${Number(tickets || 0)}
                              </div>
                            </div>
                          </td>

                          <td
                            width="50%"
                            valign="top"
                            style="
                              padding-left:6px;
                            "
                          >
                            <div
                              style="
                                padding:13px;
                                border-radius:12px;
                                background:#ffffff;
                                border:1px solid #fee2e2;
                              "
                            >
                              <div
                                style="
                                  color:#9ca3af;
                                  font-size:10px;
                                  font-weight:800;
                                "
                              >
                                💳 MONTO
                              </div>

                              <div
                                style="
                                  margin-top:5px;
                                  color:#111827;
                                  font-size:20px;
                                  font-weight:900;
                                "
                              >
                                $${formatMoney(totalPagar)}
                              </div>
                            </div>
                          </td>

                        </tr>
                      </table>

                      ${infoEventoHtml}

                      ${
                        rifaDescripcionSafe
                          ? `
                            <div
                              style="
                                margin-top:12px;
                                padding:13px;
                                border-radius:12px;
                                background:#ffffff;
                                border:1px solid #fee2e2;
                              "
                            >
                              <div
                                style="
                                  color:#9ca3af;
                                  font-size:10px;
                                  font-weight:800;
                                  letter-spacing:.5px;
                                "
                              >
                                DESCRIPCIÓN
                              </div>

                              <div
                                style="
                                  margin-top:6px;
                                  color:#4b5563;
                                  font-size:13px;
                                  line-height:1.6;
                                "
                              >
                                ${rifaDescripcionSafe}
                              </div>
                            </div>
                          `
                          : ""
                      }

                    </div>

                  </td>
                </tr>

                <!-- TICKETS -->
                <tr>
                  <td
                    style="
                      padding:14px 22px 0;
                    "
                  >

                    <div
                      style="
                        padding:17px;
                        border-radius:16px;
                        background:#f9fafb;
                        border:1px solid #e5e7eb;
                      "
                    >

                      <div
                        style="
                          color:#111827;
                          font-size:15px;
                          font-weight:900;
                        "
                      >
                        🎟️ Tus números asignados
                      </div>

                      <div
                        style="
                          margin-top:4px;
                          margin-bottom:11px;
                          color:#6b7280;
                          font-size:11px;
                        "
                      >
                        Guarda este correo como comprobante de tus números.
                      </div>

                      ${ticketsTableHtml}

                    </div>

                  </td>
                </tr>

                <!-- MENSAJE -->
                <tr>
                  <td
                    style="
                      padding:14px 22px 0;
                    "
                  >

                    <div
                      style="
                        padding:14px 16px;
                        border-radius:13px;
                        background:#fffbeb;
                        border:1px solid #fde68a;
                        color:#92400e;
                        font-size:12px;
                        line-height:1.6;
                      "
                    >
                      🏆 <strong>Importante:</strong>
                      conserva tus números. Podrás verificar tus
                      participaciones desde nuestra página cuando quieras.
                    </div>

                  </td>
                </tr>

                <!-- CONTACTO -->
                <tr>
                  <td
                    style="
                      padding:14px 22px 0;
                    "
                  >

                    <div
                      style="
                        padding:16px;
                        border-radius:15px;
                        background:#111827;
                      "
                    >

                      <div
                        style="
                          color:#ffffff;
                          font-size:13px;
                          font-weight:900;
                          margin-bottom:9px;
                        "
                      >
                        ¿Necesitas ayuda?
                      </div>

                      ${
                        whatsappSafe
                          ? `
                            <div
                              style="
                                margin-bottom:6px;
                                color:#d1d5db;
                                font-size:12px;
                              "
                            >
                              WhatsApp:
                              <a
                                href="${whatsappSafe}"
                                style="
                                  color:#f87171;
                                  text-decoration:none;
                                  font-weight:800;
                                "
                              >
                                Escríbenos aquí
                              </a>
                            </div>
                          `
                          : ""
                      }

                      ${
                        instagramSafe
                          ? `
                            <div
                              style="
                                color:#d1d5db;
                                font-size:12px;
                              "
                            >
                              Instagram:
                              <a
                                href="${instagramSafe}"
                                style="
                                  color:#f87171;
                                  text-decoration:none;
                                  font-weight:800;
                                "
                              >
                                @sorteoslsd
                              </a>
                            </div>
                          `
                          : ""
                      }

                    </div>

                  </td>
                </tr>

                <!-- BOTONES -->
                <tr>
                  <td
                    style="
                      padding:0 22px;
                    "
                  >
                    ${buttonsHtml}
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:25px 22px 28px;
                    "
                  >

                    <div
                      style="
                        color:#111827;
                        font-size:12px;
                        font-weight:900;
                      "
                    >
                      Gracias por confiar en SORTEOS LSD ❤️
                    </div>

                    <div
                      style="
                        margin-top:6px;
                        color:#9ca3af;
                        font-size:10px;
                        line-height:1.5;
                      "
                    >
                      Este correo fue enviado automáticamente
                      después de aprobar tu compra.
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

const { data, error } = await resend.emails.send({
  from: process.env.EMAIL_FROM,
  to,
  subject: `✅ Compra aprobada | ${rifaNombreSafe}`,
  html,
});

  if (error) {
    throw error;
  }

  return data;
}