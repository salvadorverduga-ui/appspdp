import { useState, useEffect, useCallback } from "react";

// ──────────────────────────────────────────────
//  CONFIG — reemplazar con tu Google Sheets URL
//  (publicar hoja como CSV: Archivo > Compartir >
//   Publicar en la web > CSV > obtener URL)
// ──────────────────────────────────────────────
const SHEETS_CONFIG = {
  // Formato: https://docs.google.com/spreadsheets/d/TU_ID/gviz/tq?tqx=out:csv&sheet=Resoluciones
  RESOLUCIONES_CSV_URL: "https://docs.google.com/spreadsheets/d/TU_SHEET_ID/gviz/tq?tqx=out:csv&sheet=Resoluciones",
  CONSULTAS_CSV_URL:    "https://docs.google.com/spreadsheets/d/TU_SHEET_ID/gviz/tq?tqx=out:csv&sheet=Consultas",
};

// ──────────────────────────────────────────────
//  DATOS DEMO (se usan si no hay Sheet configurada)
// ──────────────────────────────────────────────
const DEMO_RESOLUCIONES = [
  { id: "a1b2c", titulo: "RESOLUCIÓN N° SPDP-SPD-2026-0005-R — NORMA GENERAL SOBRE EL TRATAMIENTO DE DATOS PERSONALES A GRAN ESCALA", urlPdf: "https://spdp.gob.ec", resumen: "**Tipo:** Norma General\n**Tema:** Tratamiento masivo de datos\n**Obligaciones clave:**\n- Análisis de riesgo previo obligatorio para tratamientos a gran escala\n- Designación de DPD obligatoria en estos casos\n- Registro de actividades detallado\n**Impacto DaVita:** Alto — aplica directamente al tratamiento de datos de pacientes renales en 14 entidades\n**Urgencia:** Alta", categoria: "📗 Normativa", fechaDeteccion: "2026-04-14T10:22:00Z", notificado: "SÍ" },
  { id: "d3e4f", titulo: "RESOLUCIÓN N° SPDP-SPD-2025-0041-R — NORMATIVA GENERAL PARA LA APLICACIÓN DEL INTERÉS LEGÍTIMO", urlPdf: "https://spdp.gob.ec", resumen: "**Tipo:** Normativa General\n**Tema:** Interés legítimo como base de legitimación\n**Obligaciones clave:**\n- Test de ponderación obligatorio\n- Documentación del análisis\n- Derecho de oposición reforzado\n**Impacto DaVita:** Medio — revisar bases de legitimación actuales\n**Urgencia:** Media", categoria: "📗 Normativa", fechaDeteccion: "2026-03-01T08:00:00Z", notificado: "SÍ" },
  { id: "g5h6i", titulo: "RESOLUCIÓN N° SPDP-SPD-2025-0034-R — REGLAMENTO DE EVALUACIÓN Y REVISIÓN DE LA LOPDP", urlPdf: "https://spdp.gob.ec", resumen: "**Tipo:** Reglamento procedimental\n**Tema:** Evaluación periódica de la ley\n**Impacto DaVita:** Bajo en lo inmediato — proceso interno de la SPDP\n**Urgencia:** Baja", categoria: "📜 Reglamento", fechaDeteccion: "2026-02-15T09:30:00Z", notificado: "SÍ" },
  { id: "j7k8l", titulo: "RESOLUCIÓN N° SPDP-SPD-2025-0028-R — REGLAMENTO DEL DELEGADO DE PROTECCIÓN DE DATOS PERSONALES", urlPdf: "https://spdp.gob.ec", resumen: "**Tipo:** Reglamento\n**Tema:** Perfil, obligaciones y registro del DPD\n**Obligaciones clave:**\n- Título de tercer nivel requerido\n- Certificaciones a registrar en plataforma SPDP\n- Plazo: 6 meses desde publicación\n**Impacto DaVita:** CRÍTICO — aplica directamente a tu función como DPO\n**Urgencia:** Alta", categoria: "👤 DPD/DPO", fechaDeteccion: "2026-01-10T11:00:00Z", notificado: "SÍ" },
  { id: "m9n0o", titulo: "RESOLUCIÓN N° SPDP-SPD-2025-0006-R — CLÁUSULAS DE PROTECCIÓN DE DATOS EN CONTRATOS", urlPdf: "https://spdp.gob.ec", resumen: "**Tipo:** Reglamento contractual\n**Tema:** Obligación de incluir cláusulas de datos en contratos\n**Obligaciones clave:**\n- Revisión de contratos vigentes con proveedores\n- Modelos referenciales en Anexo I\n**Impacto DaVita:** Alto — aplica a todos los contratos con encargados del tratamiento\n**Urgencia:** Alta", categoria: "📋 Contratos", fechaDeteccion: "2025-12-05T09:00:00Z", notificado: "SÍ" },
];

