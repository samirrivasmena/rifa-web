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

export async function sendAdminSecurityCodeEmail({
  to,
  codigo,
  accion,
}) {
  if (!to) {
    throw new Error(
      "Falta el correo del administrador"
    );
  }

  if (!codigo) {
    throw new Error(
      "Falta el código de seguridad"
    );
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "Falta RESEND_API_KEY"
    );
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error(
      "Falta EMAIL_FROM"
    );
  }

  const codigoSafe = escapeHtml(codigo);

  const accionTexto =
    accion === "cambiar_email"
      ? "cambiar el correo administrativo"
      : "cambiar la contraseña administrativa";

  const html = `
    <!doctype html>

    <html>
      <head>
        <meta charset="utf-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <title>
          Código de seguridad
        </title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background:#f3f4f6;
          font-family:Arial,Helvetica,sans-serif;
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
          "
        >
          <tr>
            <td
              align="center"
              style="
                padding:35px 14px;
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
                  max-width:560px;
                  background:#ffffff;
                  border-radius:20px;
                  overflow:hidden;
                "
              >
                <tr>
                  <td
                    align="center"
                    style="
                      padding:25px 20px;
                      background:#111827;
                    "
                  >
                    <div
                      style="
                        color:#ffffff;
                        font-size:25px;
                        font-weight:900;
                        letter-spacing:1px;
                      "
                    >
                      SORTEOS LSD
                    </div>

                    <div
                      style="
                        margin-top:7px;
                        color:#c4b5fd;
                        font-size:11px;
                        font-weight:800;
                      "
                    >
                      SEGURIDAD ADMINISTRATIVA
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    align="center"
                    style="
                      padding:30px 25px;
                    "
                  >
                    <div
                      style="
                        font-size:38px;
                      "
                    >
                      🔐
                    </div>

                    <h1
                      style="
                        margin:12px 0 7px;
                        color:#111827;
                        font-size:22px;
                      "
                    >
                      Código de seguridad
                    </h1>

                    <p
                      style="
                        margin:0;
                        color:#6b7280;
                        font-size:14px;
                        line-height:1.6;
                      "
                    >
                      Se solicitó autorización para
                      <strong>
                        ${accionTexto}
                      </strong>.
                    </p>

                    <div
                      style="
                        margin:25px auto;
                        padding:18px 20px;
                        max-width:300px;
                        border-radius:15px;
                        background:#f5f3ff;
                        border:1px solid #ddd6fe;
                      "
                    >
                      <div
                        style="
                          color:#6b7280;
                          font-size:10px;
                          font-weight:900;
                          letter-spacing:1px;
                        "
                      >
                        TU CÓDIGO
                      </div>

                      <div
                        style="
                          margin-top:8px;
                          color:#111827;
                          font-size:34px;
                          font-weight:900;
                          letter-spacing:8px;
                        "
                      >
                        ${codigoSafe}
                      </div>
                    </div>

                    <div
                      style="
                        padding:14px;
                        border-radius:12px;
                        background:#fffbeb;
                        border:1px solid #fde68a;
                        color:#92400e;
                        font-size:12px;
                        line-height:1.6;
                        text-align:left;
                      "
                    >
                      ⏱️ Este código expira en
                      <strong>10 minutos</strong>.

                      <br/><br/>

                      Nunca compartas este código con
                      otra persona.
                    </div>

                    <div
                      style="
                        margin-top:14px;
                        padding:14px;
                        border-radius:12px;
                        background:#fef2f2;
                        border:1px solid #fecaca;
                        color:#991b1b;
                        font-size:12px;
                        line-height:1.6;
                        text-align:left;
                      "
                    >
                      ⚠️ Si tú no solicitaste este
                      cambio, no uses el código y revisa
                      inmediatamente la seguridad de tu
                      cuenta.
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    align="center"
                    style="
                      padding:20px;
                      background:#f9fafb;
                      color:#9ca3af;
                      font-size:10px;
                      line-height:1.5;
                    "
                  >
                    Mensaje automático de seguridad
                    de SORTEOS LSD.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const { data, error } =
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject:
        "🔐 Código de seguridad | SORTEOS LSD",
      html,
    });

  if (error) {
    throw error;
  }

  return data;
}