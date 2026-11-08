
"use client";

import { useEffect, useRef, useState } from "react";
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
  const [ticketsRifa, setTicketsRifa] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [intentos, setIntentos] = useState(0);

  const requestIdRef = useRef(0);

  useEffect(() => {
    setIntentos(0);
    setTicketsRifa([]);
    setLoadingTickets(true);
  }, [rifaSeleccionada?.id]);

  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    const leerRespuestaSegura = async (res) => {
      const raw = await res.text();

      try {
        return JSON.parse(raw);
      } catch {
        return { raw };
      }
    };

    const cargarTickets = async () => {
      const rifaId = rifaSeleccionada?.id;

      if (!rifaId) {
        if (mounted) {
          setTicketsRifa([]);
          setLoadingTickets(false);
        }
        return;
      }

      try {
        if (mounted) {
          setLoadingTickets(true);
        }

        const headers = await getAdminAuthHeaders();

        if (!mounted || controller.signal.aborted) {
          return;
        }

        if (!headers.Authorization) {
          console.warn(
            "Todavía no hay token admin listo para cargar tickets"
          );

          if (mounted && intentos < 6) {
            retryTimeout = setTimeout(() => {
              setIntentos((prev) => prev + 1);
            }, 700);
          } else if (mounted) {
            setTicketsRifa([]);
            setLoadingTickets(false);
          }

          return;
        }

        // Solo consultamos los tickets.
        // No ejecutamos sincronización automática.
        const res = await fetch(
          `/api/admin-tickets-rifa?rifaId=${encodeURIComponent(rifaId)}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await leerRespuestaSegura(res);

        if (!res.ok) {
          console.error(
            data.error ||
              data.raw ||
              "No se pudieron cargar los tickets de la rifa"
          );

          if (mounted && requestId === requestIdRef.current) {
            setTicketsRifa([]);
          }

          return;
        }

        if (mounted && requestId === requestIdRef.current) {
          setTicketsRifa(
            Array.isArray(data.tickets) ? data.tickets : []
          );
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        console.error("Error cargando tickets de la rifa:", error);

        if (mounted && requestId === requestIdRef.current) {
          setTicketsRifa([]);
        }
      } finally {
        if (mounted && requestId === requestIdRef.current) {
          setLoadingTickets(false);
        }
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
  }, [rifaSeleccionada?.id, intentos]);

  return (
    <div className="adminpro-page-stack">
      <div ref={numeroRef} id="numero">
        <RaffleProgressPanel
          tickets={ticketsRifa}
          compras={comprasFiltradasPorRifa}
          rifaSeleccionada={rifaSeleccionada}
          tieneComprasPendientes={comprasPendientes.length > 0}
          onOpenManualFromGrid={abrirAprobacionManualDesdeCuadricula}
          onOpenCompra={() => {
            setSeccionActiva("compras");
            scrollToRef(comprasSectionRef, 180);
          }}
          numeroGanadorOficial={numeroGanadorOficial}
        />

        {loadingTickets && (
          <div className="adminpro-top-info">
            Cargando números de la rifa...
          </div>
        )}
      </div>
    </div>
  );
}
