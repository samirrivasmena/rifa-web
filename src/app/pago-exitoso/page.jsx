"use client";

import Link from "next/link";

export default function PagoExitosoPage() {
  return (
    <main style={{ padding: 40, textAlign: "center" }}>
      <h1>Pago exitoso</h1>
      <p>Tu pago fue procesado correctamente.</p>

      <Link href="/principal" style={{ color: "blue" }}>
        Volver al inicio
      </Link>
    </main>
  );
}