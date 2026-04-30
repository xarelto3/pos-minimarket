import { useState, useRef, useEffect } from "react";

const MODOS = [
  { id: "vendedor", label: "👨‍💼 Vendedor", color: "#2563eb" },
  { id: "admin",    label: "🔐 Admin",    color: "#7c3aed" },
  { id: "cliente",  label: "🛒 Cliente",  color: "#16a34a" },
];

const SUGERENCIAS = {
  vendedor: [
    "¿Qué productos se están agotando?",
    "¿Cuánto llevo vendido hoy?",
    "Dame un tip para atender mejor",
    "¿Cómo manejo un cliente difícil?",
  ],
  admin: [
    "¿Cómo está el margen esta semana?",
    "¿Qué vendedor vendió más?",
    "¿Qué productos no se están moviendo?",
    "Dame un resumen del mes",
  ],
  cliente: [
    "Receta económica con pollo y arroz",
    "Almuerzo para 4 personas bajo $3.000",
    "¿Qué puedo hacer con lo que compré?",
    "Receta rápida de 20 minutos",
  ],
};

const SYSTEM_PROMPTS = {
  vendedor: `Eres el Genio de la Lámpara del Terminal POS, asistente del VENDEDOR de un minimarket chileno. 
Ayudas con ventas, inventario y atención al cliente. 
Responde en español chileno, breve (máximo 4 líneas), amigable y práctico. Usa emojis ocasionalmente.`,
  admin: `Eres el Genio de la Lámpara del Terminal POS, asistente del ADMINISTRADOR de un minimarket chileno. 
Ayudas con análisis de ventas, rentabilidad y gestión. Responde de forma ejecutiva y concisa (máximo 5 líneas).
Incluye siempre una recomendación accionable.`,
  cliente: `Eres el Genio de la Lámpara, chef de cocina económica chilena. 
Genera recetas breves, ricas y económicas (menos de $3.000 para 4 personas).
Formato: nombre del plato, ingredientes en lista corta, preparación en 3 pasos. Tono cálido y cercano.`,
};

async function askGenie(modo, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPTS[modo],
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "El genio está pensando... 🧞";
}

export default function GenioPOS() {
  const [modo, setModo]       = useState("vendedor");
  const [chats, setChats]     = useState({ vendedor: [], admin: [], cliente: [] });
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const mensajes = chats[modo];
  const color    = MODOS.find(m => m.id === modo).color;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, loading]);

  async function enviar(texto) {
    const msg = texto || input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg = { role: "user", content: msg };
    const newMsgs = [...chats[modo], userMsg];
    setChats(c => ({ ...c, [modo]: newMsgs }));
    setLoading(true);

    try {
      const reply = await askGenie(modo, newMsgs);
      setChats(c => ({
        ...c,
        [modo]: [...newMsgs, { role: "assistant", content: reply }],
      }));
    } catch {
      setChats(c => ({
        ...c,
        [modo]: [...newMsgs, { role: "assistant", content: "⚡ Error de conexión. Inténtalo de nuevo." }],
      }));
    }
    setLoading(false);
  }

  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif",
      background: "#0f0f1a",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px 16px",
    }}>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 52, lineHeight: 1 }}>🧞</div>
        <h1 style={{ color: "#f5c842", margin: "6px 0 2px", fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>
          GENIO DE LA LÁMPARA
        </h1>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
          IA para tu Terminal POS · Minimarket
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, width: "100%", maxWidth: 500 }}>
        {MODOS.map(m => (
          <button key={m.id} onClick={() => setModo(m.id)} style={{
            flex: 1, padding: "9px 4px", borderRadius: 10, border: "none",
            background: modo === m.id ? m.color : "#1e1e2e",
            color: modo === m.id ? "#fff" : "#6b7280",
            fontWeight: modo === m.id ? 700 : 400,
            fontSize: 12, cursor: "pointer",
            boxShadow: modo === m.id ? `0 0 12px ${m.color}55` : "none",
          }}>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{
        width: "100%", maxWidth: 500,
        background: "#1a1a2e",
        borderRadius: 16,
        border: `1px solid ${color}33`,
        boxShadow: `0 0 30px ${color}22`,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        height: 380,
      }}>
        <div style={{
          flex: 1, overflowY: "auto", padding: "14px 14px 8px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {mensajes.length === 0 && (
            <div style={{ textAlign: "center", margin: "auto", color: "#4b5563" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
              <p style={{ fontSize: 13 }}>Soy tu genio. Pregúntame lo que quieras.</p>
            </div>
          )}

          {mensajes.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && <span style={{ fontSize: 18, marginRight: 6, alignSelf: "flex-end" }}>🧞</span>}
              <div style={{
                maxWidth: "78%", padding: "9px 13px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.role === "user" ? color : "#2a2a3e",
                color: "#f3f4f6", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🧞</span>
              <div style={{ background: "#2a2a3e", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", color: "#9ca3af", fontSize: 13 }}>
                Pensando...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: "1px solid #2a2a3e", padding: "10px 12px", display: "flex", gap: 8, background: "#15152a" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && enviar()}
            placeholder="Pregunta al genio..."
            style={{
              flex: 1, background: "#2a2a3e", border: "none",
              borderRadius: 10, padding: "9px 12px",
              color: "#f3f4f6", fontSize: 13, outline: "none",
            }}
          />
          <button onClick={() => enviar()} disabled={loading || !input.trim()} style={{
            background: color, border: "none", borderRadius: 10,
            padding: "9px 16px", color: "#fff", fontWeight: 700,
            fontSize: 16, cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1,
          }}>
            ✦
          </button>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 500, marginTop: 14 }}>
        <p style={{ color: "#4b5563", fontSize: 11, marginBottom: 8, textAlign: "center" }}>SUGERENCIAS RÁPIDAS</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
          {SUGERENCIAS[modo].map((s, i) => (
            <button key={i} onClick={() => enviar(s)} disabled={loading} style={{
              background: "#1e1e2e", border: `1px solid ${color}44`,
              color: "#d1d5db", borderRadius: 20, padding: "6px 13px",
              fontSize: 11, cursor: "pointer",
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {mensajes.length > 0 && (
        <button onClick={() => setChats(c => ({ ...c, [modo]: [] }))} style={{
          marginTop: 14, background: "none", border: "none", color: "#4b5563", fontSize: 11, cursor: "pointer",
        }}>
          🗑 Limpiar conversación
        </button>
      )}
    </div>
  );
}
