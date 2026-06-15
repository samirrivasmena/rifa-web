"use client";

import Swal from "sweetalert2";
import WinnerCard from "../WinnerCard";
import { getAdminAuthHeaders } from "../../../lib/getAdminAuthHeaders";

export default function AdminGanadorSection({
  ganadorRef,
  padLength,
  numeroGanador,
  setNumeroGanador,
  setResultadoGanador,
  setMensajeBusqueda,
  setEsNumeroGanador,
  buscarGanador,
  resultadoGanador,
  esNumeroGanador,
  mensajeBusqueda,
  guardarGanadorOficial,
  quitarGanadorOficial,
  guardandoGanador,
  quitandoGanador,
  numeroGanadorOficial,
  formatearFecha,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    buscarGanador();
  };

  const editarGanadorOficial = async () => {
    const sorteoId =
      resultadoGanador?.sorteo?.id ||
      resultadoGanador?.id ||
      resultadoGanador?.sorteo_id ||
      null;

    if (!sorteoId) {
      await Swal.fire({
        icon: "warning",
        title: "No se encontró el sorteo",
        text: "Primero busca o recarga el ganador oficial para poder editarlo.",
      });
      return;
    }

    const numeroActual =
      numeroGanadorOficial ||
      resultadoGanador?.numero_ganador ||
      resultadoGanador?.numero_ticket ||
      "";

    const { value: formValues } = await Swal.fire({
      title: "Editar ganador oficial",
      html: `
        <div style="display:grid; gap:14px; text-align:left;">
          <label style="font-weight:700;">Número ganador</label>
          <input 
            id="swal-numero-ganador" 
            class="swal2-input" 
            value="${String(numeroActual).replace(/\D/g, "").padStart(padLength, "0")}" 
            maxlength="${padLength}" 
            inputmode="numeric"
            style="margin:0; width:100%;"
          />

          <label style="font-weight:700;">Fuente / descripción corta</label>
          <input 
            id="swal-fuente-ganador" 
            class="swal2-input" 
            value="${resultadoGanador?.sorteo?.fuente || "Rifa"}" 
            style="margin:0; width:100%;"
          />

          <label style="font-weight:700;">Fecha resultado</label>
          <input 
            id="swal-fecha-ganador" 
            type="datetime-local"
            class="swal2-input" 
            style="margin:0; width:100%;"
          />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#6b7280",
      preConfirm: () => {
        const numero = document
          .getElementById("swal-numero-ganador")
          ?.value?.replace(/\D/g, "")
          ?.slice(0, padLength);

        const fuente = document
          .getElementById("swal-fuente-ganador")
          ?.value?.trim();

        const fecha = document.getElementById("swal-fecha-ganador")?.value;

        if (!numero) {
          Swal.showValidationMessage("Debes ingresar un número ganador");
          return false;
        }

        return {
          numero_ganador: numero,
          fuente: fuente || "Rifa",
          fecha_sorteo: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
        };
      },
    });

    if (!formValues) return;

    try {
      const res = await fetch("/api/editar-ganador", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
...(await getAdminAuthHeaders()),
        },
        body: JSON.stringify({
          sorteoId,
          padLength,
          ...formValues,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo editar el ganador",
        });
        return;
      }

      setNumeroGanador(String(data.numero_ganador).padStart(padLength, "0"));
      setMensajeBusqueda(`🏆 Ganador actualizado: ${data.numero_oficial}`);
      setEsNumeroGanador(true);

      await Swal.fire({
        icon: "success",
        title: "Ganador actualizado",
        text: `Número ganador: ${data.numero_oficial}`,
      });
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo editar el ganador",
      });
    }
  };

  return (
    <div className="adminpro-page-stack" ref={ganadorRef}>
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>Validar número por rifa</h2>
            <p>
              Consulta si un número fue vendido y luego regístralo como ganador
              oficial
            </p>
          </div>
        </div>

        {numeroGanadorOficial && (
          <div className="adminpro-winner-current-note">
            <strong>Ganador oficial actual:</strong> {numeroGanadorOficial}

            <button
              type="button"
              className="adminpro-soft-btn blue"
              style={{ marginLeft: "12px" }}
              onClick={editarGanadorOficial}
              disabled={guardandoGanador || quitandoGanador}
            >
              Editar ganador
            </button>
          </div>
        )}

        <form className="adminpro-search-row" onSubmit={handleSubmit}>
          <div className="adminpro-search-input">
            <input
              type="text"
              placeholder={padLength === 3 ? "000 - 999" : "0000 - 9999"}
              value={numeroGanador}
              maxLength={padLength}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, padLength);
                setNumeroGanador(value);
                setResultadoGanador(null);
                setMensajeBusqueda("");
                setEsNumeroGanador(false);
              }}
              disabled={guardandoGanador || quitandoGanador}
            />
          </div>

          <button
            className="adminpro-primary-btn"
            type="submit"
            disabled={guardandoGanador || quitandoGanador || !numeroGanador}
          >
            Buscar
          </button>
        </form>

        <WinnerCard
          resultado={resultadoGanador}
          esGanador={esNumeroGanador}
          mensaje={mensajeBusqueda}
          onGuardar={guardarGanadorOficial}
          onQuitar={quitarGanadorOficial}
          guardando={guardandoGanador}
          quitando={quitandoGanador}
          padLength={padLength}
          formatearFecha={formatearFecha}
          numeroGanadorOficial={numeroGanadorOficial}
        />
      </div>
    </div>
  );
}