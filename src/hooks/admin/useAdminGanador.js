"use client";

import { useCallback, useState } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "../../lib/getAdminAuthHeaders";

export function useAdminGanador({
  rifaSeleccionada,
  padLength,
  recargarTodo,
}) {
  const [numeroGanador, setNumeroGanador] = useState("");
  const [resultadoGanador, setResultadoGanador] = useState(null);
  const [mensajeBusqueda, setMensajeBusqueda] = useState("");
  const [esNumeroGanador, setEsNumeroGanador] = useState(false);
  const [guardandoGanador, setGuardandoGanador] = useState(false);

  const buscarGanador = useCallback(async () => {
    setResultadoGanador(null);
    setMensajeBusqueda("");
    setEsNumeroGanador(false);

    if (!rifaSeleccionada?.id) {
      setMensajeBusqueda("⚠️ Debes seleccionar una rifa");
      return;
    }

    const limpio = numeroGanador.replace(/\D/g, "").slice(0, padLength);

    if (!limpio) {
      setMensajeBusqueda("⚠️ Debes ingresar un número válido");
      return;
    }

    const numero = Number(limpio);

    if (Number.isNaN(numero)) {
      setMensajeBusqueda("⚠️ Debes ingresar un número válido");
      return;
    }

    try {
      const res = await fetch("/api/verificar-ganador", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
        body: JSON.stringify({
          rifaId: rifaSeleccionada.id,
          numero,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error verificar ganador:", data.error);
        setMensajeBusqueda("❌ Error al buscar el número");
        return;
      }

      setResultadoGanador({
        existe: data.existe,
        numero_ticket: data.numero_ticket,
        compra_id: data.compra_id,
        usuario: data.usuario,
        sorteo: data.sorteo,
      });

      setEsNumeroGanador(Boolean(data.esGanador));

      if (!data.existe) {
        setMensajeBusqueda(
          `❌ El número ${String(numero).padStart(padLength, "0")} no fue vendido en esta rifa`
        );
        return;
      }

      if (data.esGanador) {
        setMensajeBusqueda(
          `🏆 El número ${String(numero).padStart(padLength, "0")} es el ganador oficial de esta rifa`
        );
      } else {
        setMensajeBusqueda(
          `✅ El número ${String(numero).padStart(padLength, "0")} sí fue vendido en esta rifa`
        );
      }
    } catch (error) {
      console.error("Error buscando ganador:", error);
      setMensajeBusqueda("❌ Error inesperado al buscar el número");
    }
  }, [rifaSeleccionada, numeroGanador, padLength]);

  const guardarGanadorOficial = useCallback(async () => {
    if (!rifaSeleccionada?.id) {
      await Swal.fire({
        icon: "error",
        title: "No permitido",
        text: "Debes seleccionar una rifa válida",
      });
      return;
    }

    if (!resultadoGanador?.existe) {
      await Swal.fire({
        icon: "error",
        title: "No permitido",
        text: "Ese número no fue vendido, no se puede registrar como ganador",
      });
      return;
    }

    const confirmar = await Swal.fire({
      title: "¿Registrar ganador oficial?",
      text: `Se registrará el número ${String(resultadoGanador.numero_ticket).padStart(
        padLength,
        "0"
      )} como ganador oficial de esta rifa.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, registrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setGuardandoGanador(true);

      const res = await fetch("/api/guardar-ganador", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
        body: JSON.stringify({
          numero_ticket: resultadoGanador.numero_ticket,
          rifaId: rifaSeleccionada.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al registrar el ganador oficial",
        });
        return;
      }

      await recargarTodo();
      await buscarGanador();

      await Swal.fire({
        icon: "success",
        title: "Ganador registrado",
        text: `El número ${String(resultadoGanador.numero_ticket).padStart(
          padLength,
          "0"
        )} fue registrado como ganador oficial`,
      });
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al registrar el ganador oficial",
      });
    } finally {
      setGuardandoGanador(false);
    }
  }, [rifaSeleccionada, resultadoGanador, padLength, recargarTodo, buscarGanador]);

  const resetGanadorState = useCallback(() => {
    setNumeroGanador("");
    setResultadoGanador(null);
    setMensajeBusqueda("");
    setEsNumeroGanador(false);
    setGuardandoGanador(false);
  }, []);

  return {
    numeroGanador,
    setNumeroGanador,
    resultadoGanador,
    setResultadoGanador,
    mensajeBusqueda,
    setMensajeBusqueda,
    esNumeroGanador,
    setEsNumeroGanador,
    guardandoGanador,
    buscarGanador,
    guardarGanadorOficial,
    resetGanadorState,
  };
}