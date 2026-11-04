
const fs = require("fs");
const path = require("path");

const archivo = path.join(
  process.cwd(),
  "src",
  "components",
  "admin",
  "RifasSection.jsx"
);

if (!fs.existsSync(archivo)) {
  throw new Error("No se encontró RifasSection.jsx");
}

let codigo = fs.readFileSync(archivo, "utf8").replace(/\r\n/g, "\n");

if (
  codigo.includes("function RifaFotosCarousel(") ||
  codigo.includes("const [busquedaRifas,")
) {
  throw new Error("Ya existen estas mejoras. No se cambió nada.");
}

function reemplazar(original, nuevo) {
  const partes = codigo.split(original);
  if (partes.length !== 2) {
    throw new Error("El archivo no coincide con el original. No se cambió nada.");
  }
  codigo = partes.join(nuevo);
}

reemplazar(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useState, useRef } from "react";'
);

reemplazar(
  'import { RefreshCcw } from "lucide-react";',
  'import { RefreshCcw, Search, ChevronLeft, ChevronRight } from "lucide-react";'
);

const carrusel = `
function RifaFotosCarousel({ rifa }) {
  const fotos = [
    { url: rifa.portada_url, nombre: "Portada principal" },
    { url: rifa.portada_scroll_url, nombre: "Portada secundaria" },
  ].filter((foto) => typeof foto.url === "string" && foto.url.trim());

  const [indice, setIndice] = useState(0);
  const inicioX = useRef(null);

  const cambiar = (paso) => {
    if (fotos.length < 2) return;
    setIndice((anterior) => (anterior + paso + fotos.length) % fotos.length);
  };

  const actual = fotos[indice] || fotos[0];

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        overflow: "hidden",
        background: "rgba(255,255,255,.03)",
        minHeight: 220,
        touchAction: "pan-y",
      }}
      onTouchStart={(e) => {
        inicioX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchCancel={() => {
        inicioX.current = null;
      }}
      onTouchEnd={(e) => {
        if (inicioX.current === null || fotos.length < 2) return;
        const distancia =
          (e.changedTouches[0]?.clientX ?? inicioX.current) -
          inicioX.current;
        inicioX.current = null;
        if (Math.abs(distancia) > 45) {
          cambiar(distancia < 0 ? 1 : -1);
        }
      }}
    >
      {actual ? (
        <img
          src={actual.url}
          alt={rifa.nombre || "Portada de rifa"}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: 260,
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div style={{
          minHeight: 220,
          display: "grid",
          placeItems: "center",
          color: "#94a3b8",
        }}>
          Sin portada
        </div>
      )}

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => cambiar(-1)}
            style={{
              position: "absolute",
              left: 10,
              top: "45%",
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "1px solid #ffffff55",
              background: "#111827dd",
              color: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            aria-label="Foto siguiente"
            onClick={() => cambiar(1)}
            style={{
              position: "absolute",
              right: 10,
              top: "45%",
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "1px solid #ffffff55",
              background: "#111827dd",
              color: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={20} />
          </button>

          <div style={{
            position: "absolute",
            bottom: 12,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}>
            {fotos.map((foto, i) => (
              <button
                key={foto.nombre}
                type="button"
                aria-label={foto.nombre}
                aria-pressed={i === indice}
                onClick={() => setIndice(i)}
                style={{
                  width: i === indice ? 24 : 9,
                  height: 9,
                  borderRadius: 20,
                  border: 0,
                  padding: 0,
                  background: i === indice ? "#a78bfa" : "#ffffffaa",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

`;

reemplazar(
  "export default function RifasSection({",
  carrusel + "export default function RifasSection({"
);

reemplazar(
  "  const [creandoRifa, setCreandoRifa] = useState(false);",
  `  const [busquedaRifas, setBusquedaRifas] = useState("");
  const [filtroRifas, setFiltroRifas] = useState("todas");
  const [creandoRifa, setCreandoRifa] = useState(false);`
);

