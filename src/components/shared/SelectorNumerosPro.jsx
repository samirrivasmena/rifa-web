"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Caché breve en memoria: evita consultar la misma página al ir y volver.
// La disponibilidad es informativa; la reserva definitiva se validará en el servidor.
const cachePaginas = new Map();
const CACHE_MS = 15000;
const REFRESH_MS = 45000;
const TAMANO = 100;


export default function SelectorNumerosPro({ rifaId, inicio = 0, fin = 999, precio = 3, pagoMovil = false, tasaBcv = null, onChange = () => {}, maxNumeros = 100, buscadorActivo = true, actualizacionAutomatica = true }) {
  const MAX_ELEGIDOS = Number.isInteger(maxNumeros) ? Math.max(1, Math.min(100, maxNumeros)) : 100;
  const [pagina, setPagina] = useState(Number(inicio));
  const [numeros, setNumeros] = useState([]);
  const [elegidos, setElegidos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaPendiente, setBusquedaPendiente] = useState(null);
  const [mensajeBusqueda, setMensajeBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const busquedaId = useRef(0);
  const paginaRef = useRef(Number(inicio));
  const cargarRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const ancho = Math.max(3, String(fin).length);
  const formato = useCallback((n) => String(n).padStart(ancho, "0"), [ancho]);
  const minimo = Number(inicio);
  const maximo = Number(fin);
  const cargar = useCallback(async (desde, forzar = false) => {
    if (!rifaId) return;
    const id = ++requestId.current;
    const clave = `${rifaId}:${minimo}:${maximo}:${desde}`;
    const cache = cachePaginas.get(clave);
    paginaRef.current = desde;
    setPagina(desde);
    setError("");
    setCargando(true);
    if (!forzar && cache && Date.now() - cache.fecha < CACHE_MS) {
      setNumeros(cache.numeros);
      setCargando(false);
      return;
    }
    try {
      const res = await fetch(`/api/numeros-disponibles?rifaId=${encodeURIComponent(rifaId)}&desde=${desde}`, { cache: "no-store" });
      const data = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok || !data.ok || !Array.isArray(data.numeros)) throw new Error(data.error || "No se pudo cargar la disponibilidad");
      // Una página completa de 100 números; solo se consulta el bloque visible.
      const visibles = data.numeros.slice(0, TAMANO);
      cachePaginas.set(clave, { fecha: Date.now(), numeros: visibles });
      if (cachePaginas.size > 30) cachePaginas.delete(cachePaginas.keys().next().value);
      setNumeros(visibles);
      setElegidos(prev => {
        const quitados = prev.filter(n => visibles.some(x => x.numero === n && !x.disponible));
        if (quitados.length) {
          setMensajeBusqueda(`Se quitaron ${quitados.length} número(s) de tu selección porque ya no están disponibles.`);
        }
        return quitados.length ? prev.filter(n => !quitados.includes(n)) : prev;
      });
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e.message || "No pudimos cargar los números");
      setNumeros([]);
    } finally {
      if (id === requestId.current) setCargando(false);
    }
  }, [rifaId, minimo, maximo]);
  useEffect(() => {
    setElegidos([]);
    setBusqueda("");
    setBusquedaPendiente(null);
    setMensajeBusqueda("");
    cargar(minimo);
    return () => { requestId.current += 1; };
  }, [rifaId, minimo, cargar]);
  useEffect(() => { onChangeRef.current?.(elegidos); }, [elegidos]);
  useEffect(() => { cargarRef.current = cargar; }, [cargar]);
  // Actualización suave: una consulta por página visible cada 45 s como máximo.
  // Si la pestaña está oculta, no se realizan consultas periódicas.
  useEffect(() => {
    if (!rifaId || !actualizacionAutomatica) return;
    const actualizar = () => {
      if (document.visibilityState === "visible") {
        cargarRef.current?.(paginaRef.current, true);
      }
    };
    const intervalo = window.setInterval(actualizar, REFRESH_MS);
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      const clave = `${rifaId}:${minimo}:${maximo}:${paginaRef.current}`;
      const entrada = cachePaginas.get(clave);
      if (!entrada || Date.now() - entrada.fecha >= REFRESH_MS) actualizar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [rifaId, minimo, maximo, actualizacionAutomatica]);
  useEffect(() => { setElegidos(prev => prev.length > MAX_ELEGIDOS ? prev.slice(0, MAX_ELEGIDOS) : prev); }, [MAX_ELEGIDOS]);
  useEffect(() => { if (!buscadorActivo) { setBusquedaPendiente(null); setBusqueda(""); } }, [buscadorActivo]);
  const seleccionados = useMemo(() => new Set(elegidos), [elegidos]);
  const disponibles = numeros.filter(n => n.disponible).length;
  const buscar = () => {
    if (!buscadorActivo) return;
    const texto = busqueda.trim();
    const numero = Number(texto);
    setMensajeBusqueda("");
    if (!/^\d+$/.test(texto) || !Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
      setError(`Ingresa un número entre ${formato(minimo)} y ${formato(maximo)}.`);
      return;
    }
    setError("");
    const desde = minimo + Math.floor((numero - minimo) / TAMANO) * TAMANO;
    setBusquedaPendiente({ numero, id: ++busquedaId.current });
    cargar(desde, true);
  };
  // Seleccionar solamente después de verificar la disponibilidad de la página.
  // No marcar como reservado: la reserva real se realizará en el servidor.
  useEffect(() => {
    if (!buscadorActivo || !busquedaPendiente || cargando || error) return;
    const objetivo = numeros.find(n => n.numero === busquedaPendiente.numero);
    if (!objetivo || pagina !== (minimo + Math.floor((busquedaPendiente.numero - minimo) / TAMANO) * TAMANO)) return;
    if (!objetivo.disponible) {
      setMensajeBusqueda(`El número ${formato(objetivo.numero)} ${objetivo.estado === "solo_azar" ? "solo está disponible al azar" : objetivo.estado === "reservado" ? "está reservado" : "ya está ocupado"}.`);
    } else {
      if (elegidos.includes(objetivo.numero)) {
        setMensajeBusqueda(`El número ${formato(objetivo.numero)} ya está seleccionado.`);
      } else if (elegidos.length >= MAX_ELEGIDOS) {
        setMensajeBusqueda(`Has alcanzado el máximo de ${MAX_ELEGIDOS} números.`);
      } else {
        setElegidos(prev => prev.includes(objetivo.numero) || prev.length >= MAX_ELEGIDOS
          ? prev : [...prev, objetivo.numero].sort((a, b) => a - b));
        setMensajeBusqueda(`Número ${formato(objetivo.numero)} añadido a tu selección.`);
      }
    }
    setBusquedaPendiente(null);
  }, [busquedaPendiente, cargando, error, numeros, formato, pagina, minimo, elegidos, MAX_ELEGIDOS, buscadorActivo]);
  const alternar = (numero) => setElegidos(prev => prev.includes(numero)
    ? prev.filter(n => n !== numero)
    : prev.length >= MAX_ELEGIDOS ? prev : [...prev, numero].sort((a, b) => a - b));
  return (
    <section className="sp" aria-label="Elegir números de boleto">
      <style>{`
        .sp{--rojo:#c40000;background:#fff;color:#152033;border:1px solid #e7eaf0;border-radius:18px;overflow:hidden;box-shadow:0 8px 26px rgba(16,24,40,.06);font-family:inherit}
        .sp *{box-sizing:border-box}.sp button{font-family:inherit}
        .sp__top{background:linear-gradient(135deg,#fff,#fff8f8);border-bottom:1px solid #f0e4e4;padding:19px 18px 16px}
        .sp__kicker{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:900;color:#a31313;letter-spacing:.9px;background:#ffe8e8;padding:6px 9px;border-radius:99px;margin-bottom:9px}
        .sp__title{font-size:22px;font-weight:900;line-height:1.25;color:#172033;margin:0 0 5px}
        .sp__subtitle{font-size:12px;color:#5f6b7b;line-height:1.5;margin:0}
        .sp__body{padding:16px}.sp__searchlabel{display:block;font-size:12px;font-weight:800;color:#273347;margin-bottom:7px}
        .sp__search{display:flex;gap:8px}.sp__input{width:100%;min-width:0;flex:1;background:#fff;color:#111827;border:1px solid #d9dee8;border-radius:10px;padding:12px;font-size:14px;outline:none}
        .sp__input:focus{border-color:var(--rojo);box-shadow:0 0 0 3px #c400001a}.sp__primary{background:var(--rojo);color:white;border:0;border-radius:10px;padding:11px 15px;font-size:12px;font-weight:900;cursor:pointer}
        .sp__primary:disabled{opacity:.5;cursor:not-allowed}.sp__legend{display:flex;flex-wrap:wrap;gap:9px 14px;margin:14px 0;color:#586579;font-size:11px}
        .sp__legenditem{display:inline-flex;align-items:center;gap:5px}.sp__sample{height:12px;width:12px;border:1px solid #d7dce5;border-radius:4px;background:white}.sp__sample--picked{background:#c40000;border-color:#c40000}.sp__sample--busy{background:#e7e9ee;border-color:#e7e9ee}
        .sp__nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 12px}.sp__navbtn{background:#f6f7f9;border:1px solid #e2e6ed;color:#273247;border-radius:9px;padding:9px 11px;font-size:11px;font-weight:800;cursor:pointer}
        .sp__navbtn:disabled{opacity:.4;cursor:not-allowed}.sp__range{text-align:center;font-size:13px;color:#19243a;font-weight:900}.sp__range small{display:block;font-size:10px;font-weight:600;color:#697789;margin-top:3px}
        .sp__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;min-height:120px}.sp__num{min-width:0;min-height:45px;border-radius:10px;border:1px solid #dce2ea;background:white;color:#1e293b;font-size:13px;font-weight:900;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}
        .sp__num:hover:not(:disabled){border-color:#c40000;transform:translateY(-1px);background:#fff7f7}.sp__num[aria-pressed=true]{background:#c40000;color:white;border-color:#c40000;box-shadow:0 4px 10px #c4000029}
        .sp__num:disabled{background:#f1f2f5;color:#7e8797;border-color:#dce0e6;cursor:not-allowed;position:relative;overflow:hidden;opacity:1}
        .sp__num--busy::after{content:"";position:absolute;left:17%;top:50%;width:66%;height:3px;background:#d20a0a;border-radius:5px;transform:rotate(-27deg);box-shadow:0 1px 2px #fff9;pointer-events:none}
        .sp__sample--busy{position:relative;overflow:hidden}.sp__sample--busy::after{content:"";position:absolute;left:1px;top:5px;width:11px;height:2px;background:#d20a0a;transform:rotate(-35deg)}
        .sp__num--reservado:disabled{background:#fef3c7;color:#92400e;border-color:#f59e0b}.sp__num--azar:disabled{background:#dcfce7;color:#166534;border-color:#22c55e}.sp__loading{font-size:12px;color:#64748b;text-align:center;padding:25px 0;grid-column:1/-1}
        .sp__bottom{border-top:1px solid #e8ebf0;background:#fafbfc;padding:16px 18px 18px}.sp__totals{display:flex;justify-content:space-between;gap:12px;align-items:center}.sp__meta{font-size:10px;font-weight:800;color:#64748b;letter-spacing:.4px}
        .sp__value{display:block;font-size:23px;font-weight:900;color:#172033;margin-top:4px}.sp__price{text-align:right}.sp__price .sp__value{color:#bd0000}.sp__chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px;max-height:85px;overflow:auto}
        .sp__chip{border:1px solid #f1bcbc;border-radius:8px;background:#fff0f0;color:#a00000;font-weight:800;font-size:12px;padding:7px 9px;cursor:pointer}.sp__clear{background:#fff;color:#4b5563;border:1px solid #dce1e9;border-radius:9px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer;margin-top:12px}
        .sp__clear:disabled{opacity:.4;cursor:not-allowed}.sp__tip{font-size:11px;color:#697789;line-height:1.5;margin:12px 0 0}.sp__notice{font-size:11px;color:#81520d;background:#fff8e9;border:1px solid #f4dfb7;border-radius:9px;padding:10px 12px;line-height:1.5;margin-top:13px}
        .sp__searchhint{font-size:11px;color:#5d687b;margin:6px 0 0}.sp__success{font-size:12px;color:#166534;background:#effcf3;border:1px solid #bbebcb;padding:9px 11px;border-radius:9px;margin:10px 0}.sp__error{font-size:12px;color:#a30000;background:#fff2f2;border:1px solid #f4cccc;padding:10px;border-radius:9px;margin:12px 0}
        @media(min-width:520px){.sp__grid{grid-template-columns:repeat(6,minmax(0,1fr))}.sp__body{padding:19px}.sp__num{min-height:46px}}
        @media(prefers-reduced-motion:reduce){.sp__num{transition:none}}
      `}</style>
      <div className="sp__top">
        <span className="sp__kicker">🎟️ SELECCIÓN PERSONALIZADA</span>
        <h3 className="sp__title">Elige tus números</h3>
        <p className="sp__subtitle">Explora 100 números por página{buscadorActivo ? ", busca tus favoritos" : ""} y elige hasta {MAX_ELEGIDOS} boletos.</p>
      </div>
      <div className="sp__body">
        {buscadorActivo && <>
        <label className="sp__searchlabel" htmlFor="sp-buscar">¿Tienes un número favorito?</label>
        <div className="sp__search"><input id="sp-buscar" className="sp__input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={ancho} autoComplete="off" aria-describedby="sp-rango" placeholder={`Del ${formato(minimo)} al ${formato(maximo)}`} value={busqueda} onChange={e => { const valor = e.target.value.replace(/\D/g, "").slice(0, ancho); setBusqueda(valor); setError(""); setMensajeBusqueda(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} /><button className="sp__primary" type="button" onClick={buscar} disabled={cargando || !busqueda.trim()}>Buscar y elegir</button></div><p id="sp-rango" className="sp__searchhint">Rango permitido: <strong>{formato(minimo)} – {formato(maximo)}</strong>. Al buscar un número disponible, se añade automáticamente a tu selección.</p></>}
        {mensajeBusqueda && <div className="sp__success" role="status">{mensajeBusqueda}</div>}
        <div className="sp__legend"><span className="sp__legenditem"><i className="sp__sample"/> Disponible</span><span className="sp__legenditem"><i className="sp__sample sp__sample--picked"/> Seleccionado</span><span className="sp__legenditem"><i className="sp__sample sp__sample--busy"/> Vendido / ocupado</span><span>🔒 Reservado</span><span>🍀🔒 Solo al azar</span></div>
        {error && <div className="sp__error" role="alert">{error} <button type="button" className="sp__navbtn" onClick={() => cargar(pagina, true)}>Reintentar</button></div>}
        <div className="sp__nav"><button type="button" className="sp__navbtn" disabled={cargando || pagina <= minimo} onClick={() => cargar(Math.max(minimo, pagina - TAMANO), true)}>← 100 anteriores</button><span className="sp__range">{formato(pagina)} – {formato(Math.min(maximo, pagina + TAMANO - 1))}<small>{cargando ? "Consultando..." : `${disponibles} disponibles`}</small></span><button type="button" className="sp__navbtn" disabled={cargando || pagina + TAMANO > maximo} onClick={() => cargar(pagina + TAMANO, true)}>Siguientes 100 →</button></div>
        <button type="button" className="sp__navbtn" disabled={cargando} onClick={() => cargar(pagina, true)}>↻ Actualizar disponibilidad</button>
        <div className="sp__grid" aria-busy={cargando}>{cargando ? <div className="sp__loading">Consultando disponibilidad…</div> : numeros.map(({ numero, disponible, estado }) => <button key={numero} type="button" className={`sp__num${estado === "solo_azar" ? " sp__num--azar" : estado === "reservado" ? " sp__num--reservado" : !disponible ? " sp__num--busy" : ""}`} disabled={!disponible} aria-pressed={seleccionados.has(numero)} aria-label={`Número ${formato(numero)}: ${!disponible ? (estado||"ocupado") : seleccionados.has(numero) ? "seleccionado" : "disponible"}`} onClick={() => alternar(numero)}>{formato(numero)}{estado==="solo_azar"?" 🍀🔒":estado==="reservado"?" 🔒":""}</button>)}</div>
      </div>
      <div className="sp__bottom"><div className="sp__totals"><div><span className="sp__meta">NÚMEROS ELEGIDOS</span><strong className="sp__value">{elegidos.length} <small style={{fontSize:12,color:"#718096"}}>/ {MAX_ELEGIDOS}</small></strong></div><div className="sp__price"><span className="sp__meta">TOTAL ESTIMADO</span><strong className="sp__value">${(elegidos.length * Number(precio || 0)).toFixed(2)} USD</strong>{pagoMovil && (Number.isFinite(Number(tasaBcv)) && Number(tasaBcv) > 0 ? <div style={{marginTop:7,fontSize:14,fontWeight:900,color:"#172033"}}>Bs. {new Intl.NumberFormat("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(elegidos.length * Number(precio || 0) * Number(tasaBcv))}</div> : <div style={{marginTop:7,fontSize:11,color:"#b45309"}}>Tasa BCV no disponible</div>)}</div></div>
        {elegidos.length ? <><p className="sp__tip">Toca un número de esta lista para quitarlo:</p><div className="sp__chips">{elegidos.map(n => <button key={n} type="button" className="sp__chip" onClick={() => alternar(n)} aria-label={`Quitar ${formato(n)}`}>{formato(n)} ×</button>)}</div></> : <p className="sp__tip">Selecciona tus números para ver el total.</p>}
        <button type="button" className="sp__clear" disabled={!elegidos.length} onClick={() => setElegidos([])}>Limpiar selección</button>
        <p className="sp__notice">🔒 {actualizacionAutomatica ? "Disponibilidad actualizada automáticamente cada 45 segundos mientras esta pestaña esté visible." : "Disponibilidad consultada al navegar o actualizar manualmente."} La disponibilidad se confirma al enviar la compra. Si otro cliente ocupa un número seleccionado en otra página, el servidor rechazará esa selección. Los números se reservan durante 24 horas mientras se revisa el pago.</p>
      </div>
    </section>
  );
}
