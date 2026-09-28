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
  const [ticketsRifa, setTicketsRifa] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    setIntentos(0);
  }, [rifaSeleccionada?.id]);

  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

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
        setLoadingTickets(true);

        const headers = await getAdminAuthHeaders();

        if (!headers.Authorization) {
          console.warn("Todavía no hay token admin listo para sincronizar tickets");

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

        // 1) Sincroniza tickets
        const syncRes = await fetch(
          `/api/sincronizar-rifa?rifaId=${encodeURIComponent(rifaId)}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

        const syncData = await leerRespuestaSegura(syncRes);

        if (!syncRes.ok) {
          console.error(
            syncData.error ||
              syncData.raw ||
              "No se pudo sincronizar la rifa antes de cargar tickets"
          );

          if (mounted) {
            setTicketsRifa([]);
          }
          return;
        }

        // 2) Carga tickets ya sincronizados
        const res = await fetch(
          `/api/admin-tickets-rifa?rifaId=${encodeURIComponent(rifaId)}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

        const data = await leerRespuestaSegura(res);

        if (!res.ok) {
          console.error(
            data.error || data.raw || "No se pudieron cargar los tickets de la rifa"
          );

          if (mounted) {
            setTicketsRifa([]);
          }
          return;
        }

        if (mounted) {
          setTicketsRifa(Array.isArray(data.tickets) ? data.tickets : []);
        }
      } catch (error) {
        console.error("Error cargando tickets de la rifa:", error);
        if (mounted) setTicketsRifa([]);
      } finally {
        if (mounted) setLoadingTickets(false);
      }
    };

    cargarTickets();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [rifaSeleccionada?.id, intentos, comprasFiltradasPorRifa]);

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
            Sincronizando y cargando números de la rifa...
          </div>
        )}
      </div>
    </div>
  );
}