const filtros = `
  const rifasFiltradas = useMemo(() => {
    const texto = busquedaRifas.trim().toLowerCase();

    return rifasOrdenadas.filter((rifa) => {
      const coincideTexto =
        !texto ||
        [rifa.nombre, rifa.premio, rifa.id, rifa.descripcion]
          .some((valor) =>
            String(valor ?? "").toLowerCase().includes(texto)
          );

      const estado = String(rifa.estado ?? "").toLowerCase();

      const coincideFiltro =
        filtroRifas === "todas" ||
        (filtroRifas === "activas" &&
          ["activa", "disponible", "publicada"].includes(estado)) ||
        (filtroRifas === "finalizadas" &&
          ["finalizada", "finalizado", "cerrada"].includes(estado)) ||
        (filtroRifas === "destacadas" && Boolean(rifa.destacada)) ||
        (filtroRifas === "publicadas" &&
          [true, 1, "1", "true"].includes(rifa.publicada));

      return coincideTexto && coincideFiltro;
    });
  }, [rifasOrdenadas, busquedaRifas, filtroRifas]);

`;

reemplazar(
  "  const resumenRifas = useMemo(() => {",
  filtros + "  const resumenRifas = useMemo(() => {"
);

const buscador = `
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
      }}>
        <label style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: "1 1 260px",
          minWidth: 0,
          border: "1px solid rgba(148,163,184,.22)",
          borderRadius: 14,
          padding: "0 12px",
          background: "rgba(255,255,255,.035)",
        }}>
          <Search size={18} color="#a78bfa" />
          <input
            type="search"
            aria-label="Buscar rifas"
            placeholder="Buscar por nombre, premio o ID..."
            value={busquedaRifas}
            onChange={(e) => setBusquedaRifas(e.target.value)}
            style={{
              width: "100%",
              minWidth: 0,
              padding: "13px 0",
              border: 0,
              outline: 0,
              color: "#f8fafc",
              background: "transparent",
            }}
          />
        </label>

        <select
          aria-label="Filtrar rifas"
          value={filtroRifas}
          onChange={(e) => setFiltroRifas(e.target.value)}
          style={{
            padding: "13px 14px",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,.22)",
            color: "#f8fafc",
            background: "#20222c",
            flex: "0 1 190px",
          }}
        >
          <option value="todas">Todas</option>
          <option value="activas">Activas</option>
          <option value="finalizadas">Finalizadas / cerradas</option>
          <option value="destacadas">Destacadas</option>
          <option value="publicadas">Publicadas</option>
        </select>

        <span style={{ color: "#94a3b8", fontSize: 13 }}>
          {rifasFiltradas.length} de {rifasOrdenadas.length} rifas
        </span>
      </div>

`;

reemplazar(
  "      {rifasOrdenadas.length === 0 ? (",
  buscador + "      {rifasFiltradas.length === 0 ? ("
);

reemplazar(
  "          No hay rifas disponibles o siguen cargando.",
  `          {rifasOrdenadas.length === 0
            ? "No hay rifas disponibles o siguen cargando."
            : "No hay rifas que coincidan con la búsqueda."}`
);

reemplazar(
  "          {rifasOrdenadas.map((rifa) => {",
  "          {rifasFiltradas.map((rifa) => {"
);

const inicio = codigo.indexOf(
  '                  <div\n                    style={{\n                      borderRadius: "22px",\n                      border: "1px solid rgba(148, 163, 184, 0.12)",\n                      overflow: "hidden",\n                      minHeight: "220px",'
);

const fin = codigo.indexOf(
  '                  <div style={{ display: "grid", gap: "14px" }}>',
  inicio
);

if (inicio < 0 || fin < 0) {
  throw new Error("No se encontró la portada original. No se cambió nada.");
}

codigo =
  codigo.slice(0, inicio) +
  "                  <RifaFotosCarousel rifa={rifa} />\n\n" +
  codigo.slice(fin);

const respaldo = archivo + ".backup-antes-buscador-carrusel";

if (fs.existsSync(respaldo)) {
  throw new Error("Ya existe una copia de seguridad. No se cambió nada.");
}

fs.copyFileSync(archivo, respaldo);
fs.writeFileSync(archivo, codigo, "utf8");

console.log("LISTO: buscador y carrusel agregados.");
console.log("Respaldo:", respaldo);