const DEMO_CONSULTAS = [
  { id: "c1d2e", titulo: "Consulta sobre código dactilar en nombramientos — SCVS", tema: "Consentimiento", resumen: "La SPDP determinó que exigir el código dactilar junto a la cédula en nombramientos de representantes legales es desproporcionado. Vulnera los principios de finalidad, pertinencia y minimización. La cédula sola es suficiente para identificación inequívoca.", fechaDeteccion: "2026-04-10T14:00:00Z", notificado: "SÍ" },
  { id: "f3g4h", titulo: "Consulta sobre proceso de reconocimiento por buenas prácticas", tema: "General LOPDP", resumen: "La SPDP se abstuvo de pronunciarse por ser consulta sobre normativa inexistente. La institución se encuentra en etapa de arranque. Relevancia DPO: monitorear futuras regulaciones sobre programas de cumplimiento.", fechaDeteccion: "2026-03-22T10:30:00Z", notificado: "SÍ" },
];

// ──────────────────────────────────────────────
//  UTILIDADES
// ──────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (let c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === "," && !inQ) { vals.push(cur); cur = ""; }
      else cur += c;
    }
    vals.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h.toLowerCase().replace(/\s+/g,""), vals[i] ? vals[i].replace(/"/g,"").trim() : ""]));
  });
}

function formatFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso.substring(0, 10); }
}

