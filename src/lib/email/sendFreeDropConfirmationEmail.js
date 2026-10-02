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
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatNumber(n, padLength = 4) {
  if (n === null || n === undefined || n === "") return "Sin número";
  return `#${String(n).padStart(padLength, "0")}`;
}

export async function sendFreeDropConfirmationEmail({
  to,
  nombre = "cliente",
  eventoNombre = "Evento",
  freeDropNombre = "FREE DROP #1",
  numeroParticipacion = null,
  codigoFree = "",
  estado = "VÁLIDO",
  fechaIso = "",
  verificarUrl = "",
  eventoUrl = "",
  contactoWhatsApp = "https://wa.me/17088865291?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20el%20free%20drop",
  contactoInstagram = "https://www.instagram.com/sorteoslsd/",
  padLength = 4,
}) {
  if (!to) {
    throw new Error("Falta el correo del destinatario");
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("Falta RESEND_API_KEY en las variables de entorno");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("Falta EMAIL_FROM en las variables de entorno");
  }

  const nombreSafe = escapeHtml(nombre);
  const eventoNombreSafe = escapeHtml(eventoNombre);
  const freeDropNombreSafe = escapeHtml(freeDropNombre);
  const codigoFreeSafe = escapeHtml(codigoFree);
  const estadoSafe = escapeHtml(estado);
  const fechaSafe = escapeHtml(formatDateSafe(fechaIso));
  const numeroSafe = escapeHtml(formatNumber(numeroParticipacion, padLength));

  const verificarUrlSafe = safeUrl(verificarUrl);
  const eventoUrlSafe = safeUrl(eventoUrl);
  const whatsappUrlSafe = safeUrl(contactoWhatsApp);
  const instagramUrlSafe = safeUrl(contactoInstagram);

  const html = `
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.12);">
        
        <div style="background:linear-gradient(180deg,#22c55e 0%,#16a34a 55%,#166534 100%);padding:30px 24px;text-align:center;color:#fff;">
          <div style="font-size:30px;font-weight:900;letter-spacing:1px;">RIFAS LSD</div>
          <div style="font-size:14px;opacity:.95;margin-top:6px;">Tu participación gratis fue registrada correctamente</div>
        </div>

        <div style="padding:28px 24px;color:#111827;">
          <h2 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#111827;">
            Hola, ${nombreSafe} 👋
          </h2>

          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">
            Tu participación gratis en <strong>${eventoNombreSafe}</strong> fue registrada.
          </p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:18px;padding:18px;margin-bottom:22px;">
            <div style="font-size:14px;font-weight:800;color:#166534;margin-bottom:8px;letter-spacing:.02em;">
              RESUMEN DE TU FREE DROP
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;">
              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #d1fae5;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">EVENTO</div>
                <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${eventoNombreSafe}</div>
              </div>

              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #d1fae5;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">FREE DROP</div>
                <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${freeDropNombreSafe}</div>
              </div>

              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #d1fae5;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">NÚMERO DE PARTICIPACIÓN</div>
                <div style="font-size:20px;font-weight:900;color:#111827;margin-top:4px;">${numeroSafe}</div>
              </div>

              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #d1fae5;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">ESTADO</div>
                <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${estadoSafe}</div>
              </div>
            </div>

            <div style="margin-top:16px;background:#fff;border-radius:14px;padding:14px;border:1px solid #d1fae5;">
              <div style="font-size:12px;color:#6b7280;font-weight:700;">CÓDIGO FREE</div>
              <div style="font-size:20px;font-weight:900;color:#16a34a;margin-top:4px;letter-spacing:1px;">
                ${codigoFreeSafe}
              </div>
            </div>

            <div style="margin-top:16px;background:#fff;border-radius:14px;padding:14px;border:1px solid #d1fae5;">
              <div style="font-size:12px;color:#6b7280;font-weight:700;">FECHA</div>
              <div style="font-size:15px;line-height:1.6;color:#374151;margin-top:6px;">
                ${fechaSafe}
              </div>
            </div>
          </div>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:18px;padding:18px;margin-bottom:22px;">
            <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:10px;">CONTACTO</div>
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">
              WhatsApp: <a href="${whatsappUrlSafe}" style="color:#16a34a;text-decoration:none;font-weight:700;">Escríbenos aquí</a>
            </p>
            <p style="margin:0;font-size:15px;color:#374151;">
              Instagram: <a href="${instagramUrlSafe}" style="color:#16a34a;text-decoration:none;font-weight:700;">Ver perfil</a>
            </p>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:8px;text-align:center;">
            ${
              eventoUrlSafe
                ? `
              <a href="${eventoUrlSafe}"
                 style="
                   display:inline-block;
                   background:linear-gradient(180deg,#22c55e 0%,#16a34a 55%,#166534 100%);
                   color:#fff;
                   text-decoration:none;
                   font-weight:800;
                   padding:14px 22px;
                   border-radius:999px;
                   box-shadow:0 12px 24px rgba(22,163,74,.25);
                 ">
                VER EVENTO
              </a>`
                : ""
            }

            ${
              verificarUrlSafe
                ? `
              <a href="${verificarUrlSafe}"
                 style="
                   display:inline-block;
                   background:#111827;
                   color:#fff;
                   text-decoration:none;
                   font-weight:800;
                   padding:14px 22px;
                   border-radius:999px;
                   box-shadow:0 12px 24px rgba(17,24,39,.15);
                 ">
                VERIFICAR PARTICIPACIÓN
              </a>`
                : ""
            }
          </div>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
            Gracias por participar en <strong>Rifas LSD</strong>.<br />
            Este correo fue enviado automáticamente al registrar tu participación gratis.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
Tu participación gratis fue registrada correctamente.

Evento: ${eventoNombre}
Free Drop: ${freeDropNombre}
Número de participación: ${formatNumber(numeroParticipacion, padLength)}
Código FREE: ${codigoFree}
Estado: ${estado}
Fecha: ${formatDateSafe(fechaIso)}

Verificar participación: ${verificarUrlSafe || "N/A"}
Ver evento: ${eventoUrlSafe || "N/A"}
`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: `🎉 Tu participación FREE fue registrada - ${eventoNombreSafe}`,
    html,
    text,
  });

  if (error) {
    throw error;
  }

  return data;
}