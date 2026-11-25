"use client";

import { useEffect, useState } from "react";
import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";
import RaffleProgressPanel from "../RaffleProgressPanel";

export default function AdminNumerosSection({
  numeroRef,
  rifaSeleccionada,
  comprasFiltradasPorRifa,
  comprasPendientes,
  abrirAprobacionManualDesdeCuadricula,
  setSeccionActiva,
  scrollToRef,
  comprasSectionRef,
  numeroGanadorOficial,
}) {
  const rifaId = rifaSeleccionada?.id || "";

  const [resultado, setResultado] = useState(null);
  const [errorTickets, setErrorTickets] = useState("");
  const [recarga, setRecarga] = useState(0);

  const loadingTickets =
    resultado?.rifaId !== rifaId ||
    resultado?.recarga !== recarga;

  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

    const controller = new AbortController();

    setErrorTickets("");
    setResultado(null);

    if (!rifaId) {
      return () => {
        mounted = false;
        controller.abort();
      };
    }

    const cargarTickets = async (intento = 0) => {
      try {
        const headers = await getAdminAuthHeaders();

        if (!mounted || controller.signal.aborted) {
          return;
        }

        if (!headers.Authorization) {
          if (intento < 6) {
            retryTimeout = setTimeout(() => {
              cargarTickets(intento + 1);
            }, 700);

            return;
          }

          throw new Error(
            "No se encontró una sesión válida del administrador."
          );
        }

        const res = await fetch(
          `/api/admin-tickets-rifa?rifaId=${encodeURIComponent(rifaId)}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !Array.isArray(data.tickets)) {
          throw new Error(
            data?.error || "No se pudieron cargar los números."
          );
        }

        if (!mounted || controller.signal.aborted) {
          return;
        }

        setResultado({
          rifaId,
          recarga,
          tickets: data.tickets,
        });

        setErrorTickets("");
      } catch (error) {
        if (
          !mounted ||
          controller.signal.aborted ||
          error?.name === "AbortError"
        ) {
          return;
        }

        console.error("Error cargando números:", error);

        setErrorTickets(
          error?.message || "No se pudieron cargar los números."
        );
      }
    };

    cargarTickets();

    return () => {
      mounted = false;
      controller.abort();

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [rifaId, recarga]);

  return (
    <div className="adminpro-page-stack">
      <div ref={numeroRef} id="numero">

        {!rifaId ? (
          <div className="adminpro-top-info">
            Selecciona una rifa para consultar sus números.
          </div>
        ) : errorTickets ? (
          <div className="adminpro-top-info">
            <p>{errorTickets}</p>

            <button
              type="button"
              onClick={() => {
                setErrorTickets("");
                setRecarga(prev => prev + 1);
              }}
              style={{
                background: "#bf0000",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                cursor: "pointer",
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              🔄 Reintentar
            </button>
          </div>
        ) : loadingTickets ? (
          <div className="adminpro-top-info">
            Cargando números de la rifa...
          </div>
        ) : (
          <RaffleProgressPanel
            tickets={resultado.tickets}
            compras={comprasFiltradasPorRifa}
            rifaSeleccionada={rifaSeleccionada}
            tieneComprasPendientes={comprasPendientes.length > 0}
            onOpenManualFromGrid={
              abrirAprobacionManualDesdeCuadricula
            }
            onOpenCompra={() => {
              setSeccionActiva("compras");
              scrollToRef(comprasSectionRef, 180);
            }}
            numeroGanadorOficial={numeroGanadorOficial}
          />
        )}

      </div>
    </div>
  );
}