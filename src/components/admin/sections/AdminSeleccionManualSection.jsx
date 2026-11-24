
"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";

const DEFAULTS={enabled:false,modo_compra:"ambos",max_numeros_por_compra:100,reserva_horas:24,buscador_activo:true,actualizacion_automatica:true,bendecidos_activos:false};
const cardStyle={background:"rgba(17,24,39,.92)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:18,minWidth:0};
const inputStyle={boxSizing:"border-box",width:"100%",minHeight:44,padding:"10px 12px",color:"#fff",background:"#030712",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,marginTop:12};
const gridStyle={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:14};
const buttonStyle={border:"1px solid #475569",borderRadius:10,padding:"10px 16px",minHeight:44,background:"#1e293b",color:"#fff",fontWeight:700,cursor:"pointer"};
const metrics=[["Disponibles","tickets_disponibles","#4ade80"],["Reservados","tickets_reservados","#fbbf24"],["Vendidos","tickets_pagados","#60a5fa"],["Free Drop","tickets_free","#c084fc"],["Otros ocupados","tickets_otros_ocupados","#94a3b8"]];
const formato=new Intl.NumberFormat("es-US");

function Switch({titulo,checked,onChange,disabled}){
  return <label style={{...cardStyle,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:disabled?"default":"pointer"}}>
    <span>{titulo}</span>
    <input type="checkbox" checked={Boolean(checked)} onChange={e=>onChange(e.target.checked)} disabled={disabled} style={{width:24,height:24,flexShrink:0,accentColor:"#22c55e"}}/>
  </label>;
}

export default function AdminSeleccionManualSection({rifaSeleccionada}){
  if(!rifaSeleccionada?.id)return <section style={{...cardStyle,color:"#fff"}}>
    <h2>🎟️ Selección manual</h2>
    <p>Selecciona una rifa para configurar sus números.</p>
  </section>;
  return <Panel key={rifaSeleccionada.id} rifaSeleccionada={rifaSeleccionada}/>;
}

function Panel({rifaSeleccionada}){
  const rifaId=rifaSeleccionada.id;
  const [bendecidos,setBendecidos]=useState([]);
  const [numero,setNumero]=useState("");
  const [premio,setPremio]=useState("");
  const [buscar,setBuscar]=useState("");
  const [form,setForm]=useState({...DEFAULTS});
  const [activosGuardados,setActivosGuardados]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [stats,setStats]=useState(null);
  const [statsError,setStatsError]=useState("");
  const [statsLoading,setStatsLoading]=useState(false);
  const [updated,setUpdated]=useState(null);
  const mounted=useRef(false);
  const busy=useRef(false);
  const savingRef=useRef(false);
  const statsBusy=useRef(false);
  const statsVersion=useRef(0);

  const cargar=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;
    setLoading(true);
    setError("");
    const version=++statsVersion.current;
    try{
      const headers=await getAdminAuthHeaders();
      const res=await fetch(`/api/admin-seleccion-manual?rifaId=${encodeURIComponent(rifaId)}`,{headers,cache:"no-store"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.error||"No se pudo cargar la configuración.");
      if(!mounted.current)return;
      setForm({...DEFAULTS,...data.settings});
      setActivosGuardados(Boolean(data.settings?.bendecidos_activos));
      setBendecidos(data.bendecidos||[]);
      if(version===statsVersion.current){
        setStats(data.stats??null);
        setStatsError(data.statsError||(!data.stats?"Estadísticas no disponibles.":""));
        if(data.stats)setUpdated(new Date());
      }
    }catch(err){
      if(mounted.current)setError(err.message);
    }finally{
      busy.current=false;
      if(mounted.current)setLoading(false);
    }
  },[rifaId]);

  const refrescarStats=useCallback(async()=>{
    if(statsBusy.current||busy.current||document.hidden)return;
    statsBusy.current=true;
    setStatsLoading(true);
    const version=++statsVersion.current;
    try{
      const headers=await getAdminAuthHeaders();
      const res=await fetch(`/api/admin-seleccion-manual?rifaId=${encodeURIComponent(rifaId)}&soloStats=1`,{headers,cache:"no-store"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok||!data.stats)throw new Error(data.error||"Estadísticas no disponibles.");
      if(mounted.current&&version===statsVersion.current){
        setStats(data.stats);
        setStatsError("");
        setUpdated(new Date());
      }
    }catch(err){
      if(mounted.current&&version===statsVersion.current)setStatsError(err.message);
    }finally{
      statsBusy.current=false;
      if(mounted.current)setStatsLoading(false);
    }
  },[rifaId]);

  useEffect(()=>{
    mounted.current=true;
    cargar();
    return()=>{mounted.current=false;};
  },[cargar]);

  useEffect(()=>{
    const timer=setInterval(refrescarStats,60000);
    return()=>clearInterval(timer);
  },[refrescarStats]);

  function cambiar(campo,valor){
    setForm(prev=>({...prev,[campo]:valor}));
  }

  async function guardar(e){
    e.preventDefault();
    if(loading||saving||savingRef.current||error)return;
    const maximo=Number(form.max_numeros_por_compra);

    if(!Number.isInteger(maximo)||maximo<1||maximo>100){
      await Swal.fire({icon:"warning",title:"Máximo inválido",text:"Introduce un número entre 1 y 100."});
      return;
    }

    if(form.bendecidos_activos&&form.modo_compra==="manual"){
      await Swal.fire({icon:"warning",title:"Modo incompatible",text:"Permite la asignación automática para activar los bendecidos."});
      return;
    }

    savingRef.current=true;
    setSaving(true);
    try{
      if(form.bendecidos_activos!==activosGuardados){
        const confirmacion=await Swal.fire({
          icon:"warning",
          title:form.bendecidos_activos?"¿Activar números bendecidos?":"¿Desactivar números bendecidos?",
          text:form.bendecidos_activos?"Los números premiados quedarán exclusivamente al azar.":"Los números premiados disponibles podrán volver a seleccionarse manualmente.",
          showCancelButton:true,
          confirmButtonText:"Confirmar",
          cancelButtonText:"Cancelar"
        });
        if(!confirmacion.isConfirmed)return;
      }

      const headers=await getAdminAuthHeaders();
      const res=await fetch("/api/admin-seleccion-manual",{
        method:"PATCH",
        headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify({
          rifaId,
          enabled:form.enabled,
          modo_compra:form.modo_compra,
          max_numeros_por_compra:maximo,
          buscador_activo:form.buscador_activo,
          actualizacion_automatica:form.actualizacion_automatica,
          bendecidos_activos:form.bendecidos_activos
        })
      });

      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.error||"No se pudo guardar.");
      if(!mounted.current)return;

      if(data.settings?.bendecidos_activos!==form.bendecidos_activos){
        throw new Error("El servidor no confirmó el estado de los números bendecidos.");
      }

      setForm({...DEFAULTS,...data.settings});
      setActivosGuardados(data.settings.bendecidos_activos);

      await Swal.fire({
        icon:"success",
        title:"Configuración guardada",
        text:data.settings.bendecidos_activos?"Configuración guardada. Números bendecidos activos.":"Configuración guardada. Números bendecidos desactivados."
      });

      if(mounted.current)refrescarStats();
    }catch(err){
      if(mounted.current)await Swal.fire({icon:"error",title:"Error",text:err.message});
    }finally{
      savingRef.current=false;
      if(mounted.current)setSaving(false);
    }
  }

  async function guardarPremio(n,p){
    if(loading||saving||savingRef.current||error)return;

    if(!Number.isInteger(n)||n<0||!Number.isFinite(p)||p<0||p>9999999999.99||Math.abs(p*100-Math.round(p*100))>0.0001){
      await Swal.fire({icon:"warning",title:"Datos inválidos",text:"Comprueba el número y el importe del premio."});
      return;
    }

    savingRef.current=true;
    setSaving(true);
    try{
      const headers=await getAdminAuthHeaders();
      const res=await fetch("/api/admin-seleccion-manual",{
        method:"PATCH",
        headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify({rifaId,accion:"premio",numero:n,premio:p})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.error||"No se pudo guardar");
      if(!mounted.current)return;
      setNumero("");
      setPremio("");
      await cargar();
    }catch(err){
      if(mounted.current)await Swal.fire({icon:"error",title:"Error",text:err.message});
    }finally{
      savingRef.current=false;
      if(mounted.current)setSaving(false);
    }
  }

  const disabled=loading||saving||Boolean(error);
  const total=Number(stats?.total_numeros)||0;
  const porcentaje=n=>total>0?Math.max(0,Math.min(100,Number(n)/total*100)):0;
  const cambiosPendientes=form.bendecidos_activos!==activosGuardados;
  const longitud=Math.max(3,String(rifaSeleccionada.numero_fin??999).length);
  const formatearNumero=n=>String(n).padStart(longitud,"0");
  const totalPremios=bendecidos.reduce((a,t)=>a+Number(t.premio_bendecido||0),0);

  return <section style={{marginTop:18,padding:20,borderRadius:20,background:"linear-gradient(180deg,#0f172a,#111827)",color:"#fff",border:"1px solid rgba(255,255,255,.08)"}}>
    <header style={{marginBottom:20}}>
      <h2 style={{margin:0}}>🎟️ Selección manual de números</h2>
      <p style={{opacity:.7}}>Configura cómo los clientes seleccionan sus tickets.</p>
      <small>Rifa: {rifaSeleccionada.nombre||rifaId}</small>
    </header>

    <div style={{...cardStyle,marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <h3 style={{margin:0}}>📊 Estadísticas de números</h3>
        <button type="button" style={buttonStyle} onClick={refrescarStats} disabled={statsLoading||loading}>{statsLoading?"Actualizando...":"↻ Actualizar"}</button>
      </div>
      <p style={{color:"#94a3b8",fontSize:13}}>Actualización cada 60 segundos con el panel visible. {updated?`Última consulta: ${updated.toLocaleTimeString()}`:""}</p>
      {statsError&&<p role="alert" style={{color:"#fca5a5"}}>{statsError}{stats?" · Mostrando última consulta correcta.":""}</p>}
      {stats?<><div style={gridStyle}>
        {metrics.map(([label,key,color])=>{
          const n=Number(stats[key])||0;
          const pct=porcentaje(n);
          return <div key={key} style={cardStyle}>
            <small style={{color:"#cbd5e1"}}>{label}</small>
            <div style={{fontSize:28,fontWeight:800,color}}>{formato.format(n)}</div>
            <div style={{height:7,borderRadius:8,background:"#334155",overflow:"hidden",margin:"10px 0"}}>
              <div style={{height:"100%",width:`${pct}%`,background:color}}/>
            </div>
            <small>{pct.toFixed(2)}% del total</small>
          </div>;
        })}
      </div>
      <div style={{display:"flex",height:12,borderRadius:8,overflow:"hidden",background:"#334155",marginTop:18}}>
        {metrics.map(([label,key,color])=><div key={key} title={label} style={{width:`${porcentaje(stats[key])}%`,background:color}}/>)}
      </div>
      <p>Total: <strong>{formato.format(total)}</strong> · Ocupados: <strong>{formato.format(stats.tickets_ocupados)}</strong></p>
      <p style={{color:Number(stats.tickets_reservas_vencidas)>0?"#fca5a5":"#94a3b8"}}>Reservas vencidas pendientes de liberar: <strong>{formato.format(stats.tickets_reservas_vencidas)}</strong></p>
      <small>Las reservas pendientes no se cuentan como ventas. Los vencimientos son parte de los reservados, no una categoría adicional.</small>
      </>:<p>{loading?"Cargando estadísticas...":"Sin estadísticas disponibles."}</p>}
    </div>

    {error&&<div role="alert" style={{...cardStyle,marginBottom:16,color:"#fca5a5"}}>
      {error} <button type="button" style={buttonStyle} onClick={cargar}>Reintentar</button>
    </div>}

    <form onSubmit={guardar}>
      <h3>⚙️ Configuración</h3>
      <div style={gridStyle}>
        <Switch titulo="Activar selección manual" checked={form.enabled} onChange={v=>cambiar("enabled",v)} disabled={disabled}/>
        <Switch titulo="🍀🔒 Activar números bendecidos" checked={form.bendecidos_activos} onChange={v=>cambiar("bendecidos_activos",v)} disabled={disabled}/>
        <label style={cardStyle}>
          Modo de compra
          <select value={form.modo_compra} onChange={e=>cambiar("modo_compra",e.target.value)} disabled={disabled} style={inputStyle}>
            <option value="ambos">Manual y automática</option>
            <option value="manual">Solo selección manual</option>
            <option value="automatica">Solo automática</option>
          </select>
        </label>
        <label style={cardStyle}>
          Máximo de números por compra
          <input type="number" min="1" max="100" required value={form.max_numeros_por_compra} onChange={e=>cambiar("max_numeros_por_compra",e.target.value)} disabled={disabled} style={inputStyle}/>
        </label>
        <div style={cardStyle}>
          Duración de la reserva
          <input value="24 horas" readOnly style={{...inputStyle,opacity:.65}}/>
          <small style={{opacity:.7}}>Duración fija por seguridad.</small>
        </div>
        {[["buscador_activo","Buscador de números"],["actualizacion_automatica","Actualización automática del selector público"]].map(([campo,titulo])=>
          <Switch key={campo} titulo={titulo} checked={form[campo]} onChange={v=>cambiar(campo,v)} disabled={disabled}/>
        )}
      </div>

      {cambiosPendientes&&<p style={{color:"#fbbf24"}}>⚠️ Tienes cambios de activación pendientes de guardar.</p>}

      <div style={{display:"flex",gap:12,justifyContent:"flex-end",flexWrap:"wrap",marginTop:20}}>
        <button type="button" style={buttonStyle} onClick={cargar} disabled={loading||saving}>{loading?"Cargando...":"Recargar configuración"}</button>
        <button type="submit" style={{...buttonStyle,background:"#b91c1c",borderColor:"#ef4444",opacity:disabled?.6:1}} disabled={disabled}>{saving?"Guardando...":"Guardar configuración"}</button>
      </div>
    </form>

    <div style={{...cardStyle,marginTop:20}}>
      <h3>🍀🔒 Números bendecidos</h3>
      <p style={{color:activosGuardados?"#4ade80":"#94a3b8",fontWeight:700}}>
        {activosGuardados?"● Activos · Exclusivos al azar":"● Desactivados"}
      </p>
      <p style={{color:"#94a3b8"}}>Usa el interruptor y guarda la configuración para aplicar los cambios.</p>

      <div style={{...gridStyle,marginBottom:16}}>
        <div style={cardStyle}>
          <small>Números registrados</small>
          <div style={{fontSize:26,fontWeight:800,color:"#4ade80"}}>{bendecidos.length}</div>
        </div>
        <div style={cardStyle}>
          <small>Total en premios</small>
          <div style={{fontSize:26,fontWeight:800,color:"#4ade80"}}>${totalPremios.toFixed(2)}</div>
        </div>
      </div>

      <form onSubmit={e=>{
        e.preventDefault();
        if(/^\d+$/.test(numero)&&Number(premio)>0)guardarPremio(Number(numero),Number(premio));
      }}>
        <div style={gridStyle}>
          <label>
            Número
            <input style={inputStyle} required inputMode="numeric" pattern="[0-9]+" value={numero} onChange={e=>setNumero(e.target.value)} disabled={disabled}/>
          </label>
          <label>
            Premio USD
            <input style={inputStyle} type="number" min="0.01" step="0.01" required value={premio} onChange={e=>setPremio(e.target.value)} disabled={disabled}/>
          </label>
        </div>
        <button type="submit" style={{...buttonStyle,marginTop:12,background:"#166534"}} disabled={disabled||cambiosPendientes}>Guardar bendecido</button>
      </form>

      <input style={inputStyle} placeholder="Buscar número" value={buscar} onChange={e=>setBuscar(e.target.value)}/>

      {bendecidos.filter(t=>formatearNumero(t.numero_ticket).includes(buscar.trim())).map(t=>{
        const libre=t.estado==="disponible"&&!t.compra_id&&!t.free_drop_id&&!t.free_drop_participation_id&&!t.reserva_expira_at&&String(t.tipo||"").toLowerCase()!=="free";
        return <div key={t.numero_ticket} style={{...cardStyle,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8,borderColor:activosGuardados&&libre?"rgba(34,197,94,.35)":"rgba(255,255,255,.08)"}}>
          <strong style={{color:"#4ade80"}}>🍀 {formatearNumero(t.numero_ticket)} · ${Number(t.premio_bendecido).toFixed(2)}</strong>
          <span style={{flex:1,color:libre&&activosGuardados?"#4ade80":"#cbd5e1"}}>
            {libre?(activosGuardados?"🔒 Solo al azar":"Disponible"):"Ocupado"}
          </span>
          <button type="button" style={buttonStyle} disabled={disabled||!libre||cambiosPendientes} onClick={()=>{
            setNumero(String(t.numero_ticket));
            setPremio(String(t.premio_bendecido));
          }}>Editar</button>
          <button type="button" style={buttonStyle} disabled={disabled||!libre||cambiosPendientes} onClick={async()=>{
            const r=await Swal.fire({
              title:"¿Eliminar premio?",
              text:"El número dejará de tener este premio adicional.",
              icon:"warning",
              showCancelButton:true,
              confirmButtonText:"Eliminar",
              cancelButtonText:"Cancelar"
            });
            if(r.isConfirmed)guardarPremio(t.numero_ticket,0);
          }}>Eliminar</button>
        </div>;
      })}
      {!bendecidos.length&&<p style={{color:"#94a3b8"}}>No hay números bendecidos registrados.</p>}
    </div>
  </section>;
}