function renderResumen(texto) {
  if (!texto) return null;
  return texto.split("\n").map((line, i) => {
    if (!line.trim()) return null;
    const html = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `<strong>${m}</strong>`);
    return <p key={i} style={{ margin: "3px 0", fontSize: "13px", lineHeight: "1.6" }} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

const URGENCIA_COLOR = { alta: "#e53935", media: "#f57c00", baja: "#43a047" };
const URGENCIA_BG   = { alta: "#ffeaea", media: "#fff3e0", baja: "#e8f5e9" };

function getUrgencia(resumen) {
  const u = (resumen || "").toLowerCase();
  if (u.includes("urgencia:** alta") || u.includes("urgencia: alta")) return "alta";
  if (u.includes("urgencia:** media") || u.includes("urgencia: media")) return "media";
  return "baja";
}

// ──────────────────────────────────────────────
//  COMPONENTES UI
// ──────────────────────────────────────────────
function Badge({ children, color = "#4a4ae0", bg = "#ededff" }) {
  return (
    <span style={{
      display: "inline-block", background: bg, color,
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.4px",
      padding: "2px 9px", borderRadius: "20px", textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

function ResolucionCard({ item, expanded, onToggle }) {
  const urgencia = getUrgencia(item.resumen);
  return (
    <div style={{
      background: "#fff", borderRadius: "10px",
      border: `1px solid #e4e4f0`,
      borderLeft: `4px solid ${URGENCIA_COLOR[urgencia]}`,
      marginBottom: "14px", overflow: "hidden",
      transition: "box-shadow 0.2s",
      boxShadow: expanded ? "0 4px 20px rgba(74,74,224,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div
        onClick={onToggle}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "12px" }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px", alignItems: "center" }}>
            <Badge color={URGENCIA_COLOR[urgencia]} bg={URGENCIA_BG[urgencia]}>{urgencia}</Badge>
            {item.categoria && <span style={{ fontSize: "12px", color: "#666" }}>{item.categoria}</span>}
            <span style={{ fontSize: "11px", color: "#aaa", marginLeft: "auto" }}>{formatFecha(item.fechaDeteccion)}</span>
          </div>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1a1a2e", lineHeight: 1.4 }}>
            {item.titulo}
          </p>
        </div>
        <span style={{ color: "#aaa", fontSize: "18px", userSelect: "none", flexShrink: 0, marginTop: "2px" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #f0f0f8", padding: "14px 18px", background: "#fafaff" }}>
          <div style={{ background: "#fff", padding: "14px", borderRadius: "7px", border: "1px solid #ededff", marginBottom: "12px" }}>
            {renderResumen(item.resumen)}
          </div>
          {item.urlPdf && item.urlPdf !== "" && (
            <a href={item.urlPdf} target="_blank" rel="noreferrer"
              style={{ display: "inline-block", background: "#4a4ae0", color: "#fff", padding: "7px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
              📄 Ver resolución completa →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ConsultaCard({ item, expanded, onToggle }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "10px",
      border: "1px solid #e4f0e8", borderLeft: "4px solid #00b894",
      marginBottom: "14px", overflow: "hidden",
      boxShadow: expanded ? "0 4px 20px rgba(0,184,148,0.10)" : "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div onClick={onToggle} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px", alignItems: "center" }}>
            {item.tema && <Badge color="#00695c" bg="#e0f7f1">{item.tema}</Badge>}
            <span style={{ fontSize: "11px", color: "#aaa", marginLeft: "auto" }}>{formatFecha(item.fechaDeteccion)}</span>
          </div>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1a1a2e", lineHeight: 1.4 }}>
            {item.titulo}
          </p>
        </div>
        <span style={{ color: "#aaa", fontSize: "18px", userSelect: "none", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #e0f7f1", padding: "14px 18px", background: "#f5fffb" }}>
          <div style={{ background: "#fff", padding: "14px", borderRadius: "7px", border: "1px solid #b2dfdb" }}>
            {renderResumen(item.resumen)}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
//  PANTALLA PRINCIPAL
// ──────────────────────────────────────────────
export default function SPDPDashboard() {
  const [tab, setTab] = useState("resoluciones");
  const [resoluciones, setResoluciones] = useState(DEMO_RESOLUCIONES);
  const [consultas, setConsultas] = useState(DEMO_CONSULTAS);
  const [expandedId, setExpandedId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [cargando, setCargando] = useState(false);
  const [modoDemo, setModoDemo] = useState(true);

  const cargarDesdeSheets = useCallback(async () => {
    if (SHEETS_CONFIG.RESOLUCIONES_CSV_URL.includes("TU_SHEET_ID")) return;
    setCargando(true);
    try {
      const [rRes, rCon] = await Promise.all([
        fetch(SHEETS_CONFIG.RESOLUCIONES_CSV_URL),
        fetch(SHEETS_CONFIG.CONSULTAS_CSV_URL),
      ]);
      const [csvRes, csvCon] = await Promise.all([rRes.text(), rCon.text()]);
      const res = parseCSV(csvRes).map(r => ({
        id: r.id, titulo: r.título || r.titulo, urlPdf: r.urlpdf || r["urlpdf"],
        resumen: r.resumen, categoria: r.categoría || r.categoria,
        fechaDeteccion: r.fechadetección || r.fechadeteccion, notificado: r.notificado,
      }));
      const con = parseCSV(csvCon).map(c => ({
        id: c.id, titulo: c["título/extracto"] || c.titulo, tema: c.tema,
        resumen: c.resumen, fechaDeteccion: c.fechadetección || c.fechadeteccion, notificado: c.notificado,
      }));
      if (res.length > 0) setResoluciones(res);
      if (con.length > 0) setConsultas(con);
      setModoDemo(false);
    } catch (e) {
      console.warn("No se pudo conectar con Google Sheets:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarDesdeSheets(); }, [cargarDesdeSheets]);

  const categorias = ["Todas", ...new Set(resoluciones.map(r => r.categoria).filter(Boolean))];

  const resFiltradas = resoluciones.filter(r => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || r.titulo?.toLowerCase().includes(q) || r.resumen?.toLowerCase().includes(q);
    const matchC = filtroCategoria === "Todas" || r.categoria === filtroCategoria;
    return matchQ && matchC;
  });

  const conFiltradas = consultas.filter(c => {
    const q = busqueda.toLowerCase();
    return !q || c.titulo?.toLowerCase().includes(q) || c.resumen?.toLowerCase().includes(q) || c.tema?.toLowerCase().includes(q);
  });

  const altas = resoluciones.filter(r => getUrgencia(r.resumen) === "alta").length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0d1a 0%, #1a1a3e 50%, #0d1a2e 100%)",
      fontFamily: "'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    }}>
      {/* HEADER */}
      <div style={{ padding: "28px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "26px", letterSpacing: "1.5px", fontWeight: 700 }}>
              ⚖ SPDP Monitor
            </h1>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "13px", letterSpacing: "0.5px" }}>
              Superintendencia de Protección de Datos Personales · Ecuador
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {modoDemo && (
              <span style={{ background: "#f57c00", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px" }}>
                DEMO
              </span>
            )}
            <button
              onClick={cargarDesdeSheets}
              disabled={cargando}
              style={{
                background: cargando ? "rgba(255,255,255,0.1)" : "rgba(74,74,224,0.8)",
                color: "#fff", border: "none", borderRadius: "7px",
                padding: "8px 16px", fontSize: "12px", fontWeight: 700,
                cursor: cargando ? "default" : "pointer", letterSpacing: "0.5px",
              }}
            >
              {cargando ? "⟳ Cargando..." : "⟳ Actualizar"}
            </button>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
          {[
            { label: "Resoluciones", val: resoluciones.length, color: "#4a4ae0", icon: "📜" },
            { label: "Consultas", val: consultas.length, color: "#00b894", icon: "💬" },
            { label: "Urgencia alta", val: altas, color: "#e53935", icon: "🔴" },
          ].map(m => (
            <div key={m.label} style={{
              background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)",
              borderRadius: "10px", padding: "14px 20px", border: `1px solid ${m.color}40`,
              minWidth: "120px",
            }}>
              <div style={{ fontSize: "22px", fontWeight: 800, color: m.color }}>{m.icon} {m.val}</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginTop: "20px" }}>
          {[
            { key: "resoluciones", label: `📜 Resoluciones (${resFiltradas.length})` },
            { key: "consultas",    label: `💬 Consultas (${conFiltradas.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setExpandedId(null); }} style={{
              background: tab === t.key ? "#fff" : "rgba(255,255,255,0.08)",
              color: tab === t.key ? "#1a1a2e" : "rgba(255,255,255,0.6)",
              border: "none", borderRadius: "8px 8px 0 0", padding: "10px 20px",
              fontSize: "13px", fontWeight: tab === t.key ? 700 : 500,
              cursor: "pointer", transition: "all 0.2s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{
        background: "#f5f5ff", minHeight: "60vh",
        borderRadius: "0 12px 0 0", padding: "20px 28px 32px",
      }}>
        {/* BÚSQUEDA Y FILTROS */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar en título o resumen..."
            style={{
              flex: 1, minWidth: "200px", padding: "9px 14px",
              borderRadius: "7px", border: "1px solid #dde", fontSize: "13px",
              fontFamily: "inherit", outline: "none",
            }}
          />
          {tab === "resoluciones" && (
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              style={{
                padding: "9px 12px", borderRadius: "7px", border: "1px solid #dde",
                fontSize: "13px", fontFamily: "inherit", background: "#fff", outline: "none",
              }}
            >
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* LISTA */}
        {tab === "resoluciones" ? (
          resFiltradas.length === 0
            ? <p style={{ color: "#999", textAlign: "center", padding: "40px" }}>Sin resultados</p>
            : resFiltradas.map(r => (
              <ResolucionCard
                key={r.id}
                item={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              />
            ))
        ) : (
          conFiltradas.length === 0
            ? <p style={{ color: "#999", textAlign: "center", padding: "40px" }}>Sin resultados</p>
            : conFiltradas.map(c => (
              <ConsultaCard
                key={c.id}
                item={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              />
            ))
        )}

        {/* FOOTER */}
        <div style={{ marginTop: "24px", padding: "16px", background: "#ededff", borderRadius: "8px", fontSize: "12px", color: "#666" }}>
          <strong>⚙ Para conectar con tu Google Sheet:</strong> publicar hojas como CSV en <em>Archivo → Compartir → Publicar en la web</em>, luego reemplazar <code>TU_SHEET_ID</code> en la constante <code>SHEETS_CONFIG</code> de este archivo.
        </div>
      </div>
    </div>
  );
}
