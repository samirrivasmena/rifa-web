import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(url = "") {
  return String(url || "").trim();
}

function formatDateSafe(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-US", {
    timeZone: "America/Chicago",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatNumber(n, padLength = 4) {
  if (n === null || n === undefined || n === "") {
    return "Sin número";
  }

  return `#${String(n).padStart(padLength, "0")}`;
}

export async function sendFreeDropCancellationEmail({
  to,
  nombre = "cliente",
  eventoNombre = "Evento",
  freeDropNombre = "FREE DROP",
  numeroParticipacion = null,
  codigoFree = "",
  fechaIso = "",
  verificarUrl = "",
  eventoUrl = "",
  contactoWhatsApp =
    "https://wa.me/17088865291?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20mi%20participaci%C3%B3n%20FREE",
  contactoInstagram =
    "https://www.instagram.com/sorteoslsd/",
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
  const eventoNombreSafe = escapeHtml(eventoNombre);
  const freeDropNombreSafe = escapeHtml(freeDropNombre);
  const codigoFreeSafe = escapeHtml(codigoFree);

  const numeroFormateado = formatNumber(
    numeroParticipacion,
    padLength
  );

  const numeroSafe = escapeHtml(numeroFormateado);

  const fechaFormateada = formatDateSafe(fechaIso);
  const fechaSafe = escapeHtml(fechaFormateada);

  const verificarUrlSafe = safeUrl(verificarUrl);
  const eventoUrlSafe = safeUrl(eventoUrl);
  const whatsappUrlSafe = safeUrl(contactoWhatsApp);
  const instagramUrlSafe = safeUrl(contactoInstagram);

  const html = `
    <div
      style="
        margin:0;
        padding:30px 15px;
        background:#f3f4f6;
        font-family:Arial,Helvetica,sans-serif;
      "
    >
      <div
        style="
          width:100%;
          max-width:680px;
          margin:0 auto;
          background:#ffffff;
          border-radius:24px;
          overflow:hidden;
          box-shadow:0 18px 40px rgba(0,0,0,.12);
        "
      >

        <!-- HEADER -->
        <div
          style="
            background:linear-gradient(
              180deg,
              #6b7280 0%,
              #4b5563 55%,
              #374151 100%
            );
            padding:30px 24px;
            text-align:center;
            color:#ffffff;
          "
        >
          <div
            style="
              font-size:30px;
              font-weight:900;
              letter-spacing:1px;
            "
          >
            SORTEOS LSD
          </div>

          <div
            style="
              font-size:14px;
              opacity:.95;
              margin-top:6px;
            "
          >
            Tu participación FREE fue anulada
          </div>
        </div>

        <!-- CONTENIDO -->
        <div
          style="
            padding:28px 24px;
            color:#111827;
          "
        >
          <h2
            style="
              margin:0 0 12px;
              font-size:26px;
              line-height:1.2;
              color:#111827;
            "
          >
            Hola, ${nombreSafe} 👋
          </h2>

          <p
            style="
              margin:0 0 18px;
              font-size:16px;
              line-height:1.7;
              color:#374151;
            "
          >
            Tu participación gratis en
            <strong>${eventoNombreSafe}</strong>
            ha sido anulada.
          </p>

          <!-- AVISO -->
          <div
            style="
              background:#f9fafb;
              border:1px solid #d1d5db;
              border-radius:18px;
              padding:18px;
              margin-bottom:18px;
            "
          >
            <div
              style="
                font-size:14px;
                font-weight:900;
                color:#374151;
                margin-bottom:8px;
              "
            >
              ❌ PARTICIPACIÓN ANULADA
            </div>

            <div
              style="
                font-size:14px;
                line-height:1.7;
                color:#4b5563;
              "
            >
              Esta participación ya no se encuentra activa.
              El número que estaba asociado a esta participación
              dejó de pertenecer a la misma después de la anulación.
            </div>
          </div>

          <!-- RESUMEN -->
          <div
            style="
              background:#f3f4f6;
              border:1px solid #d1d5db;
              border-radius:18px;
              padding:18px;
              margin-bottom:22px;
            "
          >
            <div
              style="
                font-size:14px;
                font-weight:800;
                color:#374151;
                margin-bottom:10px;
                letter-spacing:.02em;
              "
            >
              RESUMEN DE LA PARTICIPACIÓN
            </div>

            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                width:100%;
                table-layout:fixed;
                border-collapse:separate;
                border-spacing:6px;
              "
            >
              <tr>
                <td
                  width="50%"
                  valign="top"
                  style="
                    background:#ffffff;
                    border-radius:14px;
                    padding:14px;
                    border:1px solid #e5e7eb;
                    word-break:break-word;
                  "
                >
                  <div
                    style="
                      font-size:11px;
                      color:#6b7280;
                      font-weight:700;
                    "
                  >
                    EVENTO
                  </div>

                  <div
                    style="
                      font-size:15px;
                      font-weight:800;
                      color:#111827;
                      margin-top:5px;
                      line-height:1.4;
                    "
                  >
                    ${eventoNombreSafe}
                  </div>
                </td>

                <td
                  width="50%"
                  valign="top"
                  style="
                    background:#ffffff;
                    border-radius:14px;
                    padding:14px;
                    border:1px solid #e5e7eb;
                    word-break:break-word;
                  "
                >
                  <div
                    style="
                      font-size:11px;
                      color:#6b7280;
                      font-weight:700;
                    "
                  >
                    FREE DROP
                  </div>

                  <div
                    style="
                      font-size:15px;
                      font-weight:800;
                      color:#111827;
                      margin-top:5px;
                      line-height:1.4;
                    "
                  >
                    ${freeDropNombreSafe}
                  </div>
                </td>
              </tr>

              <tr>
                <td
                  width="50%"
                  valign="top"
                  style="
                    background:#ffffff;
                    border-radius:14px;
                    padding:14px;
                    border:1px solid #e5e7eb;
                    word-break:break-word;
                  "
                >
                  <div
                    style="
                      font-size:11px;
                      color:#6b7280;
                      font-weight:700;
                    "
                  >
                    NÚMERO QUE TENÍAS
                  </div>

                  <div
                    style="
                      font-size:20px;
                      font-weight:900;
                      color:#111827;
                      margin-top:5px;
                    "
                  >
                    ${numeroSafe}
                  </div>
                </td>

                <td
                  width="50%"
                  valign="top"
                  style="
                    background:#ffffff;
                    border-radius:14px;
                    padding:14px;
                    border:1px solid #e5e7eb;
                    word-break:break-word;
                  "
                >
                  <div
                    style="
                      font-size:11px;
                      color:#6b7280;
                      font-weight:700;
                    "
                  >
                    ESTADO
                  </div>

                  <div
                    style="
                      font-size:15px;
                      font-weight:900;
                      color:#4b5563;
                      margin-top:5px;
                    "
                  >
                    ❌ ANULADA
                  </div>
                </td>
              </tr>
            </table>

            <!-- CODIGO FREE -->
            <div
              style="
                margin-top:12px;
                background:#ffffff;
                border-radius:14px;
                padding:14px;
                border:1px solid #e5e7eb;
              "
            >
              <div
                style="
                  font-size:11px;
                  color:#6b7280;
                  font-weight:700;
                "
              >
                CÓDIGO FREE
              </div>

              <div
                style="
                  font-size:20px;
                  font-weight:900;
                  color:#4b5563;
                  margin-top:5px;
                  letter-spacing:1px;
                  word-break:break-word;
                "
              >
                ${codigoFreeSafe}
              </div>
            </div>

            <!-- FECHA Y HORA -->
            <div
              style="
                margin-top:12px;
                background:#ffffff;
                border-radius:14px;
                padding:14px;
                border:1px solid #e5e7eb;
              "
            >
              <div
                style="
                  font-size:11px;
                  color:#6b7280;
                  font-weight:700;
                "
              >
                FECHA Y HORA DE ANULACIÓN
              </div>

              <div
                style="
                  font-size:15px;
                  line-height:1.6;
                  color:#374151;
                  margin-top:6px;
                  font-weight:700;
                "
              >
                ${fechaSafe}
              </div>
            </div>
          </div>

          <!-- CONTACTO -->
          <div
            style="
              background:#f9fafb;
              border:1px solid #e5e7eb;
              border-radius:18px;
              padding:18px;
              margin-bottom:22px;
            "
          >
            <div
              style="
                font-size:14px;
                font-weight:800;
                color:#111827;
                margin-bottom:10px;
              "
            >
              ¿TIENES ALGUNA PREGUNTA?
            </div>

            <p
              style="
                margin:0 0 8px;
                font-size:15px;
                color:#374151;
              "
            >
              WhatsApp:
              <a
                href="${whatsappUrlSafe}"
                style="
                  color:#4b5563;
                  text-decoration:none;
                  font-weight:700;
                "
              >
                Escríbenos aquí
              </a>
            </p>

            <p
              style="
                margin:0;
                font-size:15px;
                color:#374151;
              "
            >
              Instagram:
              <a
                href="${instagramUrlSafe}"
                style="
                  color:#4b5563;
                  text-decoration:none;
                  font-weight:700;
                "
              >
                @sorteoslsd
              </a>
            </p>
          </div>

          <!-- BOTONES -->
          <div
            style="
              text-align:center;
              margin-top:8px;
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
                      background:linear-gradient(
                        180deg,
                        #6b7280 0%,
                        #4b5563 55%,
                        #374151 100%
                      );
                      color:#ffffff;
                      text-decoration:none;
                      font-weight:800;
                      padding:14px 22px;
                      border-radius:999px;
                      box-shadow:0 12px 24px rgba(75,85,99,.20);
                    "
                  >
                    VER EVENTO
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
                      background:#111827;
                      color:#ffffff;
                      text-decoration:none;
                      font-weight:800;
                      padding:14px 22px;
                      border-radius:999px;
                      box-shadow:0 12px 24px rgba(17,24,39,.15);
                    "
                  >
                    MIS TICKETS
                  </a>
                `
                : ""
            }
          </div>

          <!-- FOOTER -->
          <p
            style="
              margin:24px 0 0;
              font-size:13px;
              line-height:1.6;
              color:#6b7280;
              text-align:center;
            "
          >
            <strong>SORTEOS LSD</strong>
            <br />
            Este correo fue enviado automáticamente
            al anular tu participación gratis.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
SORTEOS LSD

Tu participación FREE fue anulada.

Evento: ${eventoNombre}
Free Drop: ${freeDropNombre}
Número que tenías: ${numeroFormateado}
Código FREE: ${codigoFree}
Estado: ANULADA
Fecha y hora de anulación: ${fechaFormateada}

Ver participación: ${verificarUrlSafe || "N/A"}
Ver evento: ${eventoUrlSafe || "N/A"}

Si tienes alguna pregunta, puedes comunicarte con SORTEOS LSD.
  `.trim();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: `❌ Participación FREE anulada - ${eventoNombreSafe}`,
    html,
    text,
  });

  if (error) {
    console.error(
      "Error enviando correo de anulación FREE:",
      error
    );

    throw new Error(
      error?.message ||
        "No se pudo enviar el correo de anulación FREE"
    );
  }

  return data;
}