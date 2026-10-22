"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminAuthHeaders } from "../../../lib/getAdminAuthHeaders";

/* =========================================================
   HELPERS
========================================================= */

function texto(valor) {
  return String(valor ?? "").trim();
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function obtenerDigitosRifa(rifa) {
  // Primero intenta usar el formato configurado en la rifa.
  const formato = Number(rifa?.formato);

  if (Number.isInteger(formato) && formato > 0) {
    return formato;
  }

  // Si no existe formato, calcula los dígitos usando
  // la cantidad total de números de la rifa.
  const total =
    Number(rifa?.cantidad_numeros) ||
    Number(rifa?.total_numeros) ||
    Number(rifa?.cantidadNumeros) ||
    0;

  if (total > 0) {
    // Ejemplo:
    // 1,000 números: 000-999 = 3 dígitos
    // 10,000 números: 0000-9999 = 4 dígitos
    return Math.max(
      1,
      String(Math.max(0, total - 1)).length
    );
  }

  // Valor seguro si faltara la configuración.
  return 3;
}

function formatearNumeroTicket(valor, digitos = 3) {
  const limpio = String(valor ?? "").trim();

  if (!limpio) return "";

  return limpio.padStart(digitos, "0");
}

function dinero(valor) {
  return numero(valor).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatearFecha(valor) {
  if (!valor) return "—";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }

  return fecha.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizarBusqueda(valor) {
  return texto(valor)
    .toLowerCase()
    .replace(/^@+/, "");
}

function normalizarEstado(valor) {
  return texto(valor).toLowerCase();
}

function obtenerNombre(usuario) {
  return texto(usuario?.nombre) || "Sin nombre";
}

function obtenerInstagram(usuario) {
  const participaciones = Array.isArray(
    usuario?.participaciones_free
  )
    ? usuario.participaciones_free
    : [];

  const encontrado = participaciones.find((item) =>
    texto(item?.social_username)
  );

  return texto(encontrado?.social_username).replace(
    /^@+/,
    ""
  );
}

function obtenerCodigosFree(usuario) {
  const participaciones = Array.isArray(
    usuario?.participaciones_free
  )
    ? usuario.participaciones_free
    : [];

  return participaciones
    .map((item) => texto(item?.codigo_unico))
    .filter(Boolean);
}

function obtenerTodosLosNumeros(usuario) {
  const pagados = Array.isArray(
    usuario?.tickets_pagados
  )
    ? usuario.tickets_pagados
    : [];

  const free = Array.isArray(
    usuario?.tickets_free
  )
    ? usuario.tickets_free
    : [];

  return [...pagados, ...free]
    .map((ticket) => texto(ticket?.numero_ticket))
    .filter(Boolean);
}

function crearContenidoBusqueda(usuario) {
  const instagram = obtenerInstagram(usuario);
  const codigosFree = obtenerCodigosFree(usuario);
  const numeros = obtenerTodosLosNumeros(usuario);

  const compras = Array.isArray(usuario?.compras)
    ? usuario.compras
    : [];

  const referencias = compras.flatMap((compra) => [
    compra?.referencia,
    compra?.id,
  ]);

  return [
    usuario?.nombre,
    usuario?.email,
    usuario?.telefono,
    instagram,
    ...codigosFree,
    ...numeros,
    ...referencias,
  ]
    .map(normalizarBusqueda)
    .filter(Boolean)
    .join(" ");
}

function esCoincidenciaExacta(usuario, termino) {
  const buscado = normalizarBusqueda(termino);

  if (!buscado) return false;

  const valores = [
    usuario?.nombre,
    usuario?.email,
    usuario?.telefono,
    obtenerInstagram(usuario),
    ...obtenerCodigosFree(usuario),
    ...obtenerTodosLosNumeros(usuario),
  ]
    .map(normalizarBusqueda)
    .filter(Boolean);

  return valores.some(
    (valor) => valor === buscado
  );
}

function estadoFreeClase(estado) {
  const valor = normalizarEstado(estado);

  if (
    [
      "activo",
      "activa",
      "valida",
      "válida",
      "approved",
      "aprobado",
      "aprobada",
    ].includes(valor)
  ) {
    return "green";
  }

  if (
    [
      "rechazado",
      "rechazada",
      "rejected",
      "cancelado",
      "cancelada",
      "anulado",
      "anulada",
    ].includes(valor)
  ) {
    return "red";
  }

  return "yellow";
}

/* =========================================================
   BADGE
========================================================= */

function Badge({
  children,
  color = "blue",
  destacado = false,
}) {
  const colores = {
    blue: {
      background: "rgba(59, 130, 246, 0.12)",
      color: "#60a5fa",
      border: "rgba(59, 130, 246, 0.25)",
    },

    green: {
      background: "rgba(16, 185, 129, 0.12)",
      color: "#34d399",
      border: "rgba(16, 185, 129, 0.25)",
    },

    purple: {
      background: "rgba(168, 85, 247, 0.12)",
      color: "#c084fc",
      border: "rgba(168, 85, 247, 0.25)",
    },

    yellow: {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#fbbf24",
      border: "rgba(245, 158, 11, 0.25)",
    },

    gold: {
      background:
        "linear-gradient(135deg, rgba(245,158,11,.24), rgba(234,179,8,.13))",
      color: "#fbbf24",
      border: "rgba(251,191,36,.58)",
      boxShadow:
        "0 0 0 1px rgba(251,191,36,.06), 0 0 18px rgba(245,158,11,.13)",
    },

    red: {
      background: "rgba(239, 68, 68, 0.12)",
      color: "#f87171",
      border: "rgba(239, 68, 68, 0.25)",
    },

    gray: {
      background: "rgba(148, 163, 184, 0.10)",
      color: "#94a3b8",
      border: "rgba(148, 163, 184, 0.20)",
    },
  };

  const estilo =
    colores[color] || colores.blue;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: destacado
          ? "7px 11px"
          : "5px 9px",
        borderRadius: "999px",
        fontSize: destacado ? "12px" : "11px",
        lineHeight: 1,
        fontWeight: 800,
        background: estilo.background,
        color: estilo.color,
        border: `1px solid ${estilo.border}`,
        boxShadow: estilo.boxShadow || "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* =========================================================
   TARJETA RESUMEN
========================================================= */

function ResumenCard({
  icon,
  label,
  value,
  subtitle,
}) {
  return (
    <div
      style={{
        minWidth: 0,
        border:
          "1px solid rgba(148, 163, 184, 0.14)",
        borderRadius: "16px",
        padding: "16px",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          fontSize: "20px",
          marginBottom: "9px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: "11px",
          fontWeight: 800,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: ".02em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "23px",
          fontWeight: 900,
          lineHeight: 1.1,
          color: "inherit",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: "7px",
            fontSize: "11px",
            fontWeight: 600,
            color: "#94a3b8",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   NÚMEROS
========================================================= */

function ListaNumeros({
  tickets = [],
  color = "blue",
  emptyText = "No tiene números asignados.",
  digitos = 3,
}) {
  if (
    !Array.isArray(tickets) ||
    tickets.length === 0
  ) {
    return (
      <div
        className="adminpro-empty-box"
        style={{
          marginTop: "14px",
        }}
      >
        <p>{emptyText}</p>
      </div>
    );
  }

  const ordenados = [...tickets].sort(
    (a, b) =>
      numero(a?.numero_ticket) -
      numero(b?.numero_ticket)
  );

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginTop: "16px",
      }}
    >
      {ordenados.map((ticket, index) => (
        <Badge
          key={
            ticket?.id ||
            `${ticket?.numero_ticket}-${index}`
          }
          color={
            ticket?.es_ganador
              ? "gold"
              : color
          }
          destacado={ticket?.es_ganador}
        >
          {ticket?.es_ganador ? "🏆 " : "#"}
          {formatearNumeroTicket(
            ticket?.numero_ticket,
            digitos
          )}
          {ticket?.es_ganador
            ? " · GANADOR"
            : ""}
        </Badge>
      ))}
    </div>
  );
}

/* =========================================================
   COINCIDENCIA
========================================================= */

function CoincidenciaUsuario({
  usuario,
  onOpen,
  digitos = 3,
}) {
  const resumen = usuario?.resumen || {};
  const instagram = obtenerInstagram(usuario);

  const ticketsPagados = Array.isArray(
    usuario?.tickets_pagados
  )
    ? usuario.tickets_pagados
    : [];

  const ticketsFree = Array.isArray(
    usuario?.tickets_free
  )
    ? usuario.tickets_free
    : [];

  const ticketGanador = [
    ...ticketsPagados,
    ...ticketsFree,
  ].find(
    (ticket) =>
      ticket?.es_ganador === true
  );

  return (
    <button
      type="button"
      onClick={() => onOpen(usuario)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "16px",
        borderRadius: "16px",
        border: ticketGanador
          ? "1px solid rgba(251,191,36,.45)"
          : "1px solid rgba(148,163,184,.14)",
        background: ticketGanador
          ? "linear-gradient(135deg, rgba(245,158,11,.08), rgba(255,255,255,.025))"
          : "rgba(255,255,255,.025)",
        boxShadow: ticketGanador
          ? "0 0 24px rgba(245,158,11,.07)"
          : "none",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      {ticketGanador ? (
        <div
          style={{
            marginBottom: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <Badge
            color="gold"
            destacado
          >
            🏆 GANADOR DE ESTA RIFA
          </Badge>

          <span
            style={{
              color: "#fbbf24",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            #
            {formatearNumeroTicket(
              ticketGanador?.numero_ticket,
              digitos
            )}
          </span>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 900,
              overflowWrap: "anywhere",
              color: ticketGanador
                ? "#f8fafc"
                : "inherit",
            }}
          >
            {ticketGanador ? "🏆" : "👤"}{" "}
            {obtenerNombre(usuario)}
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#94a3b8",
              fontSize: "13px",
              overflowWrap: "anywhere",
            }}
          >
            📧 {usuario?.email || "Sin email"}
          </div>

          <div
            style={{
              marginTop: "4px",
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            📱{" "}
            {usuario?.telefono ||
              "Sin teléfono"}
          </div>

          {instagram ? (
            <div
              style={{
                marginTop: "4px",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              📸 @{instagram}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
          }}
        >
          {usuario?.tiene_compras ? (
            <Badge color="blue">
              💳 Compras
            </Badge>
          ) : null}

          {usuario?.tiene_free ? (
            <Badge color="purple">
              🎁 FREE
            </Badge>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "18px",
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: "14px",
          paddingTop: "13px",
          borderTop:
            "1px solid rgba(148,163,184,.10)",
          fontSize: "12px",
          fontWeight: 700,
          color: "#94a3b8",
        }}
      >
        <span>
          💳 {numero(resumen.compras_total)}{" "}
          compras
        </span>

        <span>
          🎟️{" "}
          {numero(resumen.tickets_pagados)}{" "}
          pagados
        </span>

        <span>
          🎁 {numero(resumen.tickets_free)}{" "}
          FREE
        </span>

        <span>
          💰{" "}
          {dinero(resumen.monto_aprobado)}
        </span>

        <span
          style={{
            marginLeft: "auto",
            color: ticketGanador
              ? "#fbbf24"
              : "#60a5fa",
            fontWeight: 900,
          }}
        >
          Ver usuario →
        </span>
      </div>
    </button>
  );
}

/* =========================================================
   PERFIL SIMPLE DEL USUARIO
========================================================= */

function PerfilUsuario({
  usuario,
  onBack,
  rifaSeleccionada,
}) {
  if (!usuario) return null;

  const digitosRifa =
    obtenerDigitosRifa(rifaSeleccionada);

  const resumen = usuario?.resumen || {};

  const ticketsPagados = Array.isArray(
    usuario?.tickets_pagados
  )
    ? usuario.tickets_pagados
    : [];

  const ticketsFree = Array.isArray(
    usuario?.tickets_free
  )
    ? usuario.tickets_free
    : [];

  const participaciones = Array.isArray(
    usuario?.participaciones_free
  )
    ? [...usuario.participaciones_free]
    : [];

  const instagram =
    obtenerInstagram(usuario);

  const todosLosTickets = [
    ...ticketsPagados,
    ...ticketsFree,
  ];

  const ticketGanador =
    todosLosTickets.find(
      (ticket) =>
        ticket?.es_ganador === true
    ) || null;

  const usuarioEsGanador =
    Boolean(ticketGanador);

  const ganadorEsFree =
    usuarioEsGanador &&
    ticketsFree.some(
      (ticket) =>
        String(ticket?.id || "") ===
        String(ticketGanador?.id || "")
    );

  participaciones.sort((a, b) => {
    return (
      new Date(
        b?.created_at || 0
      ).getTime() -
      new Date(
        a?.created_at || 0
      ).getTime()
    );
  });

  return (
    <div className="adminpro-page-stack">
      {/* GANADOR */}
      {usuarioEsGanador ? (
        <div
          className="adminpro-card"
          style={{
            position: "relative",
            overflow: "hidden",
            border:
              "1px solid rgba(251,191,36,.50)",
            background:
              "linear-gradient(135deg, rgba(245,158,11,.15), rgba(234,179,8,.06), rgba(255,255,255,.02))",
            boxShadow:
              "0 0 35px rgba(245,158,11,.09)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-12px",
              top: "-20px",
              fontSize: "100px",
              opacity: 0.055,
              pointerEvents: "none",
            }}
          >
            🏆
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#fbbf24",
                  fontSize: "12px",
                  fontWeight: 950,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                🏆 GANADOR DE ESTA RIFA
              </div>

              <div
                style={{
                  fontSize:
                    "clamp(22px, 4vw, 32px)",
                  fontWeight: 950,
                  lineHeight: 1.1,
                  color: "#f8fafc",
                }}
              >
                {obtenerNombre(usuario)}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Este usuario tiene el número
                ganador oficial de{" "}
                <strong>
                  {rifaSeleccionada?.nombre ||
                    "esta rifa"}
                </strong>
                .
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "7px",
              }}
            >
              <Badge
                color="gold"
                destacado
              >
                🏆 #
                {formatearNumeroTicket(
                  ticketGanador?.numero_ticket,
                  digitosRifa
                )}{" "}
                · GANADOR
              </Badge>

              <span
                style={{
                  color: "#fbbf24",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                {ganadorEsFree
                  ? "🎁 Ticket FREE"
                  : "🎟️ Ticket pagado"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* PERFIL */}
      <div
        className="adminpro-card"
        style={
          usuarioEsGanador
            ? {
                border:
                  "1px solid rgba(251,191,36,.20)",
              }
            : undefined
        }
      >
        <div className="adminpro-section-head">
          <div>
            <div
              style={{
                color: usuarioEsGanador
                  ? "#fbbf24"
                  : "#8b5cf6",
                fontSize: "11px",
                fontWeight: 900,
                marginBottom: "7px",
              }}
            >
              PERFIL DEL USUARIO
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
                padding: "4px 8px",
                borderRadius: "999px",
                background:
                  "rgba(148, 163, 184, 0.07)",
                border:
                  "1px solid rgba(148, 163, 184, 0.12)",
                color: "#94a3b8",
                fontSize: "10px",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              🎟️{" "}
              {rifaSeleccionada?.nombre ||
                "Rifa seleccionada"}
              <span style={{ opacity: 0.5 }}>
                •
              </span>
              🔢 {digitosRifa} dígitos
            </div>

            <h2
              style={{
                marginBottom: "7px",
              }}
            >
              {usuarioEsGanador
                ? "🏆"
                : "👤"}{" "}
              {obtenerNombre(usuario)}
            </h2>

            <p style={{ margin: 0 }}>
              Resumen de participación en la
              rifa seleccionada.
            </p>
          </div>

          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={onBack}
          >
            ← Nueva búsqueda
          </button>
        </div>

        {usuarioEsGanador ? (
          <div
            style={{
              marginTop: "18px",
              padding: "12px 14px",
              borderRadius: "14px",
              border:
                "1px solid rgba(251,191,36,.28)",
              background:
                "rgba(245,158,11,.08)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <Badge color="gold">
              🏆 GANADOR
            </Badge>

            <span
              style={{
                color: "#f8fafc",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              Número ganador:{" "}
              <span
                style={{
                  color: "#fbbf24",
                  fontWeight: 950,
                }}
              >
                #
                {formatearNumeroTicket(
                  ticketGanador?.numero_ticket,
                  digitosRifa
                )}
              </span>
            </span>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "18px",
            marginTop: "20px",
            paddingTop: "18px",
            borderTop:
              "1px solid rgba(148,163,184,.10)",
          }}
        >
          <div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              👤 NOMBRE
            </div>

            <div
              style={{
                marginTop: "6px",
                fontWeight: 800,
              }}
            >
              {obtenerNombre(usuario)}
            </div>
          </div>

          <div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              📧 EMAIL
            </div>

            <div
              style={{
                marginTop: "6px",
                fontWeight: 800,
                overflowWrap: "anywhere",
              }}
            >
              {usuario?.email || "—"}
            </div>
          </div>

          <div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              📱 TELÉFONO
            </div>

            <div
              style={{
                marginTop: "6px",
                fontWeight: 800,
              }}
            >
              {usuario?.telefono || "—"}
            </div>
          </div>

          <div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              📸 INSTAGRAM
            </div>

            <div
              style={{
                marginTop: "6px",
              }}
            >
              {instagram ? (
                <a
                  href={`https://instagram.com/${encodeURIComponent(
                    instagram
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#60a5fa",
                    fontWeight: 800,
                  }}
                >
                  @{instagram}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RESUMEN */}
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>📊 Resumen del usuario</h2>

            <p>
              Información rápida sin duplicar
              Gestión de Compras.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {usuarioEsGanador ? (
              <Badge color="gold">
                🏆 Ganador
              </Badge>
            ) : null}

            {usuario?.tiene_compras ? (
              <Badge color="blue">
                💳 Compras
              </Badge>
            ) : null}

            {usuario?.tiene_free ? (
              <Badge color="purple">
                🎁 FREE
              </Badge>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          <ResumenCard
            icon="💰"
            label="Total aprobado"
            value={dinero(
              resumen.monto_aprobado
            )}
            subtitle="Solo compras aprobadas"
          />

          <ResumenCard
            icon="💳"
            label="Compras"
            value={numero(
              resumen.compras_total
            )}
            subtitle={`${numero(
              resumen.compras_aprobadas
            )} aprobadas`}
          />

          <ResumenCard
            icon="🎟️"
            label="Tickets pagados"
            value={numero(
              resumen.tickets_pagados
            )}
          />

          <ResumenCard
            icon="🎁"
            label="Tickets FREE"
            value={numero(
              resumen.tickets_free
            )}
          />

          <ResumenCard
            icon={
              usuarioEsGanador ? "🏆" : "🏷️"
            }
            label={
              usuarioEsGanador
                ? "Ticket ganador"
                : "Total tickets"
            }
            value={
              usuarioEsGanador
                ? `#${formatearNumeroTicket(
                    ticketGanador?.numero_ticket,
                    digitosRifa
                  )}`
                : numero(
                    resumen.tickets_total
                  )
            }
            subtitle={
              usuarioEsGanador
                ? "Ganador oficial de esta rifa"
                : undefined
            }
          />
        </div>
      </div>

      {/* NÚMEROS PAGADOS */}
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>🎟️ Números pagados</h2>

            <p>
              Todos los números que este usuario
              tiene por compras aprobadas.
            </p>
          </div>

          <div className="adminpro-badge-box">
            {ticketsPagados.length} número
            {ticketsPagados.length !== 1
              ? "s"
              : ""}
          </div>
        </div>

        <ListaNumeros
          tickets={ticketsPagados}
          color="blue"
          digitos={digitosRifa}
          emptyText="Este usuario no tiene números pagados asignados."
        />
      </div>

      {/* FREE DROP */}
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>🎁 Free Drop</h2>

            <p>
              Participaciones gratuitas de este
              usuario.
            </p>
          </div>

          <div className="adminpro-badge-box">
            {participaciones.length} participación
            {participaciones.length !== 1
              ? "es"
              : ""}
          </div>
        </div>

        {participaciones.length === 0 ? (
          <div
            className="adminpro-empty-box"
            style={{
              marginTop: "16px",
            }}
          >
            <p>
              Este usuario no tiene
              participaciones FREE en esta rifa.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "12px",
              marginTop: "18px",
            }}
          >
            {participaciones.map(
              (participacion) => {
                const social = texto(
                  participacion?.social_username
                ).replace(/^@+/, "");

                const numerosParticipacion =
                  ticketsFree.filter(
                    (ticket) =>
                      String(
                        ticket?.free_drop_participation_id ||
                          ""
                      ) ===
                      String(
                        participacion?.id ||
                          ""
                      )
                  );

                const tieneGanador =
                  numerosParticipacion.some(
                    (ticket) =>
                      ticket?.es_ganador ===
                      true
                  );

                return (
                  <div
                    key={participacion?.id}
                    style={{
                      border: tieneGanador
                        ? "1px solid rgba(251,191,36,.38)"
                        : "1px solid rgba(148,163,184,.14)",
                      background: tieneGanador
                        ? "linear-gradient(135deg, rgba(245,158,11,.08), rgba(255,255,255,.025))"
                        : "rgba(255,255,255,.025)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    {tieneGanador ? (
                      <div
                        style={{
                          marginBottom:
                            "13px",
                        }}
                      >
                        <Badge color="gold">
                          🏆 FREE GANADOR
                        </Badge>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: "15px",
                          }}
                        >
                          🎁{" "}
                          {participacion?.codigo_unico ||
                            "Participación FREE"}
                        </div>

                        <div
                          style={{
                            marginTop: "6px",
                            color: "#94a3b8",
                            fontSize: "12px",
                          }}
                        >
                          📅{" "}
                          {formatearFecha(
                            participacion?.created_at
                          )}
                        </div>
                      </div>

                      <Badge
                        color={estadoFreeClase(
                          participacion?.estado
                        )}
                      >
                        {participacion?.estado ||
                          "Sin estado"}
                      </Badge>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "14px",
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop:
                          "1px solid rgba(148,163,184,.10)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "11px",
                            fontWeight: 800,
                          }}
                        >
                          CÓDIGO FREE
                        </div>

                        <div
                          style={{
                            marginTop: "5px",
                            fontWeight: 900,
                            overflowWrap:
                              "anywhere",
                          }}
                        >
                          {participacion?.codigo_unico ||
                            "—"}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "11px",
                            fontWeight: 800,
                          }}
                        >
                          INSTAGRAM
                        </div>

                        <div
                          style={{
                            marginTop: "5px",
                          }}
                        >
                          {social ? (
                            <a
                              href={`https://instagram.com/${encodeURIComponent(
                                social
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color:
                                  "#60a5fa",
                                fontWeight:
                                  800,
                              }}
                            >
                              @{social}
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "11px",
                            fontWeight: 800,
                          }}
                        >
                          NÚMERO FREE
                        </div>

                        <div
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          {numerosParticipacion.length >
                          0 ? (
                            numerosParticipacion.map(
                              (
                                ticket,
                                index
                              ) => (
                                <Badge
                                  key={
                                    ticket?.id ||
                                    `${ticket?.numero_ticket}-${index}`
                                  }
                                  color={
                                    ticket?.es_ganador
                                      ? "gold"
                                      : "purple"
                                  }
                                  destacado={
                                    ticket?.es_ganador
                                  }
                                >
                                  {ticket?.es_ganador
                                    ? "🏆 "
                                    : "#"}
                                  {formatearNumeroTicket(
                                    ticket?.numero_ticket,
                                    digitosRifa
                                  )}
                                  {ticket?.es_ganador
                                    ? " · GANADOR"
                                    : ""}
                                </Badge>
                              )
                            )
                          ) : (
                            <span
                              style={{
                                color:
                                  "#94a3b8",
                              }}
                            >
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN USUARIOS
========================================================= */

export default function AdminUsuariosSection({
  rifaSeleccionada,
}) {
  const [usuarios, setUsuarios] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    busquedaInput,
    setBusquedaInput,
  ] = useState("");

  const [
    busquedaEjecutada,
    setBusquedaEjecutada,
  ] = useState("");

  const [
    usuarioSeleccionado,
    setUsuarioSeleccionado,
  ] = useState(null);

  const rifaId =
    rifaSeleccionada?.id || "";

  const digitosRifa =
    obtenerDigitosRifa(rifaSeleccionada);

  /* =======================================================
     CARGAR USUARIOS
  ======================================================= */

  const cargarUsuarios =
    useCallback(async () => {
      if (!rifaId) {
        setUsuarios([]);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const headers =
          await getAdminAuthHeaders();

        const response = await fetch(
          `/api/admin-usuarios?rifaId=${encodeURIComponent(
            rifaId
          )}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "No se pudieron cargar los usuarios"
          );
        }

        setUsuarios(
          Array.isArray(data?.usuarios)
            ? data.usuarios
            : []
        );
      } catch (err) {
        console.error(
          "Error cargando usuarios:",
          err
        );

        setUsuarios([]);

        setError(
          err?.message ||
            "No se pudieron cargar los usuarios"
        );
      } finally {
        setLoading(false);
      }
    }, [rifaId]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  useEffect(() => {
    setBusquedaInput("");
    setBusquedaEjecutada("");
    setUsuarioSeleccionado(null);
    setError("");
  }, [rifaId]);

  /* =======================================================
     RESULTADOS
  ======================================================= */

  const resultados = useMemo(() => {
    const termino =
      normalizarBusqueda(
        busquedaEjecutada
      );

    if (!termino) return [];

    const encontrados =
      usuarios.filter((usuario) =>
        crearContenidoBusqueda(
          usuario
        ).includes(termino)
      );

    return encontrados.sort((a, b) => {
      const exactoA =
        esCoincidenciaExacta(
          a,
          termino
        );

      const exactoB =
        esCoincidenciaExacta(
          b,
          termino
        );

      if (exactoA && !exactoB)
        return -1;

      if (!exactoA && exactoB)
        return 1;

      const ganadorA = [
        ...(Array.isArray(
          a?.tickets_pagados
        )
          ? a.tickets_pagados
          : []),
        ...(Array.isArray(
          a?.tickets_free
        )
          ? a.tickets_free
          : []),
      ].some(
        (ticket) =>
          ticket?.es_ganador === true
      );

      const ganadorB = [
        ...(Array.isArray(
          b?.tickets_pagados
        )
          ? b.tickets_pagados
          : []),
        ...(Array.isArray(
          b?.tickets_free
        )
          ? b.tickets_free
          : []),
      ].some(
        (ticket) =>
          ticket?.es_ganador === true
      );

      if (ganadorA && !ganadorB)
        return -1;

      if (!ganadorA && ganadorB)
        return 1;

      const fechaA = new Date(
        a?.ultima_actividad?.fecha || 0
      ).getTime();

      const fechaB = new Date(
        b?.ultima_actividad?.fecha || 0
      ).getTime();

      return fechaB - fechaA;
    });
  }, [
    usuarios,
    busquedaEjecutada,
  ]);

  /* =======================================================
     BUSCAR
  ======================================================= */

  function buscar(event) {
    event?.preventDefault?.();

    const valor =
      texto(busquedaInput);

    setError("");
    setUsuarioSeleccionado(null);

    if (!valor) {
      setBusquedaEjecutada("");
      return;
    }

    setBusquedaEjecutada(valor);
  }

  function nuevaBusqueda() {
    setBusquedaInput("");
    setBusquedaEjecutada("");
    setUsuarioSeleccionado(null);
    setError("");
  }

  /* =======================================================
     ABRIR AUTOMÁTICAMENTE SI SOLO HAY UNO
  ======================================================= */

  useEffect(() => {
    if (!busquedaEjecutada)
      return;

    if (resultados.length === 1) {
      setUsuarioSeleccionado(
        resultados[0]
      );
      return;
    }

    const exactos =
      resultados.filter(
        (usuario) =>
          esCoincidenciaExacta(
            usuario,
            busquedaEjecutada
          )
      );

    if (exactos.length === 1) {
      setUsuarioSeleccionado(
        exactos[0]
      );
    }
  }, [
    resultados,
    busquedaEjecutada,
  ]);

  /* =======================================================
     SIN RIFA
  ======================================================= */

  if (!rifaSeleccionada) {
    return (
      <div className="adminpro-page-stack">
        <div className="adminpro-card">
          <div className="adminpro-empty-box">
            <p>
              Selecciona una rifa para
              buscar usuarios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     PERFIL
  ======================================================= */

  if (usuarioSeleccionado) {
    return (
      <PerfilUsuario
        usuario={
          usuarioSeleccionado
        }
        onBack={nuevaBusqueda}
        rifaSeleccionada={
          rifaSeleccionada
        }
      />
    );
  }

  /* =======================================================
     BUSCADOR
  ======================================================= */

  return (
    <div className="adminpro-page-stack">
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>👤 Usuarios</h2>

            <p>
              Busca un usuario y consulta
              sus números, compras y
              participación FREE en{" "}
              <strong>
                {rifaSeleccionada?.nombre ||
                  "la rifa seleccionada"}
              </strong>
              .
            </p>
          </div>

          <button
            type="button"
            className="adminpro-soft-btn blue"
            onClick={cargarUsuarios}
            disabled={loading}
          >
            {loading
              ? "Actualizando..."
              : "↻ Actualizar"}
          </button>
        </div>

        <form
          onSubmit={buscar}
          style={{
            marginTop: "22px",
          }}
        >
          <label
            htmlFor="usuarios-search"
            style={{
              display: "block",
              marginBottom: "7px",
              fontSize: "11px",
              fontWeight: 900,
              color: "#94a3b8",
            }}
          >
            BUSCAR USUARIO
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: "1 1 420px",
                minWidth: 0,
                position: "relative",
              }}
            >
              <span
                style={{
                  position:
                    "absolute",
                  left: "15px",
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  pointerEvents:
                    "none",
                }}
              >
                🔎
              </span>

              <input
                id="usuarios-search"
                type="search"
                className="adminpro-input"
                value={busquedaInput}
                onChange={(event) =>
                  setBusquedaInput(
                    event.target.value
                  )
                }
                placeholder="Nombre, Gmail, teléfono, @Instagram, ticket o código FREE..."
                autoComplete="off"
                style={{
                  width: "100%",
                  minHeight: "48px",
                  paddingLeft: "44px",
                }}
              />
            </div>

            <button
              type="submit"
              className="adminpro-soft-btn blue"
              disabled={
                loading ||
                !texto(
                  busquedaInput
                )
              }
              style={{
                minHeight: "48px",
                paddingLeft: "22px",
                paddingRight: "22px",
              }}
            >
              🔎 Buscar
            </button>

            {busquedaEjecutada ? (
              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={
                  nuevaBusqueda
                }
                style={{
                  minHeight: "48px",
                }}
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div
            style={{
              marginTop: "10px",
              color: "#94a3b8",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Puedes buscar por nombre,
            correo, teléfono, Instagram,
            número de ticket, código FREE
            o referencia.
          </div>
        </form>

        {error ? (
          <div
            style={{
              marginTop: "16px",
              padding: "13px",
              borderRadius: "12px",
              background:
                "rgba(239,68,68,.08)",
              border:
                "1px solid rgba(239,68,68,.20)",
              color: "#f87171",
              fontWeight: 700,
            }}
          >
            ⚠️ {error}
          </div>
        ) : null}
      </div>

      {/* INICIO */}
      {!busquedaEjecutada ? (
        <div className="adminpro-card">
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              maxWidth: "650px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                fontSize: "38px",
                marginBottom: "12px",
              }}
            >
              🔎
            </div>

            <h3
              style={{
                margin: 0,
              }}
            >
              Busca un usuario
            </h3>

            <p
              style={{
                margin:
                  "9px auto 0",
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              Encuentra rápidamente
              toda la información
              importante de una persona
              sin tener que revisar
              compra por compra.
            </p>
          </div>
        </div>
      ) : null}

      {/* CARGANDO */}
      {loading &&
      busquedaEjecutada ? (
        <div className="adminpro-card">
          <div className="adminpro-empty-box">
            <p>
              ⏳ Buscando usuario...
            </p>
          </div>
        </div>
      ) : null}

      {/* NO ENCONTRADO */}
      {!loading &&
      busquedaEjecutada &&
      resultados.length === 0 ? (
        <div className="adminpro-card">
          <div className="adminpro-empty-box">
            <p>
              🔍 No encontramos
              resultados para{" "}
              <strong>
                “{busquedaEjecutada}”
              </strong>
              .
            </p>
          </div>
        </div>
      ) : null}

      {/* RESULTADOS */}
      {!loading &&
      busquedaEjecutada &&
      resultados.length > 0 ? (
        <div className="adminpro-card">
          <div className="adminpro-section-head">
            <div>
              <h2>
                🔎 Coincidencias
              </h2>

              <p>
                Selecciona el usuario
                que quieres consultar.
              </p>
            </div>

            <div className="adminpro-badge-box">
              {resultados.length}{" "}
              resultado
              {resultados.length !== 1
                ? "s"
                : ""}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px",
              marginTop: "18px",
            }}
          >
            {resultados.map(
              (usuario) => (
                <CoincidenciaUsuario
                  key={usuario?.id}
                  usuario={usuario}
                  onOpen={
                    setUsuarioSeleccionado
                  }
                  digitos={
                    digitosRifa
                  }
                />
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}