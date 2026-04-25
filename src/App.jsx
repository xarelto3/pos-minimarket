import { useState, useRef, useEffect, useCallback } from "react";

const INITIAL_PRODUCTS = [
  { id: "7501234567890", name: "Paracetamol 500mg x20",  price: 2490, stock: 48, category: "Analgésicos" },
  { id: "7509876543210", name: "Ibuprofeno 400mg x10",   price: 3200, stock: 30, category: "Analgésicos" },
  { id: "7501111111111", name: "Amoxicilina 500mg x21",  price: 5800, stock: 15, category: "Antibióticos" },
  { id: "7502222222222", name: "Omeprazol 20mg x14",     price: 4100, stock: 22, category: "Gastro" },
  { id: "7503333333333", name: "Loratadina 10mg x10",    price: 2900, stock: 35, category: "Alérgicos" },
  { id: "7504444444444", name: "Metformina 850mg x30",   price: 3600, stock: 18, category: "Diabetes" },
  { id: "7505555555555", name: "Vitamina C 1000mg x30",  price: 4800, stock: 40, category: "Vitaminas" },
  { id: "7506666666666", name: "Alcohol 70° 500ml",      price: 1990, stock: 60, category: "Antisépticos" },
];

const fmt = (n) => `$${Math.round(n).toLocaleString("es-CL")}`;
const now = () => new Date().toLocaleString("es-CL", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" });
let saleCounter = 1000;

function buildReceipt(sale, storeName = "Mi Tienda POS") {
  const pad = (a, b, w = 30) => {
    const s = `${a}`, e = `${b}`;
    return s + " ".repeat(Math.max(1, w - s.length - e.length)) + e;
  };
  let body = `🧾 BOLETA ELECTRÓNICA\n──────────────────────────────\n`;
  body += `${storeName}\nFecha: ${sale.date}\nN° ${sale.id}\n──────────────────────────────\n`;
  sale.items.forEach(i => {
    body += `${i.name}\n  ${pad(`x${i.qty} × ${fmt(i.price)}`, fmt(i.price * i.qty))}\n`;
  });
  body += `──────────────────────────────\n`;
  if (sale.discount > 0) {
    body += `${pad("Subtotal", fmt(sale.subtotal))}\n`;
    body += `${pad(`Descuento ${sale.discount}%`, `-${fmt(sale.discountAmt)}`)}\n`;
  }
  body += `${pad("TOTAL", fmt(sale.total))}\nPago: ${sale.payMethod}\n`;
  if (sale.clientName) body += `Cliente: ${sale.clientName}\n`;
  body += `──────────────────────────────\n¡Gracias por su compra! 🙏\n`;
  return body;
}

// ─── THEME (LIGHT) ─────────────────────────────────────────────────────────
const T = {
  bg:      "#f4f5f7",
  surface: "#ffffff",
  card:    "#ffffff",
  border:  "#e2e4e9",
  accent:  "#1a56db",
  accentBg:"#eff4ff",
  text:    "#111827",
  sub:     "#374151",
  muted:   "#6b7280",
  green:   "#059669",
  greenBg: "#ecfdf5",
  red:     "#dc2626",
  redBg:   "#fef2f2",
  yellow:  "#d97706",
  font:    "'Inter', 'Segoe UI', system-ui, sans-serif",
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18, stroke = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const ScanIcon  = () => <Ico d={["M3 9V5a2 2 0 0 1 2-2h4","M3 15v4a2 2 0 0 0 2 2h4","M21 9V5a2 2 0 0 0-2-2h-4","M21 15v4a2 2 0 0 1-2 2h-4","M7 7v10","M10 7v10","M13 7v10","M17 9v8"]} />;
const CartIcon  = () => <Ico d={["M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z","M3 6h18","M16 10a4 4 0 0 1-8 0"]} />;
const EditIcon  = () => <Ico size={15} d={["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7","M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"]} />;
const TrashIcon = () => <Ico size={15} d={["M3 6h18","M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6","M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]} />;
const WAIcon    = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);
const MailIcon  = () => <Ico d={["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z","M22 6l-10 7L2 6"]} />;

// ─── SHARED STYLES ──────────────────────────────────────────────────────────
const shadow = "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)";
const shadowMd = "0 4px 12px rgba(0,0,0,0.1)";

const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  boxShadow: shadow,
};

const inputStyle = {
  width: "100%",
  background: "#fff",
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  color: T.text,
  fontFamily: T.font,
  fontSize: 14,
  padding: "11px 14px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn = {
  border: "none", cursor: "pointer", fontFamily: T.font,
  fontWeight: 600, display: "flex", alignItems: "center",
  justifyContent: "center", gap: 8, transition: "all 0.15s",
  background: T.accent, color: "#fff",
  boxShadow: "0 2px 8px rgba(26,86,219,0.3)",
};
const greenBtn = {
  ...primaryBtn,
  background: T.green,
  boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
};
const ghostBtn = {
  ...primaryBtn,
  background: "#fff",
  color: T.muted,
  border: `1.5px solid ${T.border}`,
  boxShadow: shadow,
};

export default function POSTerminal() {
  const [products, setProducts]     = useState(INITIAL_PRODUCTS);
  const [cart, setCart]             = useState([]);
  const [sales, setSales]           = useState([]);
  const [tab, setTab]               = useState("sale");
  const [search, setSearch]         = useState("");
  const [scanMsg, setScanMsg]       = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [barcodeSupported, setBarcodeSupported] = useState(true);

  const [clientName, setClientName]   = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [discount, setDiscount]       = useState(0);
  const [payMethod, setPayMethod]     = useState("efectivo");
  const [cashReceived, setCashReceived] = useState("");

  const [showScanner, setShowScanner]     = useState(false);
  const [showCheckout, setShowCheckout]   = useState(false);
  const [showBoleta, setShowBoleta]       = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [editProduct, setEditProduct]     = useState(null);
  const [lastSale, setLastSale]           = useState(null);
  const [flashMsg, setFlashMsg]           = useState("");
  const [scanActive, setScanActive]       = useState(false);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const loopRef     = useRef(null);
  const lastCodeRef = useRef("");

  useEffect(() => { setBarcodeSupported("BarcodeDetector" in window); }, []);

  const flash = (msg) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(""), 2200); };

  // ── Cart ────────────────────────────────────────────────────────────────
  const addToCart = useCallback((product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex
        ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...product, qty: 1 }];
    });
    flash(`✓ ${product.name.substring(0, 32)}`);
  }, []);

  const updateQty = (id, d) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0));
  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const cartCount   = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = Math.round(subtotal * discount / 100);
  const total       = subtotal - discountAmt;

  // ── Scanner ─────────────────────────────────────────────────────────────
  const handleCode = useCallback((code) => {
    if (code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    setTimeout(() => { lastCodeRef.current = ""; }, 2500);
    const p = products.find(x => x.id === code);
    if (p) { addToCart(p); setScanMsg({ ok: true, text: p.name }); }
    else    { setScanMsg({ ok: false, text: `Sin resultado: ${code}` }); }
  }, [products, addToCart]);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      if (!detectorRef.current && barcodeSupported) {
        detectorRef.current = new window.BarcodeDetector({
          formats: ["ean_13","ean_8","code_128","qr_code","upc_a","upc_e"]
        });
      }
      setScanActive(true);
      if (barcodeSupported) {
        loopRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes.length) handleCode(codes[0].rawValue);
          } catch {}
        }, 400);
      }
    } catch { flash("❌ No se pudo acceder a la cámara"); }
  };

  const stopScanner = () => {
    clearInterval(loopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanActive(false);
    setScanMsg(null);
  };

  useEffect(() => {
    if (showScanner) startScanner();
    else stopScanner();
    return stopScanner;
  }, [showScanner]);

  // ── Sale ────────────────────────────────────────────────────────────────
  const completeSale = () => {
    const id = String(++saleCounter);
    const sale = {
      id, date: now(),
      items: cart.map(i => ({ ...i })),
      subtotal, discountAmt, discount,
      total, payMethod,
      cashReceived: payMethod === "efectivo" ? Number(cashReceived) : null,
      clientName, clientPhone, clientEmail,
    };
    setSales(prev => [sale, ...prev]);
    setLastSale(sale);
    setCart([]);
    setClientName(""); setClientPhone(""); setClientEmail("");
    setDiscount(0); setPayMethod("efectivo"); setCashReceived("");
    setShowCheckout(false);
    setShowBoleta(true);
  };

  // ── Share ────────────────────────────────────────────────────────────────
  const buildWAText = (sale) => {
    let msg = `*BOLETA N\u00b0 ${sale.id}*\n`;
    msg += `Fecha: ${sale.date}\n\n`;
    sale.items.forEach(i => {
      msg += `- ${i.name} x${i.qty} = ${fmt(i.price * i.qty)}\n`;
    });
    msg += `\n`;
    if (sale.discount > 0) {
      msg += `Subtotal: ${fmt(sale.subtotal)}\n`;
      msg += `Descuento ${sale.discount}%: -${fmt(sale.discountAmt)}\n`;
    }
    msg += `*TOTAL: ${fmt(sale.total)}*\n`;
    msg += `Pago: ${sale.payMethod}\n`;
    if (sale.cashReceived) msg += `Efectivo: ${fmt(sale.cashReceived)}\nVuelto: ${fmt(sale.cashReceived - sale.total)}\n`;
    if (sale.clientName) msg += `\nCliente: ${sale.clientName}`;
    msg += `\n\nGracias por su compra!`;
    return msg;
  };

  const sendWA = (sale) => {
    const text = buildWAText(sale);
    const phone = (sale.clientPhone || "").replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone.startsWith("56") ? phone : "56" + phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const sendEmail = (sale) => {
    const body = buildReceipt(sale);
    window.open(`mailto:${sale.clientEmail || ""}?subject=${encodeURIComponent(`Boleta N° ${sale.id}`)}&body=${encodeURIComponent(body)}`);
  };

  // ── Inventory ────────────────────────────────────────────────────────────
  const saveProduct = (p) => {
    setProducts(prev => prev.find(x => x.id === p.id)
      ? prev.map(x => x.id === p.id ? p : x)
      : [p, ...prev]);
    setEditProduct(null);
  };
  const deleteProduct = (id) => setProducts(prev => prev.filter(x => x.id !== id));

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.includes(search) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text,
      fontFamily:T.font, display:"flex", flexDirection:"column",
      maxWidth:480, margin:"0 auto", position:"relative" }}>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:#9ca3af}
        input:focus{border-color:${T.accent}!important;box-shadow:0 0 0 3px rgba(26,86,219,0.12)}
        button:active{opacity:0.85;transform:scale(0.98)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @keyframes zoomIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        .fade{animation:fadeUp 0.2s ease both}
        .hov:hover{background:#f9fafb!important}
      `}</style>

      {/* TOAST */}
      {flashMsg && (
        <div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",
          background:T.accent,color:"#fff",padding:"9px 18px",borderRadius:20,
          fontSize:13,fontWeight:600,zIndex:9999,boxShadow:shadowMd,whiteSpace:"nowrap",
          animation:"zoomIn 0.18s ease" }}>
          {flashMsg}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ background:"#fff",borderBottom:`1px solid ${T.border}`,
        padding:"14px 16px",display:"flex",alignItems:"center",
        justifyContent:"space-between",position:"sticky",top:0,zIndex:200,
        boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div>
          <div style={{ fontSize:11,color:T.muted,fontWeight:500,letterSpacing:"0.05em" }}>POINT OF SALE</div>
          <div style={{ fontSize:17,fontWeight:700,color:T.text,letterSpacing:"-0.02em" }}>Terminal POS</div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <button onClick={() => setShowInventory(true)}
            style={{ ...ghostBtn,padding:"7px 14px",borderRadius:9,fontSize:13,fontWeight:500 }}>
            Inventario
          </button>
          <div onClick={() => cart.length && setShowCheckout(true)}
            style={{ position:"relative",cursor:cart.length?"pointer":"default",
              color:cart.length ? T.accent : T.muted }}>
            <CartIcon />
            {cartCount > 0 && (
              <span style={{ position:"absolute",top:-8,right:-8,background:T.accent,color:"#fff",
                fontSize:10,fontWeight:700,borderRadius:"50%",width:18,height:18,
                display:"flex",alignItems:"center",justifyContent:"center" }}>
                {cartCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div style={{ display:"flex",background:"#fff",borderBottom:`1px solid ${T.border}` }}>
        {[["sale","Venta"],["history","Historial"],["catalog","Catálogo"]].map(([v,label]) => (
          <button key={v} onClick={() => { setTab(v); setSearch(""); }} style={{
            flex:1,padding:"12px 0",background:"none",border:"none",
            borderBottom:tab===v?`2px solid ${T.accent}`:"2px solid transparent",
            color:tab===v ? T.accent : T.muted,
            fontSize:13,fontWeight:tab===v?600:500,
            cursor:"pointer",transition:"all 0.15s",fontFamily:T.font,
          }}>{label}</button>
        ))}
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div style={{ flex:1,overflowY:"auto",padding:16 }}>

        {/* ══ VENTA ══ */}
        {tab === "sale" && (
          <div className="fade">
            {/* Scan button */}
            <button onClick={() => setShowScanner(true)}
              style={{ ...primaryBtn,width:"100%",padding:16,borderRadius:12,fontSize:14,
                fontWeight:600,marginBottom:14 }}>
              <ScanIcon /> Escanear código de barras
            </button>

            {/* Search */}
            <div style={{ marginBottom:14 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                style={inputStyle} placeholder="Buscar y agregar producto..." />
            </div>

            {search && filtered.slice(0,5).map(p => (
              <div key={p.id} className="hov" onClick={() => { addToCart(p); setSearch(""); }}
                style={{ ...cardStyle,padding:"12px 14px",display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:8,cursor:"pointer",transition:"background 0.1s" }}>
                <div>
                  <span style={{ fontSize:10,color:T.accent,fontWeight:600,letterSpacing:"0.05em",
                    background:T.accentBg,padding:"2px 8px",borderRadius:20,textTransform:"uppercase" }}>
                    {p.category}
                  </span>
                  <div style={{ fontSize:14,fontWeight:500,color:T.text,marginTop:5 }}>{p.name}</div>
                  <div style={{ fontSize:14,fontWeight:700,color:T.accent,marginTop:2 }}>{fmt(p.price)}</div>
                </div>
                <div style={{ width:36,height:36,borderRadius:10,background:T.accent,color:"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>+</div>
              </div>
            ))}

            {/* Cart */}
            {cart.length === 0 && !search ? (
              <div style={{ textAlign:"center",color:T.muted,marginTop:52 }}>
                <div style={{ fontSize:42,marginBottom:12 }}>🛒</div>
                <div style={{ fontSize:14,fontWeight:500 }}>El carrito está vacío</div>
                <div style={{ fontSize:13,marginTop:4,color:"#9ca3af" }}>Escanea o busca un producto</div>
              </div>
            ) : !search && (
              <>
                <div style={{ fontSize:12,color:T.muted,fontWeight:500,marginBottom:12,marginTop:4 }}>
                  Carrito · {cartCount} items
                </div>
                {cart.map(item => (
                  <div key={item.id} style={{ ...cardStyle,padding:"12px 14px",marginBottom:8,
                    display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:500,color:T.text,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize:14,fontWeight:700,color:T.accent,marginTop:3 }}>
                        {fmt(item.price * item.qty)}
                        <span style={{ color:T.muted,fontSize:12,fontWeight:400 }}> · {fmt(item.price)} c/u</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <button onClick={() => updateQty(item.id,-1)}
                        style={{ width:30,height:30,borderRadius:8,border:`1.5px solid ${T.border}`,
                          background:"#fff",color:T.text,fontSize:16,cursor:"pointer",fontFamily:T.font }}>−</button>
                      <span style={{ fontSize:15,fontWeight:600,minWidth:24,textAlign:"center",color:T.text }}>
                        {item.qty}
                      </span>
                      <button onClick={() => updateQty(item.id,+1)}
                        style={{ width:30,height:30,borderRadius:8,border:"none",
                          background:T.accent,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>+</button>
                      <button onClick={() => removeFromCart(item.id)}
                        style={{ width:30,height:30,borderRadius:8,border:"none",
                          background:T.redBg,color:T.red,fontSize:14,cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                ))}

                <div style={{ height:1,background:T.border,margin:"16px 0" }} />
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                  <span style={{ fontSize:14,fontWeight:500,color:T.sub }}>Total</span>
                  <span style={{ fontSize:26,fontWeight:700,color:T.text }}>{fmt(subtotal)}</span>
                </div>
                <button onClick={() => setShowCheckout(true)}
                  style={{ ...greenBtn,width:"100%",padding:16,borderRadius:12,fontSize:15,fontWeight:600 }}>
                  Cobrar →
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ HISTORIAL ══ */}
        {tab === "history" && (
          <div className="fade">
            {/* Summary bar */}
            {sales.length > 0 && (
              <div style={{ ...cardStyle,padding:"14px 16px",marginBottom:14,
                display:"flex",justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:12,color:T.muted,fontWeight:500 }}>Ventas hoy</div>
                  <div style={{ fontSize:22,fontWeight:700,color:T.text }}>{sales.length}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12,color:T.muted,fontWeight:500 }}>Total recaudado</div>
                  <div style={{ fontSize:22,fontWeight:700,color:T.green }}>
                    {fmt(sales.reduce((s,x) => s+x.total, 0))}
                  </div>
                </div>
              </div>
            )}

            {sales.length === 0 ? (
              <div style={{ textAlign:"center",color:T.muted,marginTop:52 }}>
                <div style={{ fontSize:42,marginBottom:12 }}>📋</div>
                <div style={{ fontSize:14,fontWeight:500 }}>Sin ventas aún</div>
              </div>
            ) : sales.map(sale => (
              <div key={sale.id} style={{ ...cardStyle,padding:"14px 16px",marginBottom:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:12,color:T.muted,fontWeight:500 }}>Boleta N° {sale.id}</div>
                    <div style={{ fontSize:12,color:T.muted,marginTop:1 }}>{sale.date}</div>
                    {sale.clientName && (
                      <div style={{ fontSize:13,color:T.sub,marginTop:4,fontWeight:500 }}>👤 {sale.clientName}</div>
                    )}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:20,fontWeight:700,color:T.text }}>{fmt(sale.total)}</div>
                    <div style={{ fontSize:11,color:T.muted,textTransform:"capitalize",marginTop:1 }}>{sale.payMethod}</div>
                  </div>
                </div>
                <div style={{ fontSize:12,color:T.muted,marginBottom:12,lineHeight:1.5 }}>
                  {sale.items.map(i => `${i.name.substring(0,20)} x${i.qty}`).join(" · ")}
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  {sale.clientPhone && (
                    <button onClick={() => sendWA(sale)}
                      style={{ flex:1,padding:"9px 0",borderRadius:9,border:"none",
                        background:"#dcfce7",color:"#15803d",cursor:"pointer",fontFamily:T.font,
                        fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                      <WAIcon /> WhatsApp
                    </button>
                  )}
                  {sale.clientEmail && (
                    <button onClick={() => sendEmail(sale)}
                      style={{ flex:1,padding:"9px 0",borderRadius:9,border:"none",
                        background:"#eff6ff",color:"#1d4ed8",cursor:"pointer",fontFamily:T.font,
                        fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                      <MailIcon /> Email
                    </button>
                  )}
                  <button onClick={() => { setLastSale(sale); setShowBoleta(true); }}
                    style={{ flex:1,padding:"9px 0",borderRadius:9,border:`1.5px solid ${T.border}`,
                      background:"#fff",color:T.sub,cursor:"pointer",fontFamily:T.font,
                      fontSize:12,fontWeight:500 }}>
                    Ver boleta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ CATÁLOGO ══ */}
        {tab === "catalog" && (
          <div className="fade">
            <div style={{ marginBottom:14 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                style={inputStyle} placeholder="Buscar en catálogo..." />
            </div>
            <div style={{ fontSize:12,color:T.muted,fontWeight:500,marginBottom:12 }}>
              {filtered.length} productos
            </div>
            {filtered.map(p => (
              <div key={p.id} style={{ ...cardStyle,padding:"12px 14px",marginBottom:8,
                display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <span style={{ fontSize:10,color:T.accent,fontWeight:600,
                    background:T.accentBg,padding:"2px 8px",borderRadius:20,
                    textTransform:"uppercase",letterSpacing:"0.04em" }}>{p.category}</span>
                  <div style={{ fontSize:14,fontWeight:500,color:T.text,marginTop:5 }}>{p.name}</div>
                  <div style={{ fontSize:11,color:"#9ca3af",marginTop:2 }}>{p.id}</div>
                  <div style={{ display:"flex",gap:14,marginTop:5,alignItems:"center" }}>
                    <span style={{ fontSize:15,fontWeight:700,color:T.text }}>{fmt(p.price)}</span>
                    <span style={{ fontSize:12,color:p.stock<10?T.red:T.muted,fontWeight:500 }}>
                      {p.stock<10?"⚠ ":""}{p.stock} en stock
                    </span>
                  </div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  <button onClick={() => addToCart(p)}
                    style={{ width:36,height:36,borderRadius:10,border:"none",background:T.accent,
                      color:"#fff",fontSize:22,cursor:"pointer",fontWeight:600,display:"flex",
                      alignItems:"center",justifyContent:"center" }}>+</button>
                  <button onClick={() => setEditProduct({...p})}
                    style={{ width:36,height:36,borderRadius:10,border:`1.5px solid ${T.border}`,
                      background:"#fff",color:T.muted,cursor:"pointer",display:"flex",
                      alignItems:"center",justifyContent:"center" }}><EditIcon /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL: SCANNER
      ════════════════════════════════════════════════════════════ */}
      {showScanner && (
        <div style={{ position:"fixed",inset:0,background:"#000",zIndex:500,
          display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto" }}>
          {/* Botón cerrar fijo siempre visible */}
          <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:600,
            padding:"14px 16px",display:"flex",alignItems:"center",
            justifyContent:"space-between",background:"rgba(0,0,0,0.75)" }}>
            <span style={{ fontSize:14,color:"#fff",fontWeight:600 }}>📷 Escáner</span>
            <button onClick={() => setShowScanner(false)}
              style={{ background:"#ef4444",border:"none",borderRadius:12,
                color:"#fff",padding:"12px 22px",cursor:"pointer",
                fontSize:15,fontFamily:T.font,fontWeight:700,
                boxShadow:"0 4px 14px rgba(239,68,68,0.5)" }}>
              ✕ CERRAR
            </button>
          </div>

          <div style={{ position:"relative",background:"#000",width:"100%",aspectRatio:"4/3",flexShrink:0,marginTop:58 }}>
            <video ref={videoRef} style={{ width:"100%",height:"100%",objectFit:"cover" }} playsInline muted />
            {/* Viewfinder */}
            <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",
              justifyContent:"center",pointerEvents:"none" }}>
              <div style={{ width:220,height:130,position:"relative" }}>
                {[
                  { top:0,left:0,borderTopWidth:3,borderLeftWidth:3 },
                  { top:0,right:0,borderTopWidth:3,borderRightWidth:3 },
                  { bottom:0,left:0,borderBottomWidth:3,borderLeftWidth:3 },
                  { bottom:0,right:0,borderBottomWidth:3,borderRightWidth:3 },
                ].map((pos, i) => (
                  <div key={i} style={{ position:"absolute",width:24,height:24,
                    borderColor:"#fff",borderStyle:"solid",borderWidth:0,...pos }} />
                ))}
                <div style={{ position:"absolute",left:0,right:0,top:"50%",height:2,
                  background:"rgba(255,255,255,0.7)",boxShadow:"0 0 8px rgba(255,255,255,0.8)" }} />
              </div>
            </div>
          </div>

          <div style={{ padding:16,flex:1,background:"#fff" }}>
            {scanMsg && (
              <div style={{ padding:"12px 14px",borderRadius:10,marginBottom:12,
                background:scanMsg.ok?T.greenBg:T.redBg,
                border:`1px solid ${scanMsg.ok?"#a7f3d0":"#fecaca"}`,
                display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:20 }}>{scanMsg.ok?"✅":"⚠️"}</span>
                <div>
                  <div style={{ fontSize:12,fontWeight:600,color:scanMsg.ok?T.green:T.red }}>
                    {scanMsg.ok?"Agregado al carrito":"Código no encontrado"}
                  </div>
                  <div style={{ fontSize:13,color:T.sub,marginTop:1 }}>{scanMsg.text}</div>
                </div>
              </div>
            )}
            {!barcodeSupported && (
              <div style={{ background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,
                padding:12,marginBottom:12,fontSize:12,color:T.yellow,fontWeight:500 }}>
                ⚠ Tu navegador no soporta escáner. Usa Chrome en Android o ingresa el código manualmente.
              </div>
            )}
            <div style={{ display:"flex",gap:8 }}>
              <input value={manualCode} onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"){handleCode(manualCode);setManualCode("");} }}
                placeholder="Ingresar código manual..." style={{ ...inputStyle,flex:1 }} />
              <button onClick={() => { handleCode(manualCode); setManualCode(""); }}
                style={{ ...primaryBtn,width:46,height:46,borderRadius:10,fontSize:18,flexShrink:0 }}>→</button>
            </div>
            <div style={{ marginTop:14,textAlign:"center",fontSize:12,color:T.muted }}>
              Apunta la cámara al código de barras del producto
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: CHECKOUT
      ════════════════════════════════════════════════════════════ */}
      {showCheckout && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:400,
          display:"flex",alignItems:"flex-end" }} onClick={() => setShowCheckout(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff",borderRadius:"20px 20px 0 0",padding:"20px 20px 28px",
              width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto",
              boxShadow:"0 -4px 24px rgba(0,0,0,0.12)",animation:"slideUp 0.28s ease" }}>

            <div style={{ width:40,height:4,background:T.border,borderRadius:2,margin:"0 auto 20px" }} />
            <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:20 }}>Cobrar venta</div>

            {/* Client */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>
              Datos del cliente <span style={{ fontWeight:400,color:T.muted }}>(opcional)</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:9,marginBottom:20 }}>
              <input value={clientName}  onChange={e => setClientName(e.target.value)}  style={inputStyle} placeholder="Nombre" />
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} style={inputStyle} placeholder="WhatsApp (+56912345678)" type="tel" />
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} style={inputStyle} placeholder="Correo electrónico" type="email" />
            </div>

            {/* Items — editables */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>
              Productos <span style={{ fontWeight:400,color:T.muted }}>(puedes editar)</span>
            </div>
            <div style={{ background:T.bg,borderRadius:12,padding:"4px 10px",marginBottom:18 }}>
              {cart.map(i => (
                <div key={i.id} style={{ display:"flex",alignItems:"center",gap:8,
                  padding:"10px 0",borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:500,color:T.text,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {i.name}
                    </div>
                    <div style={{ fontSize:13,fontWeight:700,color:T.accent,marginTop:2 }}>
                      {fmt(i.price * i.qty)}
                      <span style={{ color:T.muted,fontWeight:400,fontSize:11 }}> · {fmt(i.price)} c/u</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:5,flexShrink:0 }}>
                    <button onClick={() => updateQty(i.id,-1)}
                      style={{ width:30,height:30,borderRadius:8,border:`1.5px solid ${T.border}`,
                        background:"#fff",color:T.text,fontSize:16,cursor:"pointer",
                        fontFamily:T.font,fontWeight:600 }}>−</button>
                    <span style={{ fontSize:14,fontWeight:700,color:T.text,
                      minWidth:24,textAlign:"center" }}>{i.qty}</span>
                    <button onClick={() => updateQty(i.id,+1)}
                      style={{ width:30,height:30,borderRadius:8,border:"none",
                        background:T.accent,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>+</button>
                    <button onClick={() => removeFromCart(i.id)}
                      style={{ width:30,height:30,borderRadius:8,border:"none",
                        background:T.redBg,color:T.red,fontSize:14,cursor:"pointer",fontWeight:600 }}>✕</button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div style={{ padding:"20px 0",textAlign:"center",color:T.muted,fontSize:13 }}>
                  Carrito vacío — cierra para agregar productos
                </div>
              )}
            </div>

            {/* Discount */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>Descuento</div>
            <div style={{ display:"flex",gap:7,marginBottom:20 }}>
              {[0,5,10,15,20].map(d => (
                <button key={d} onClick={() => setDiscount(d)} style={{
                  flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                  fontSize:13,fontWeight:600,transition:"all 0.12s",
                  border:discount===d?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                  background:discount===d?T.accentBg:"#fff",
                  color:discount===d?T.accent:T.muted,
                }}>{d}%</button>
              ))}
            </div>

            {/* Total */}
            <div style={{ background:T.bg,borderRadius:12,padding:"14px 16px",marginBottom:20 }}>
              {discount > 0 && (
                <>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,color:T.muted,marginBottom:6 }}>
                    <span>Subtotal</span><span style={{ color:T.sub }}>{fmt(subtotal)}</span>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8 }}>
                    <span style={{ color:T.red }}>Descuento {discount}%</span>
                    <span style={{ color:T.red }}>−{fmt(discountAmt)}</span>
                  </div>
                </>
              )}
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:14,fontWeight:600,color:T.sub }}>Total</span>
                <span style={{ fontSize:28,fontWeight:800,color:T.text }}>{fmt(total)}</span>
              </div>
            </div>

            {/* Pay method */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>Método de pago</div>
            <div style={{ display:"flex",gap:7,marginBottom:16 }}>
              {["Efectivo","Débito","Crédito","Transferencia"].map(m => (
                <button key={m} onClick={() => { setPayMethod(m.toLowerCase()); setCashReceived(""); }} style={{
                  flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                  fontSize:11,fontWeight:600,transition:"all 0.12s",
                  border:payMethod===m.toLowerCase()?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                  background:payMethod===m.toLowerCase()?T.accentBg:"#fff",
                  color:payMethod===m.toLowerCase()?T.accent:T.muted,
                }}>{m}</button>
              ))}
            </div>

            {/* Efectivo: monto recibido + vuelto */}
            {payMethod === "efectivo" && (
              <div style={{ background:T.bg,borderRadius:12,padding:"14px 16px",marginBottom:18 }}>
                <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>
                  Efectivo recibido
                </div>
                <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                  {[Math.ceil(total/1000)*1000, Math.ceil(total/2000)*2000, Math.ceil(total/5000)*5000].filter((v,i,a)=>a.indexOf(v)===i).map(v => (
                    <button key={v} onClick={() => setCashReceived(v)}
                      style={{ flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                        fontSize:12,fontWeight:600,
                        border:Number(cashReceived)===v?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                        background:Number(cashReceived)===v?T.accentBg:"#fff",
                        color:Number(cashReceived)===v?T.accent:T.sub }}>
                      {fmt(v)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder="O ingresa monto exacto..."
                  style={{ ...inputStyle, marginBottom: cashReceived && Number(cashReceived) >= total ? 10 : 0 }}
                />
                {cashReceived && Number(cashReceived) >= total && (
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                    background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,
                    padding:"12px 16px",marginTop:10 }}>
                    <span style={{ fontSize:14,fontWeight:600,color:T.green }}>Vuelto</span>
                    <span style={{ fontSize:24,fontWeight:800,color:T.green }}>
                      {fmt(Number(cashReceived) - total)}
                    </span>
                  </div>
                )}
                {cashReceived && Number(cashReceived) < total && (
                  <div style={{ background:T.redBg,border:"1px solid #fecaca",borderRadius:10,
                    padding:"10px 14px",marginTop:10,fontSize:13,color:T.red,fontWeight:600,textAlign:"center" }}>
                    Faltan {fmt(total - Number(cashReceived))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={completeSale}
              disabled={payMethod==="efectivo" && cashReceived && Number(cashReceived) < total}
              style={{ ...greenBtn,width:"100%",padding:16,borderRadius:12,fontSize:15,fontWeight:700,
                opacity: payMethod==="efectivo" && cashReceived && Number(cashReceived) < total ? 0.4 : 1 }}>
              ✓ Confirmar venta · {fmt(total)}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: BOLETA
      ════════════════════════════════════════════════════════════ */}
      {showBoleta && lastSale && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:600,
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={() => setShowBoleta(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff",borderRadius:18,padding:22,
              width:"100%",maxWidth:420,animation:"zoomIn 0.22s ease",
              maxHeight:"90vh",overflowY:"auto",boxShadow:shadowMd }}>

            <div style={{ textAlign:"center",marginBottom:20 }}>
              <div style={{ width:60,height:60,borderRadius:"50%",background:T.greenBg,
                border:`2px solid ${T.green}`,display:"flex",alignItems:"center",
                justifyContent:"center",margin:"0 auto 12px",fontSize:26 }}>✓</div>
              <div style={{ fontSize:16,fontWeight:700,color:T.green }}>¡Venta registrada!</div>
              <div style={{ fontSize:13,color:T.muted,marginTop:4 }}>Boleta N° {lastSale.id}</div>
            </div>

            {/* Receipt preview */}
            <div style={{ background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,
              padding:14,marginBottom:18,fontSize:12,lineHeight:1.9,
              whiteSpace:"pre-wrap",color:T.sub,fontFamily:"'Courier New',monospace",
              maxHeight:260,overflowY:"auto" }}>
              {buildReceipt(lastSale)}
            </div>

            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:12 }}>
              Enviar boleta al cliente
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:14 }}>
              <button onClick={() => sendWA(lastSale)}
                style={{ width:"100%",padding:14,borderRadius:11,border:"none",
                  background:"#25D366",color:"#fff",cursor:"pointer",fontFamily:T.font,
                  fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
                <WAIcon /> Enviar por WhatsApp
              </button>
              <button onClick={() => sendEmail(lastSale)}
                style={{ width:"100%",padding:14,borderRadius:11,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",fontFamily:T.font,
                  fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
                <MailIcon /> Enviar por correo
              </button>
            </div>
            <button onClick={() => setShowBoleta(false)}
              style={{ ...ghostBtn,width:"100%",padding:13,borderRadius:11,fontSize:14 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: INVENTARIO
      ════════════════════════════════════════════════════════════ */}
      {showInventory && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:400,
          display:"flex",alignItems:"flex-end" }} onClick={() => setShowInventory(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff",borderRadius:"20px 20px 0 0",padding:"20px 20px 28px",
              width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"88vh",overflowY:"auto",
              boxShadow:"0 -4px 24px rgba(0,0,0,0.12)",animation:"slideUp 0.28s ease" }}>

            <div style={{ width:40,height:4,background:T.border,borderRadius:2,margin:"0 auto 18px" }} />
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
              <div style={{ fontSize:16,fontWeight:700,color:T.text }}>Inventario</div>
              <button onClick={() => setEditProduct({ id:"",name:"",price:0,stock:0,category:"" })}
                style={{ ...primaryBtn,padding:"8px 16px",borderRadius:9,fontSize:13 }}>
                + Nuevo
              </button>
            </div>

            {editProduct && (
              <div style={{ background:T.accentBg,border:`1.5px solid ${T.accent}`,
                borderRadius:12,padding:16,marginBottom:16 }}>
                <div style={{ fontSize:13,fontWeight:600,color:T.accent,marginBottom:12 }}>
                  {editProduct.name ? "Editar producto" : "Nuevo producto"}
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
                  <input value={editProduct.id} onChange={e => setEditProduct(p=>({...p,id:e.target.value}))}
                    style={inputStyle} placeholder="Código de barras (EAN-13)" />
                  <input value={editProduct.name} onChange={e => setEditProduct(p=>({...p,name:e.target.value}))}
                    style={inputStyle} placeholder="Nombre del producto" />
                  <input value={editProduct.category} onChange={e => setEditProduct(p=>({...p,category:e.target.value}))}
                    style={inputStyle} placeholder="Categoría" />
                  <div style={{ display:"flex",gap:8 }}>
                    <input value={editProduct.price} onChange={e => setEditProduct(p=>({...p,price:Number(e.target.value)}))}
                      style={inputStyle} placeholder="Precio $" type="number" />
                    <input value={editProduct.stock} onChange={e => setEditProduct(p=>({...p,stock:Number(e.target.value)}))}
                      style={inputStyle} placeholder="Stock" type="number" />
                  </div>
                  <div style={{ display:"flex",gap:8,marginTop:4 }}>
                    <button onClick={() => saveProduct(editProduct)}
                      style={{ ...greenBtn,flex:1,padding:12,borderRadius:10,fontSize:14 }}>Guardar</button>
                    <button onClick={() => setEditProduct(null)}
                      style={{ ...ghostBtn,flex:1,padding:12,borderRadius:10,fontSize:14 }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {products.map(p => (
              <div key={p.id} style={{ ...cardStyle,padding:"12px 14px",marginBottom:8,
                display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:14,fontWeight:500,color:T.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                  <div style={{ display:"flex",gap:14,marginTop:5,alignItems:"center" }}>
                    <span style={{ fontSize:14,fontWeight:700,color:T.text }}>{fmt(p.price)}</span>
                    <span style={{ fontSize:12,fontWeight:500,color:p.stock<10?T.red:T.muted }}>
                      {p.stock<10?"⚠ ":""}{p.stock} en stock
                    </span>
                  </div>
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button onClick={() => setEditProduct({...p})}
                    style={{ width:34,height:34,borderRadius:9,border:`1.5px solid ${T.border}`,
                      background:"#fff",color:T.muted,cursor:"pointer",display:"flex",
                      alignItems:"center",justifyContent:"center" }}><EditIcon /></button>
                  <button onClick={() => deleteProduct(p.id)}
                    style={{ width:34,height:34,borderRadius:9,border:"none",
                      background:T.redBg,color:T.red,cursor:"pointer",display:"flex",
                      alignItems:"center",justifyContent:"center" }}><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
