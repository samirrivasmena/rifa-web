"use client";
export default function KpiGrid({compras=[],tickets=[],ticketsVendidos:ocupados=null,onCardClick}) {
 const estado = v => String(v??"").trim().toLowerCase();
 const aprobadas = compras.filter(c=>["aprobado","aprobada"].includes(estado(c.estado_pago)));
 const ids = new Set(aprobadas.map(c=>String(c.id)));
 const unicos = [...new Map(tickets.filter(t=>t.numero_ticket!=null).map(t=>[String(Number(t.numero_ticket)),t])).values()];
 const free = t=>Boolean(t.es_free || estado(t.tipo)==="free" || t.free_drop_id || t.free_drop_participation_id);
 const pagados = unicos.filter(t=>!free(t)&&estado(t.estado)==="asignado"&&t.reserva_expira_at==null&&ids.has(String(t.compra_id))).length;
 const monto = aprobadas.reduce((a,c)=>a+(Number(c.monto_total??c.total)||0),0);
 const cards = [["total","Total Compras",compras.length,"🛒","purple"],["pendientes","Pendientes",compras.filter(c=>estado(c.estado_pago)==="pendiente").length,"⏳","yellow"],["aprobadas","Aprobadas",aprobadas.length,"✅","green"],["rechazadas","Rechazadas",compras.filter(c=>estado(c.estado_pago)==="rechazado").length,"❌","red"],["tickets","Tickets Ocupados",ocupados??unicos.length,"🎟️","blue"],["pagados","Tickets Pagados",pagados,"💳","yellow"],["free","Tickets FREE",unicos.filter(free).length,"🎁","blue"],["monto","Monto Aprobado",`$${monto.toFixed(2)}`,"💵","dark"]];
 return <div className="adminpro-kpi-grid">{cards.map(([key,label,value,icon,className])=><button key={key} type="button" className={`adminpro-kpi-card ${className} clickable`} onClick={()=>onCardClick?.(key)} aria-label={`Ver ${label}`}><div className="adminpro-kpi-icon">{icon}</div><div className="adminpro-kpi-content"><p>{label}</p><h3>{value}</h3></div><span className="adminpro-kpi-click-hint" aria-hidden="true">↘</span></button>)}</div>;
}