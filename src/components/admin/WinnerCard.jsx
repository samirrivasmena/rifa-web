"use client";

export default function WinnerCard({
  resultado,
  esGanador,
  mensaje,
  onGuardar,
  guardando,
  padLength,
  formatearFecha,
}) {
  if (!resultado) {
    return mensaje ? <p className="adminpro-message-error">{mensaje}</p> : null;
  }

  const numeroSeguro =
    resultado?.numero_ticket !== undefined &&
    resultado?.numero_ticket !== null &&
    resultado?.numero_ticket !== ""
      ? Number(resultado.numero_ticket)
      : null;

  const numeroFormateado =
    numeroSeguro !== null && !Number.isNaN(numeroSeguro)
      ? String(numeroSeguro).padStart(padLength, "0")
      : "Sin número";

  const tieneSorteoValido =
    resultado?.sorteo &&
    (
      resultado?.sorteo?.id ||
      resultado?.sorteo?.numero_ganador !== undefined &&
      resultado?.sorteo?.numero_ganador !== null &&
      resultado?.sorteo?.numero_ganador !== ""
    );

  const ganadorOficial = Boolean(esGanador || tieneSorteoValido);

  return (
    <>
      {mensaje && (
        <p
          className={
            ganadorOficial
              ? "adminpro-message-warn"
              : resultado.existe
              ? "adminpro-message-success"
              : "adminpro-message-error"
          }
        >
          {mensaje}
        </p>
      )}

      <div
        className="adminpro-card"
        style={{
          background: ganadorOficial
            ? "#fff7ed"
            : resultado.existe
            ? "#ecfdf5"
            : "#fef2f2",
          border: ganadorOficial
            ? "1px solid #fdba74"
            : resultado.existe
            ? "1px solid #bbf7d0"
            : "1px solid #fecaca",
        }}
      >
        {ganadorOficial ? (
          <>
            <h3 style={{ color: "#b45309", marginBottom: "14px" }}>
              🏆 Número ganador oficial
            </h3>

            <p style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>
              Número ganador: {numeroFormateado}
            </p>

            <p><strong>Estado:</strong> Ganador oficial</p>

            {resultado?.compra_id && (
              <p><strong>Compra ID:</strong> {resultado.compra_id}</p>
            )}

            {resultado?.sorteo?.fecha_sorteo && (
              <p>
                <strong>Fecha sorteo:</strong>{" "}
                {formatearFecha?.(resultado.sorteo.fecha_sorteo) ||
                  resultado.sorteo.fecha_sorteo}
              </p>
            )}

            {resultado?.sorteo?.fuente && (
              <p><strong>Fuente:</strong> {resultado.sorteo.fuente}</p>
            )}

            {resultado.usuario ? (
              <>
                <p><strong>Nombre:</strong> {resultado.usuario.nombre || "Sin nombre"}</p>
                <p><strong>Email:</strong> {resultado.usuario.email || "Sin email"}</p>
                <p><strong>Teléfono:</strong> {resultado.usuario.telefono || "Sin teléfono"}</p>
              </>
            ) : (
              <p>No se encontraron los datos del usuario.</p>
            )}
          </>
        ) : resultado.existe ? (
          <>
            <h3 style={{ color: "#166534", marginBottom: "14px" }}>
              ✅ Número vendido
            </h3>

            <p style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>
              Número consultado: {numeroFormateado}
            </p>

            <p><strong>Estado:</strong> Vendido</p>

            {resultado?.compra_id && (
              <p><strong>Compra ID:</strong> {resultado.compra_id}</p>
            )}

            {resultado.usuario ? (
              <>
                <p><strong>Nombre:</strong> {resultado.usuario.nombre || "Sin nombre"}</p>
                <p><strong>Email:</strong> {resultado.usuario.email || "Sin email"}</p>
                <p><strong>Teléfono:</strong> {resultado.usuario.telefono || "Sin teléfono"}</p>
              </>
            ) : (
              <p>No se encontraron los datos del usuario.</p>
            )}

            <button
              className="adminpro-primary-btn"
              onClick={onGuardar}
              disabled={guardando}
              type="button"
              style={{ marginTop: "18px" }}
            >
              {guardando ? "Registrando..." : "Registrar ganador oficial"}
            </button>
          </>
        ) : (
          <>
            <h3 style={{ color: "#991b1b", marginBottom: "14px" }}>
              ❌ Número no vendido
            </h3>

            <p style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>
              Número consultado: {numeroFormateado}
            </p>

            <p><strong>Estado:</strong> No vendido</p>
          </>
        )}
      </div>
    </>
  );
}