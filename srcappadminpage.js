"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    cargarCompras();
  }, []);

  const cargarCompras = async () => {
    const { data } = await supabase
      .from("compras")
      .select("*, usuarios(nombre, email)")
      .order("fecha_compra", { ascending: false });

    setCompras(data);
  };

  const aprobarCompra = async (compra) => {
    // 1️⃣ Cambiar estado
    await supabase
      .from("compras")
      .update({ estado_pago: "aprobado" })
      .eq("id", compra.id);

    // 2️⃣ Buscar último ticket
    const { data: ultimoTicket } = await supabase
      .from("tickets")
      .select("numero_ticket")
      .order("numero_ticket", { ascending: false })
      .limit(1);

    let ultimoNumero = ultimoTicket?.[0]?.numero_ticket || 0;

    // 3️⃣ Generar tickets
    const nuevosTickets = [];

    for (let i = 1; i <= compra.cantidad_tickets; i++) {
      nuevosTickets.push({
        numero_ticket: ultimoNumero + i,
        compra_id: compra.id,
      });
    }

    await supabase.from("tickets").insert(nuevosTickets);

    alert("Compra aprobada y tickets generados ✅");
    cargarCompras();
  };

  return (
    <div style={{ padding: 30 }}>
      <h1>Panel Admin</h1>

      {compras?.map((compra) => (
        <div
          key={compra.id}
          style={{
            border: "1px solid #ccc",
            padding: 15,
            marginBottom: 15,
          }}
        >
          <p><strong>Nombre:</strong> {compra.usuarios?.nombre}</p>
          <p><strong>Email:</strong> {compra.usuarios?.email}</p>
          <p><strong>Tickets:</strong> {compra.cantidad_tickets}</p>
          <p><strong>Estado:</strong> {compra.estado_pago}</p>

          {compra.estado_pago === "pendiente" && (
            <button onClick={() => aprobarCompra(compra)}>
              Aprobar Compra
            </button>
          )}
        </div>
      ))}
    </div>
  );
}