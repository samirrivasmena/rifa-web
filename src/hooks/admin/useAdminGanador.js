"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "../../lib/getAdminAuthHeaders";

function normalizarNumero(valor, padLength = 4) {
  if (valor === undefined || valor === null || valor === "") return null;

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");
  if (!soloNumeros) return null;

  return String(Number(soloNumeros)).padStart(padLength, "0");
}

function extraerGanadorPersistido(rifaSeleccionada, padLength = 4) {
  if (!rifaSeleccionada) return null;

  const candidatos = [
    rifaSeleccionada?.numero_ganador,
    rifaSeleccionada?.numero_oficial,
    rifaSeleccionada?.sorteo?.numero_ganador,
    rifaSeleccionada?.sorteo?.numero_oficial,
    rifaSeleccionada?.sorteo?.numero,
    rifaSeleccionada?.ganador,
    rifaSeleccionada?.winner,
  ];

  for (const valor of candidatos) {
    const normalizado = normalizarNumero(valor, padLength);
    if (normalizado !== null) return normalizado;
  }

  return null;
}

export function useAdminGanador({ rifaSeleccionada, padLength = 4, recargarTodo }) {
  const ganadorPersistido = useMemo(() => {
    return extraerGanadorPersistido(rifaSeleccionada, padLength);
  }, [rifaSeleccionada, padLength]);

  const [numeroGanador, setNumeroGanador] = useState("");
  const [resultadoGanador, setResultadoGanador] = useState(null);
  const [numeroGanadorOficial, setNumeroGanadorOficial] = useState(null);
  const [mensajeBusqueda, setMensajeBusqueda] = useState("");
  const [esNumeroGanador, setEsNumeroGanador] = useState(false);
  const [guardandoGanador, setGuardandoGanador] = useState(false);
  const [quitandoGanador, setQuitandoGanador] = useState(false);

  useEffect(() => {
    let active = true;

    const cargarGanadorPersistido = async () => {
      setNumeroGanadorOficial(ganadorPersistido);

      if (!ganadorPersistido || !rifaSeleccionada?.id) {
        if (!active) return;
        setResultadoGanador(null);
        setEsNumeroGanador(false);
        setMensajeBusqueda("Aún no hay ganador oficial guardado para esta rifa.");
        return;
      }

      try {
        const numero = Number(ganadorPersistido);

        const headers = await getAdminAuthHeaders();

        // Si no hay token admin, igual mostramos el ganador persistido
        if (!headers.Authorization) {
          if (!active) return;

          setResultadoGanador({
            existe: true,
            numero_ticket: ganadorPersistido,
            numero_ganador: ganadorPersistido,
            compra_id: null,
            usuario: null,
            sorteo: rifaSeleccionada?.sorteo ?? null,
            esGanador: true,
            oficial: true,
            persistido: true,
          });
          setEsNumeroGanador(true);
          setMensajeBusqueda(`🏆 Ganador oficial cargado: ${ganadorPersistido}`);
          return;
        }

        const res = await fetch("/api/verificar-ganador", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rifaId: rifaSeleccionada.id,
            numero,
          }),
        });

        const data = await res.json();

        if (!active) return;

        const ganadorNormalizado = normalizarNumero(
          data.numero_ganador ?? data.numero_oficial ?? data.numero_ticket ?? ganadorPersistido,
          padLength
        );

        // Importante: si ya estaba persistido, seguimos tratándolo como ganador oficial
        setResultadoGanador({
          existe: true,
          numero_ticket: data.numero_ticket ?? ganadorPersistido,
          numero_ganador: ganadorNormalizado,
          compra_id: data.compra_id ?? null,
          usuario: data.usuario ?? null,
          sorteo: data.sorteo ?? rifaSeleccionada?.sorteo ?? null,
          esGanador: true,
          oficial: true,
          persistido: true,
        });

        setNumeroGanadorOficial(ganadorNormalizado);
        setEsNumeroGanador(true);
        setMensajeBusqueda(`🏆 Ganador oficial cargado: ${ganadorNormalizado}`);
      } catch (error) {
        console.error("Error cargando ganador persistido:", error);

        if (!active) return;

        // Aunque falle la verificación, si había ganador guardado lo mostramos como oficial
        if (ganadorPersistido) {
          setResultadoGanador({
            existe: true,
            numero_ticket: ganadorPersistido,
            numero_ganador: ganadorPersistido,
            compra_id: null,
            usuario: null,
            sorteo: rifaSeleccionada?.sorteo ?? null,
            esGanador: true,
            oficial: true,
            persistido: true,
          });
          setEsNumeroGanador(true);
          setMensajeBusqueda(`🏆 Ganador oficial cargado: ${ganadorPersistido}`);
        } else {
          setResultadoGanador(null);
          setEsNumeroGanador(false);
          setMensajeBusqueda("Aún no hay ganador oficial guardado para esta rifa.");
        }
      }
    };

    cargarGanadorPersistido();

    return () => {
      active = false;
    };
  }, [ganadorPersistido, rifaSeleccionada?.id, padLength, rifaSeleccionada?.sorteo]);

  const buscarGanador = useCallback(async () => {
    setResultadoGanador(null);
    setMensajeBusqueda("");
    setEsNumeroGanador(false);

    if (!rifaSeleccionada?.id) {
      setMensajeBusqueda("⚠️ Debes seleccionar una rifa");
      return;
    }

    const limpio = String(numeroGanador || "").replace(/\D/g, "").slice(0, padLength);

    if (!limpio) {
      setMensajeBusqueda("⚠️ Debes ingresar un número válido");
      return;
    }

    const numero = Number(limpio);

    if (Number.isNaN(numero)) {
      setMensajeBusqueda("⚠️ Debes ingresar un número válido");
      return;
    }

    const numeroFormateado = String(numero).padStart(padLength, "0");

    try {
      const res = await fetch("/api/verificar-ganador", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
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

      const ganadorNormalizado = normalizarNumero(
        data.numero_ganador ?? data.numero_oficial ?? data.numero_ticket ?? numero,
        padLength
      );

      setResultadoGanador({
        existe: Boolean(data.existe),
        numero_ticket: data.numero_ticket ?? numero,
        numero_ganador: ganadorNormalizado,
        compra_id: data.compra_id ?? null,
        usuario: data.usuario ?? null,
        sorteo: data.sorteo ?? null,
        esGanador: Boolean(data.esGanador),
      });

      if (data.esGanador) {
        setNumeroGanadorOficial(ganadorNormalizado);
        setEsNumeroGanador(true);
        setMensajeBusqueda(
          `🏆 El número ${numeroFormateado} es el ganador oficial de esta rifa`
        );
      } else {
        setEsNumeroGanador(false);

        if (!data.existe) {
          setMensajeBusqueda(
            `❌ El número ${numeroFormateado} no fue vendido en esta rifa`
          );
        } else {
          setMensajeBusqueda(`✅ El número ${numeroFormateado} sí fue vendido en esta rifa`);
        }
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

    const numeroFormateado = normalizarNumero(
      resultadoGanador?.numero_ticket ?? resultadoGanador?.numero_ganador,
      padLength
    );

    const confirmar = await Swal.fire({
      title: "¿Registrar ganador oficial?",
      text: `Se registrará el número ${numeroFormateado} como ganador oficial de esta rifa.`,
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
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
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

      setNumeroGanadorOficial(numeroFormateado);
      setResultadoGanador((prev) =>
        prev
          ? {
              ...prev,
              numero_ganador: numeroFormateado,
              esGanador: true,
              oficial: true,
              persistido: true,
            }
          : {
              existe: true,
              numero_ticket: resultadoGanador.numero_ticket,
              numero_ganador: numeroFormateado,
              compra_id: resultadoGanador.compra_id ?? null,
              usuario: resultadoGanador.usuario ?? null,
              sorteo: resultadoGanador.sorteo ?? null,
              esGanador: true,
              oficial: true,
              persistido: true,
            }
      );

      setEsNumeroGanador(true);
      setMensajeBusqueda(`🏆 El número ${numeroFormateado} fue registrado como ganador oficial`);

      await recargarTodo();

      await Swal.fire({
        icon: "success",
        title: "Ganador registrado",
        text: `El número ${numeroFormateado} fue registrado como ganador oficial`,
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
  }, [rifaSeleccionada, resultadoGanador, padLength, recargarTodo]);

  const quitarGanadorOficial = useCallback(async () => {
    if (!rifaSeleccionada?.id) {
      await Swal.fire({
        icon: "error",
        title: "No permitido",
        text: "Debes seleccionar una rifa válida",
      });
      return;
    }

    if (!numeroGanadorOficial && !ganadorPersistido) {
      await Swal.fire({
        icon: "info",
        title: "Sin ganador",
        text: "Esta rifa no tiene un ganador oficial guardado.",
      });
      return;
    }

    const confirmar = await Swal.fire({
      title: "¿Quitar ganador oficial?",
      text: "La rifa volverá a estado activa y se eliminará el número ganador guardado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setQuitandoGanador(true);

      const res = await fetch("/api/quitar-ganador", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId: rifaSeleccionada.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo quitar el ganador oficial",
        });
        return;
      }

      setNumeroGanador("");
      setResultadoGanador(null);
      setNumeroGanadorOficial(null);
      setEsNumeroGanador(false);
      setMensajeBusqueda("Ganador oficial eliminado. La rifa volvió a activa.");

      await recargarTodo();

      await Swal.fire({
        icon: "success",
        title: "Ganador eliminado",
        text: "La rifa volvió a estar activa.",
      });
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al quitar el ganador oficial",
      });
    } finally {
      setQuitandoGanador(false);
    }
  }, [rifaSeleccionada, numeroGanadorOficial, ganadorPersistido, recargarTodo]);

  const resetGanadorState = useCallback(() => {
    setNumeroGanador("");
    setResultadoGanador(
      ganadorPersistido
        ? {
            existe: true,
            numero_ticket: ganadorPersistido,
            numero_ganador: ganadorPersistido,
            compra_id: null,
            usuario: null,
            sorteo: rifaSeleccionada?.sorteo ?? null,
            esGanador: true,
            oficial: true,
            persistido: true,
          }
        : null
    );
    setNumeroGanadorOficial(ganadorPersistido);
    setMensajeBusqueda(
      ganadorPersistido
        ? `🏆 Ganador oficial cargado: ${ganadorPersistido}`
        : "Aún no hay ganador oficial guardado para esta rifa."
    );
    setEsNumeroGanador(Boolean(ganadorPersistido));
    setGuardandoGanador(false);
    setQuitandoGanador(false);
  }, [ganadorPersistido, rifaSeleccionada?.sorteo]);

  return {
    numeroGanador,
    setNumeroGanador,
    resultadoGanador,
    setResultadoGanador,
    numeroGanadorOficial,
    mensajeBusqueda,
    setMensajeBusqueda,
    esNumeroGanador,
    setEsNumeroGanador,
    guardandoGanador,
    quitandoGanador,
    buscarGanador,
    guardarGanadorOficial,
    quitarGanadorOficial,
    resetGanadorState,
  };
}