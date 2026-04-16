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
  return String(url || "").trim();
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
  contactoWhatsApp = "https://wa.me/17738277463?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa",
  contactoInstagram = "https://www.instagram.com/samir__rivas/",
  eventoUrl = "",
  verificarUrl = "",
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
  const rifaNombreSafe = escapeHtml(rifaNombre);
  const rifaDescripcionSafe = escapeHtml(rifaDescripcion);
  const fechaEventoSafe = escapeHtml(fechaEvento);
  const horaEventoSafe = escapeHtml(horaEvento);

  const numeroTicketsHtml =
    Array.isArray(numerosTickets) && numerosTickets.length > 0
      ? numerosTickets
          .map(
            (n) => `
              <span style="
                display:inline-block;
                padding:10px 14px;
                margin:4px;
                border-radius:12px;
                background:#f8fafc;
                border:1px solid #e5e7eb;
                color:#111827;
                font-weight:700;
                font-size:14px;
                min-width:58px;
                text-align:center;
              ">${formatTicketNumber(n, padLength)}</span>
            `
          )
          .join("")
      : `<p style="margin:0;color:#6b7280;">No hay tickets para mostrar</p>`;

  const portadaHtml = safeUrl(portadaUrl)
    ? `
      <div style="margin:0 0 18px;">
        <img
          src="${safeUrl(portadaUrl)}"
          alt="${rifaNombreSafe}"
          style="
            width:100%;
            max-width:100%;
            display:block;
            border-radius:20px;
            object-fit:cover;
            border:1px solid #e5e7eb;
          "
        />
      </div>
    `
    : "";

  const infoEventoHtml =
    fechaEvento || horaEvento
      ? `
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 0;">
          ${
            fechaEvento
              ? `
            <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #fde2e2;">
              <div style="font-size:12px;color:#6b7280;font-weight:700;">FECHA</div>
              <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${fechaEventoSafe}</div>
            </div>`
              : ""
          }
          ${
            horaEvento
              ? `
            <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #fde2e2;">
              <div style="font-size:12px;color:#6b7280;font-weight:700;">HORA</div>
              <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${horaEventoSafe}</div>
            </div>`
              : ""
          }
        </div>
      `
      : "";

  const buttonsHtml = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:8px;text-align:center;">
      ${
        safeUrl(eventoUrl)
          ? `
        <a href="${safeUrl(eventoUrl)}"
           style="
             display:inline-block;
             background:linear-gradient(180deg,#ff4d4d 0%,#d90429 55%,#8b0000 100%);
             color:#fff;
             text-decoration:none;
             font-weight:800;
             padding:14px 22px;
             border-radius:999px;
             box-shadow:0 12px 24px rgba(217,4,41,.25);
           ">
          VER EVENTO
        </a>`
          : ""
      }

      ${
        safeUrl(verificarUrl)
          ? `
        <a href="${safeUrl(verificarUrl)}"
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
          VERIFICAR TICKETS
        </a>`
          : ""
      }
    </div>
  `;

  const html = `
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.12);">
        <div style="background:linear-gradient(180deg,#ff4d4d 0%,#d90429 55%,#8b0000 100%);padding:30px 24px;text-align:center;color:#fff;">
          <div style="font-size:30px;font-weight:900;letter-spacing:1px;">RIFAS LSD</div>
          <div style="font-size:14px;opacity:.95;margin-top:6px;">Tu compra fue aprobada correctamente</div>
        </div>

        <div style="padding:28px 24px;color:#111827;">
          <h2 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#111827;">
            Hola, ${nombreSafe} 👋
          </h2>

          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">
            Tu compra de <strong>${rifaNombreSafe}</strong> fue <strong>aprobada</strong>.
            Aquí tienes el resumen de tu participación.
          </p>

          ${portadaHtml}

          <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:18px;padding:18px;margin-bottom:22px;">
            <div style="font-size:14px;font-weight:800;color:#b91c1c;margin-bottom:8px;letter-spacing:.02em;">
              RESUMEN DE TU COMPRA
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;">
              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #fde2e2;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">RIFA</div>
                <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${rifaNombreSafe}</div>
              </div>

              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #fde2e2;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">TICKETS</div>
                <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">${Number(tickets || 0)}</div>
              </div>

              <div style="flex:1;min-width:180px;background:#fff;border-radius:14px;padding:14px;border:1px solid #fde2e2;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">MONTO</div>
                <div style="font-size:16px;font-weight:800;color:#111827;margin-top:4px;">USD $${Number(totalPagar || 0).toFixed(2)}</div>
              </div>
            </div>

            ${infoEventoHtml}

            ${
              rifaDescripcionSafe
                ? `
              <div style="margin-top:16px;background:#fff;border-radius:14px;padding:14px;border:1px solid #fde2e2;">
                <div style="font-size:12px;color:#6b7280;font-weight:700;">DESCRIPCIÓN</div>
                <div style="font-size:15px;line-height:1.6;color:#374151;margin-top:6px;">${rifaDescripcionSafe}</div>
              </div>
            `
                : ""
            }

            <div style="font-size:13px;font-weight:800;color:#b91c1c;margin:18px 0 10px;">
              TUS TICKETS ASIGNADOS
            </div>

            <div style="line-height:2;">
              ${numeroTicketsHtml}
            </div>
          </div>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:18px;padding:18px;margin-bottom:22px;">
            <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:10px;">CONTACTO</div>
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">
              WhatsApp: <a href="${safeUrl(contactoWhatsApp)}" style="color:#d90429;text-decoration:none;font-weight:700;">Escríbenos aquí</a>
            </p>
            <p style="margin:0;font-size:15px;color:#374151;">
              Instagram: <a href="${safeUrl(contactoInstagram)}" style="color:#d90429;text-decoration:none;font-weight:700;">@samir__rivas</a>
            </p>
          </div>

          ${buttonsHtml}

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
            Gracias por confiar en <strong>Rifas LSD</strong>.<br />
            Este correo fue enviado automáticamente al aprobar tu compra.
          </p>
        </div>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: `✅ Tu compra fue aprobada - ${rifaNombreSafe}`,
    html,
  });

  if (error) {
    throw error;
  }

  return data;
}