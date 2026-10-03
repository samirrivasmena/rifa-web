import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendMisTicketsCodeEmail({
  to,
  codigo,
}) {
  if (!to) {
    throw new Error(
      "Falta el correo del destinatario"
    );
  }

  if (!codigo) {
    throw new Error(
      "Falta el código de verificación"
    );
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

  const codigoSafe =
    escapeHtml(codigo);

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
          max-width:620px;
          margin:0 auto;
          background:#ffffff;
          border-radius:24px;
          overflow:hidden;
          box-shadow:0 18px 40px rgba(0,0,0,.12);
        "
      >

        <div
          style="
            background:
              linear-gradient(
                180deg,
                #ff4d4d 0%,
                #d90429 55%,
                #8b0000 100%
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
            Verificación de Mis Tickets
          </div>
        </div>

        <div
          style="
            padding:32px 24px;
            color:#111827;
            text-align:center;
          "
        >

          <h2
            style="
              margin:0 0 12px;
              font-size:25px;
              color:#111827;
            "
          >
            🔐 Código de verificación
          </h2>

          <p
            style="
              margin:0 auto 24px;
              max-width:460px;
              font-size:16px;
              line-height:1.7;
              color:#4b5563;
            "
          >
            Recibimos una solicitud para consultar
            tus tickets y participaciones en
            <strong>SORTEOS LSD</strong>.
          </p>

          <div
            style="
              margin:24px auto;
              max-width:360px;
              padding:24px 16px;
              background:#fff5f5;
              border:2px solid #fecaca;
              border-radius:18px;
            "
          >
            <div
              style="
                margin-bottom:10px;
                font-size:12px;
                font-weight:800;
                color:#991b1b;
                letter-spacing:1px;
              "
            >
              TU CÓDIGO
            </div>

            <div
              style="
                font-size:42px;
                line-height:1;
                font-weight:900;
                color:#d90429;
                letter-spacing:8px;
              "
            >
              ${codigoSafe}
            </div>
          </div>

          <p
            style="
              margin:20px 0 0;
              font-size:15px;
              line-height:1.7;
              color:#374151;
            "
          >
            Ingresa este código en
            <strong>Mis Tickets</strong>
            para continuar.
          </p>

          <div
            style="
              margin-top:24px;
              padding:16px;
              background:#f9fafb;
              border:1px solid #e5e7eb;
              border-radius:14px;
              text-align:left;
            "
          >
            <div
              style="
                font-size:14px;
                line-height:1.7;
                color:#4b5563;
              "
            >
              ⏱️ Este código vence en
              <strong>10 minutos</strong>.
              <br />

              🔒 Solo puede utilizarse una vez.
              <br />

              🚫 No compartas este código con
              ninguna persona.
            </div>
          </div>

          <p
            style="
              margin:24px 0 0;
              font-size:13px;
              line-height:1.6;
              color:#6b7280;
            "
          >
            Si tú no solicitaste consultar
            estos tickets, puedes ignorar
            este correo.
          </p>

        </div>

      </div>
    </div>
  `;

  const text = `
SORTEOS LSD

Tu código para verificar Mis Tickets es:

${codigo}

Este código vence en 10 minutos y solo puede utilizarse una vez.

Si tú no solicitaste este código, puedes ignorar este correo.
  `.trim();

  const { data, error } =
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject:
        "🔐 Tu código para ver Mis Tickets - SORTEOS LSD",
      html,
      text,
    });

  if (error) {
    console.error(
      "Error enviando código Mis Tickets:",
      error
    );

    throw new Error(
      error?.message ||
        "No se pudo enviar el código"
    );
  }

  return data;
}