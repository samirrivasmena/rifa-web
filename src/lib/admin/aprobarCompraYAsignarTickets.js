export async function aprobarCompraYAsignarTickets({
  supabaseAdmin,
  compraId,
  idempotent = false,
}) {
  try {
    if (!compraId) {
      return {
        ok: false,
        error: "Falta el ID de la compra",
        status: 400,
      };
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, estado_pago, cantidad_tickets, rifa_id")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
      return {
        ok: false,
        error: compraError.message,
        status: 500,
      };
    }

    if (!compra) {
      return {
        ok: false,
        error: "La compra no existe",
        status: 404,
      };
    }

    const cantidadTickets = Number(compra.cantidad_tickets) || 0;

    if (cantidadTickets <= 0) {
      return {
        ok: false,
        error: "La compra no tiene una cantidad válida de tickets",
        status: 400,
      };
    }

    const { data: ticketsDeLaCompra, error: ticketsDeLaCompraError } =
      await supabaseAdmin
        .from("tickets")
        .select("id, numero_ticket")
        .eq("compra_id", compra.id);

    if (ticketsDeLaCompraError) {
      return {
        ok: false,
        error: ticketsDeLaCompraError.message,
        status: 500,
      };
    }

    const ticketsAsignadosCompra = Array.isArray(ticketsDeLaCompra)
      ? ticketsDeLaCompra
      : [];

    if (compra.estado_pago === "aprobado" && !idempotent) {
      return {
        ok: false,
        error: "La compra ya fue aprobada",
        status: 400,
      };
    }

    if (compra.estado_pago === "rechazado") {
      return {
        ok: false,
        error: "La compra fue rechazada y no puede aprobarse",
        status: 400,
      };
    }

    let rifaId = compra.rifa_id;

    if (!rifaId) {
      const { data: rifaActiva, error: rifaActivaError } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("estado", "activa")
        .limit(1)
        .maybeSingle();

      if (rifaActivaError) {
        return {
          ok: false,
          error: rifaActivaError.message,
          status: 500,
        };
      }

      if (!rifaActiva) {
        return {
          ok: false,
          error: "No hay una rifa activa disponible",
          status: 400,
        };
      }

      rifaId = rifaActiva.id;

      const { error: updateCompraRifaError } = await supabaseAdmin
        .from("compras")
        .update({ rifa_id: rifaId })
        .eq("id", compra.id);

      if (updateCompraRifaError) {
        return {
          ok: false,
          error: updateCompraRifaError.message,
          status: 500,
        };
      }
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return {
        ok: false,
        error: rifaError.message,
        status: 500,
      };
    }

    if (!rifa) {
      return {
        ok: false,
        error: "La rifa asociada no existe",
        status: 404,
      };
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "disponible", "publicada"].includes(estadoRifa)) {
      return {
        ok: false,
        error: "La rifa no está disponible para aprobar compras automáticamente",
        status: 400,
      };
    }

    const numeroInicio = Number(rifa.numero_inicio);
    const numeroFin = Number(rifa.numero_fin);

    if (
      !Number.isInteger(numeroInicio) ||
      !Number.isInteger(numeroFin) ||
      numeroFin < numeroInicio
    ) {
      return {
        ok: false,
        error: "La rifa no tiene un rango de números válido",
        status: 400,
      };
    }

    const totalNumerosConfigurados = Number(
      rifa.cantidad_numeros ?? numeroFin - numeroInicio + 1
    );

    const totalNumeros =
      Number.isFinite(totalNumerosConfigurados) && totalNumerosConfigurados > 0
        ? totalNumerosConfigurados
        : numeroFin - numeroInicio + 1;

    const { data: ticketsExistentes, error: ticketsExistentesError } =
      await supabaseAdmin
        .from("tickets")
        .select("id, numero_ticket")
        .eq("rifa_id", rifa.id);

    if (ticketsExistentesError) {
      return {
        ok: false,
        error: ticketsExistentesError.message,
        status: 500,
      };
    }

    const ticketsActuales = Array.isArray(ticketsExistentes) ? ticketsExistentes : [];
    const ticketsVendidosAntes = ticketsActuales.length;

    const faltantes = Math.max(
      cantidadTickets - ticketsAsignadosCompra.length,
      0
    );

    if (ticketsVendidosAntes >= totalNumeros && faltantes > 0) {
      const { error: updateAgotadaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateAgotadaError) {
        return {
          ok: false,
          error: updateAgotadaError.message,
          status: 500,
        };
      }

      return {
        ok: false,
        error: "La rifa ya alcanzó el 100% y no tiene números disponibles",
        status: 409,
      };
    }

    if (faltantes > 0) {
      const disponiblesRestantesAntes = totalNumeros - ticketsVendidosAntes;

      if (faltantes > disponiblesRestantesAntes) {
        return {
          ok: false,
          error: `No hay suficientes números disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s)`,
          status: 409,
        };
      }

      const numerosOcupados = new Set(
        ticketsActuales.map((t) => Number(t.numero_ticket))
      );

      const disponibles = [];
      for (let i = numeroInicio; i <= numeroFin; i++) {
        if (!numerosOcupados.has(i)) {
          disponibles.push(i);
        }
      }

      if (disponibles.length < faltantes) {
        return {
          ok: false,
          error: "No hay suficientes números disponibles en esta rifa",
          status: 400,
        };
      }

      const disponiblesMezclados = [...disponibles].sort(
        () => Math.random() - 0.5
      );
      const seleccionados = disponiblesMezclados.slice(0, faltantes);

      const ticketsParaInsertar = seleccionados.map((numero) => ({
        compra_id: compra.id,
        rifa_id: rifa.id,
        numero_ticket: numero,
      }));

      const { data: nuevosTickets, error: insertTicketsError } = await supabaseAdmin
        .from("tickets")
        .insert(ticketsParaInsertar)
        .select();

      if (insertTicketsError) {
        return {
          ok: false,
          error: insertTicketsError.message,
          status: 500,
        };
      }

      const { error: aprobarCompraError } = await supabaseAdmin
        .from("compras")
        .update({
          estado_pago: "aprobado",
          rifa_id: rifa.id,
        })
        .eq("id", compra.id);

      if (aprobarCompraError) {
        return {
          ok: false,
          error: aprobarCompraError.message,
          status: 500,
        };
      }

      const ticketsVendidosDespues = ticketsVendidosAntes + faltantes;
      const rifaCompleta = ticketsVendidosDespues >= totalNumeros;
      const nuevoEstadoRifa = rifaCompleta ? "agotada" : rifa.estado;

      if (rifaCompleta) {
        const { error: updateRifaError } = await supabaseAdmin
          .from("rifas")
          .update({ estado: "agotada" })
          .eq("id", rifa.id);

        if (updateRifaError) {
          return {
            ok: false,
            error: updateRifaError.message,
            status: 500,
          };
        }
      }

      return {
        ok: true,
        tickets: [...ticketsAsignadosCompra, ...(nuevosTickets || [])],
        rifa: {
          id: rifa.id,
          nombre: rifa.nombre,
          formato: rifa.formato,
          estado: nuevoEstadoRifa,
          tickets_vendidos: ticketsVendidosDespues,
          total_numeros: totalNumeros,
          porcentaje_vendido:
            totalNumeros > 0
              ? Number(((ticketsVendidosDespues / totalNumeros) * 100).toFixed(2))
              : 0,
        },
        rifaCompleta,
      };
    }

    const { error: aprobarCompraError } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago: "aprobado",
        rifa_id: rifa.id,
      })
      .eq("id", compra.id);

    if (aprobarCompraError) {
      return {
        ok: false,
        error: aprobarCompraError.message,
        status: 500,
      };
    }

    const ticketsVendidosDespues = ticketsVendidosAntes;
    const rifaCompleta = ticketsVendidosDespues >= totalNumeros;

    if (rifaCompleta) {
      const { error: updateRifaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateRifaError) {
        return {
          ok: false,
          error: updateRifaError.message,
          status: 500,
        };
      }
    }

    return {
      ok: true,
      tickets: ticketsAsignadosCompra,
      rifa: {
        id: rifa.id,
        nombre: rifa.nombre,
        formato: rifa.formato,
        estado: rifaCompleta ? "agotada" : rifa.estado,
        tickets_vendidos: ticketsVendidosDespues,
        total_numeros: totalNumeros,
        porcentaje_vendido:
          totalNumeros > 0
            ? Number(((ticketsVendidosDespues / totalNumeros) * 100).toFixed(2))
            : 0,
      },
      rifaCompleta,
      alreadyProcessed: compra.estado_pago === "aprobado",
    };
  } catch (error) {
    console.error("aprobarCompraYAsignarTickets error:", error);
    return {
      ok: false,
      error: error.message || "Error interno del servidor",
      status: 500,
    };
  }
}