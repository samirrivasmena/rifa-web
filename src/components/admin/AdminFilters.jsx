"use client";

export default function AdminFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  paymentFilter,
  setPaymentFilter,
  totalResults,
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-neutral-300">
            Buscar compra
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, referencia o teléfono"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-red-500"
          />
        </div>

        <div className="w-full lg:w-56">
          <label className="mb-2 block text-sm font-medium text-neutral-300">
            Estado
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-red-500"
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        <div className="w-full lg:w-56">
          <label className="mb-2 block text-sm font-medium text-neutral-300">
            Método de pago
          </label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-red-500"
          >
            <option value="todos">Todos</option>
            <option value="Zelle">Zelle</option>
            <option value="Binance">Binance</option>
            <option value="Banco de Venezuela">Banco de Venezuela</option>
            <option value="Bancolombia">Bancolombia</option>
          </select>
        </div>
      </div>

      <div className="mt-4 text-sm text-neutral-400">
        Resultados encontrados:{" "}
        <span className="font-semibold text-white">{totalResults}</span>
      </div>
    </section>
  );
}