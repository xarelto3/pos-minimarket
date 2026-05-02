import { useState } from "react";

const CLIENTES_INICIALES = [
  {
    id: "luchin",
    nombre: "Almacén Luchin",
    direccion: "Av. Esmeralda 3000, El Tabo",
    whatsapp: "+56950690075",
    admin: "Nicol",
    activo: true,
    vencimiento: "2026-06-01",
    url: "pos-almacen-luchin.vercel.app"
  }
];

function diasRestantes(fecha) {
  if (!fecha) return null;
  const diff = new Date(fecha) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function PanelClientes() {
  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [error, setError] = useState("");
  const [clientes, setClientes] = useState(() => {
    try {
      const g = localStorage.getItem("mis_clientes");
      return g ? JSON.parse(g) : CLIENTES_INICIALES;
    } catch { return CLIENTES_INICIALES; }
  });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState({
    nombre: "", direccion: "", whatsapp: "",
    admin: "", vencimiento: "", url: ""
  });

  function guardar(lista) {
    setClientes(lista);
    localStorage.setItem("mis_clientes", JSON.stringify(lista));
  }

  function verificar() {
    if (clave === "JUAN2024") {
      setAutenticado(true);
      setError("");
    } else {
      setError("Clave incorrecta");
    }
  }

  function toggleActivo(id) {
    guardar(clientes.map(c => c.id === id ? { ...c, activo: !c.activo } : c));
  }

  function agregar() {
    if (!nuevo.nombre) return;
    guardar([...clientes, { ...nuevo, id: Date.now().toString(), activo: true }]);
    setNuevo({ nombre: "", direccion: "", whatsapp: "", admin: "", vencimiento: "", url: "" });
    setMostrarForm(false);
  }

  function eliminar(id) {
    if (window.confirm("¿Eliminar cliente?")) guardar(clientes.filter(c => c.id !== id));
  }

  // Pantalla de login
  if (!autenticado) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0f0f1a",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "sans-serif"
      }}>
        <div style={{
          background: "#1a1f2e", borderRadius: 16, padding: 32,
          width: 300, textAlign: "center", border: "1px solid #d4a017"
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ color: "#d4a017", marginBottom: 4, fontSize: 16 }}>Panel de Clientes</h2>
          <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>Solo para el administrador maestro</p>
          <input
            type="password"
            placeholder="Clave maestra"
            value={clave}
            onChange={e => { setClave(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && verificar()}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid #374151", background: "#111827",
              color: "#fff", fontSize: 14, marginBottom: 8, boxSizing: "border-box"
            }}
          />
          {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</p>}
          <button onClick={verificar} style={{
            width: "100%", padding: 10, borderRadius: 8, border: "none",
            background: "#d4a017", color: "#111", fontWeight: 700,
            fontSize: 14, cursor: "pointer"
          }}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  // Panel principal
  return (
    <div style={{
      minHeight: "100vh", background: "#0f0f1a",
      fontFamily: "sans-serif", padding: "20px 16px"
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ color: "#d4a017", fontSize: 20, fontWeight: 800, margin: 0 }}>🏪 Mis Clientes</h1>
          <button onClick={() => setAutenticado(false)} style={{
            padding: "6px 14px", borderRadius: 8, border: "none",
            background: "#374151", color: "#fff", fontSize: 12, cursor: "pointer"
          }}>
            Salir
          </button>
        </div>

        {/* Lista de clientes */}
        {clientes.map(c => {
          const dias = diasRestantes(c.vencimiento);
          return (
            <div key={c.id} style={{
              background: "#1a1a2e", borderRadius: 12, padding: 16,
              marginBottom: 12, border: `1px solid ${c.activo ? "#16a34a33" : "#dc262633"}`
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>{c.nombre}</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 2px" }}>{c.direccion}</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 2px" }}>Admin: {c.admin}</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 6px" }}>📱 {c.whatsapp}</p>
                  {c.url && <p style={{ color: "#60a5fa", fontSize: 11, margin: "0 0 6px" }}>🔗 {c.url}</p>}
                  {dias !== null && (
                    <p style={{ color: dias <= 7 ? "#ef4444" : "#d4a017", fontSize: 12, margin: 0, fontWeight: 600 }}>
                      {dias > 0 ? `⏳ Vence en ${dias} días` : `⚠️ Venció hace ${Math.abs(dias)} días`}
                    </p>
                  )}
                </div>
                <span style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: c.activo ? "#16a34a" : "#dc2626", color: "#fff"
                }}>
                  {c.activo ? "ACTIVO" : "INACTIVO"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => toggleActivo(c.id)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: c.activo ? "#dc2626" : "#16a34a",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer"
                }}>
                  {c.activo ? "⏸ Desactivar" : "▶ Activar"}
                </button>
                <button onClick={() => eliminar(c.id)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: "#374151", color: "#fff", fontSize: 12, cursor: "pointer"
                }}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}

        {/* Formulario nuevo cliente */}
        {!mostrarForm ? (
          <button onClick={() => setMostrarForm(true)} style={{
            width: "100%", padding: 12, borderRadius: 10, border: "none",
            background: "#2563eb", color: "#fff", fontSize: 14,
            fontWeight: 700, cursor: "pointer", marginTop: 4
          }}>
            + Agregar nuevo cliente
          </button>
        ) : (
          <div style={{
            background: "#1a1a2e", borderRadius: 12, padding: 16,
            border: "1px solid #2563eb", marginTop: 4
          }}>
            <p style={{ color: "#60a5fa", fontWeight: 700, marginBottom: 12 }}>Nuevo cliente</p>
            {[
              ["nombre", "Nombre del local *"],
              ["direccion", "Dirección"],
              ["whatsapp", "WhatsApp (+56...)"],
              ["admin", "Nombre del administrador"],
              ["url", "URL del POS"],
              ["vencimiento", "Fecha vencimiento (2026-06-01)"]
            ].map(([key, ph]) => (
              <input key={key} type="text" placeholder={ph}
                value={nuevo[key]}
                onChange={e => setNuevo(p => ({ ...p, [key]: e.target.value }))}
                style={{
                  width: "100%", background: "#111827", border: "1px solid #374151",
                  borderRadius: 8, padding: "8px 12px", color: "#fff",
                  fontSize: 13, marginBottom: 8, boxSizing: "border-box"
                }}
              />
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={agregar} style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer"
              }}>✓ Guardar</button>
              <button onClick={() => setMostrarForm(false)} style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#374151", color: "#fff", cursor: "pointer"
              }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
