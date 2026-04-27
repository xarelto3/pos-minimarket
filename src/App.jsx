import { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, deleteDoc, query, orderBy, getDocs } from "firebase/firestore";

// ─── FIREBASE ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDa_pjlBYeRHnQP0hgjhwFwhhJTTMk9sn0",
  authDomain: "pos-minimarket-7b084.firebaseapp.com",
  projectId: "pos-minimarket-7b084",
  storageBucket: "pos-minimarket-7b084.firebasestorage.app",
  messagingSenderId: "98989222105",
  appId: "1:98989222105:web:c0cd545b50f5fad3a3b6c8",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ─── CONSTANTES ────────────────────────────────────────────
const ADMIN_PASS = "admin1234";

const INITIAL_PRODUCTS = [
  { id: "7501234567890", name: "Paracetamol 500mg x20",  price: 2490, cost: 1500, stock: 48, stockMin: 5, category: "Analgésicos" },
  { id: "7509876543210", name: "Ibuprofeno 400mg x10",   price: 3200, cost: 2000, stock: 30, stockMin: 5, category: "Analgésicos" },
  { id: "7501111111111", name: "Amoxicilina 500mg x21",  price: 5800, cost: 3800, stock: 15, stockMin: 3, category: "Antibióticos" },
  { id: "7502222222222", name: "Omeprazol 20mg x14",     price: 4100, cost: 2600, stock: 22, stockMin: 5, category: "Gastro" },
  { id: "7503333333333", name: "Loratadina 10mg x10",    price: 2900, cost: 1800, stock: 35, stockMin: 5, category: "Alérgicos" },
  { id: "7504444444444", name: "Metformina 850mg x30",   price: 3600, cost: 2200, stock: 18, stockMin: 3, category: "Diabetes" },
  { id: "7505555555555", name: "Vitamina C 1000mg x30",  price: 4800, cost: 3000, stock: 40, stockMin: 5, category: "Vitaminas" },
  { id: "7506666666666", name: "Alcohol 70° 500ml",      price: 1990, cost: 1100, stock: 60, stockMin: 10, category: "Antisépticos" },
];

// ─── HELPERS ───────────────────────────────────────────────
const fmt = (n) => `$${Math.round(n).toLocaleString("es-CL")}`;
const now = () => new Date().toLocaleString("es-CL", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" });

// ─── EXPORTAR CSV SII ──────────────────────────────────────
function exportCSV(sales, periodo) {
  const IVA = 0.19;
  const rows = [
    ["N° Boleta","Fecha","Vendedor","Neto","IVA 19%","Total","Medio de Pago","Productos"]
  ];
  sales.forEach(s => {
    const neto = Math.round(s.total / (1 + IVA));
    const iva  = s.total - neto;
    const prods = s.items?.map(i => `${i.name} x${i.qty}`).join(" | ") || "";
    rows.push([
      s.id, s.date, s.vendedor || "-",
      neto, iva, s.total,
      s.payMethod, prods
    ]);
  });
  // Totales
  const totalNeto  = sales.reduce((a,s) => a + Math.round(s.total/(1+IVA)), 0);
  const totalIVA   = sales.reduce((a,s) => a + (s.total - Math.round(s.total/(1+IVA))), 0);
  const totalTotal = sales.reduce((a,s) => a + s.total, 0);
  rows.push([]);
  rows.push(["TOTALES","","", totalNeto, totalIVA, totalTotal, "", `${sales.length} boletas`]);

  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `libro-ventas-${periodo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildWAText(sale) {
  let msg = `*BOLETA N° ${sale.id}*\nFecha: ${sale.date}\n`;
  if (sale.vendedor) msg += `Vendedor: ${sale.vendedor}\n`;
  msg += `\n`;
  sale.items.forEach(i => { msg += `- ${i.name} x${i.qty} = ${fmt(i.price * i.qty)}\n`; });
  msg += `\n`;
  if (sale.discount > 0) {
    msg += `Subtotal: ${fmt(sale.subtotal)}\nDescuento ${sale.discount}%: -${fmt(sale.discountAmt)}\n`;
  }
  msg += `*TOTAL: ${fmt(sale.total)}*\nPago: ${sale.payMethod}\n`;
  if (sale.cashReceived) msg += `Efectivo: ${fmt(sale.cashReceived)}\nVuelto: ${fmt(sale.cashReceived - sale.total)}\n`;
  if (sale.clientName) msg += `\nCliente: ${sale.clientName}`;
  msg += `\n\n¡Gracias por su compra! 🙏`;
  return msg;
}

// ─── THEME ─────────────────────────────────────────────────
const T = {
  bg: "#f4f5f7", surface: "#ffffff", card: "#ffffff",
  border: "#e2e4e9", accent: "#1a56db", accentBg: "#eff4ff",
  text: "#111827", sub: "#374151", muted: "#6b7280",
  green: "#059669", greenBg: "#ecfdf5",
  red: "#dc2626", redBg: "#fef2f2",
  yellow: "#d97706", yellowBg: "#fffbeb",
  admin: "#7c3aed", adminBg: "#f5f3ff",
  font: "'Inter','Segoe UI',system-ui,sans-serif",
};
const shadow = "0 1px 3px rgba(0,0,0,0.08)";
const inputStyle = {
  width:"100%", background:"#fff", border:`1.5px solid ${T.border}`,
  borderRadius:10, color:T.text, fontFamily:T.font, fontSize:14,
  padding:"11px 14px", outline:"none", boxSizing:"border-box",
};
const primaryBtn = {
  border:"none", cursor:"pointer", fontFamily:T.font, fontWeight:600,
  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
  background:T.accent, color:"#fff", boxShadow:"0 2px 8px rgba(26,86,219,0.3)",
};
const greenBtn = { ...primaryBtn, background:T.green, boxShadow:"0 2px 8px rgba(5,150,105,0.3)" };
const ghostBtn = { ...primaryBtn, background:"#fff", color:T.muted, border:`1.5px solid ${T.border}`, boxShadow:shadow };
const adminBtn = { ...primaryBtn, background:T.admin, boxShadow:"0 2px 8px rgba(124,58,237,0.3)" };

// ─── ICONOS ────────────────────────────────────────────────
const Ico = ({ d, size=18 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    {(Array.isArray(d)?d:[d]).map((p,i)=><path key={i} d={p}/>)}
  </svg>
);
const ScanIcon   = () => <Ico d={["M3 9V5a2 2 0 0 1 2-2h4","M3 15v4a2 2 0 0 0 2 2h4","M21 9V5a2 2 0 0 0-2-2h-4","M21 15v4a2 2 0 0 1-2 2h-4","M7 7v10","M10 7v10","M13 7v10","M17 9v8"]} />;
const CartIcon   = () => <Ico d={["M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z","M3 6h18","M16 10a4 4 0 0 1-8 0"]} />;
const EditIcon   = () => <Ico size={15} d={["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7","M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"]} />;
const TrashIcon  = () => <Ico size={15} d={["M3 6h18","M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6","M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]} />;
const WAIcon     = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>;
const MailIcon   = () => <Ico d={["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z","M22 6l-10 7L2 6"]} />;
const LockIcon   = () => <Ico d={["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z","M7 11V7a5 5 0 0 1 10 0v4"]} />;
const UserIcon   = () => <Ico d={["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]} />;
const AlertIcon  = () => <Ico d={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z","M12 9v4","M12 17h.01"]} />;


// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE RECEPCIÓN DE PEDIDO
// ══════════════════════════════════════════════════════════════════════════════
function RecepcionPedido({ usuario, products, onClose }) {
  const [items, setItems]           = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg]       = useState(null);
  const [factura, setFactura]       = useState("");
  const [proveedor, setProveedor]   = useState("");
  const [montoFactura, setMontoFactura] = useState("");
  const [guardado, setGuardado]     = useState(false);
  const [flashMsg, setFlashMsg]     = useState("");
  const html5QrRef  = useRef(null);
  const lastCodeRef = useRef("");
  const flash = (msg) => { setFlashMsg(msg); setTimeout(()=>setFlashMsg(""),2000); };

  const handleCode = useCallback((code) => {
    if (code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    setTimeout(()=>{ lastCodeRef.current = ""; },2500);
    const prod = products.find(p=>p.id===code);
    setItems(prev => {
      const ex = prev.find(i=>i.id===code);
      if (ex) return prev.map(i=>i.id===code?{...i,qty:i.qty+1}:i);
      return [...prev, { id:code, name:prod?.name||`Código: ${code}`, qty:1, costo:prod?.cost||0, nuevo:!prod }];
    });
    setScanMsg({ ok:!!prod, text:prod?.name||`Nuevo: ${code}` });
    flash(`✓ ${prod?.name||code}`);
  },[products]);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-recepcion");
      html5QrRef.current = scanner;
      await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:120}},
        (code)=>handleCode(code),()=>{});
    } catch { flash("❌ No se pudo acceder a la cámara"); }
  };
  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); html5QrRef.current.clear(); } catch {}
      html5QrRef.current = null;
    }
    setScanMsg(null);
  };
  useEffect(()=>{
    if (showScanner) setTimeout(()=>startScanner(),300);
    else stopScanner();
    return ()=>{ stopScanner(); };
  },[showScanner]);

  const updateItem = (id,field,val) => setItems(prev=>prev.map(i=>i.id===id?{...i,[field]:val}:i));
  const removeItem = (id) => setItems(prev=>prev.filter(i=>i.id!==id));
  const totalCosto = items.reduce((a,i)=>a+(Number(i.costo)||0)*i.qty,0);

  const confirmar = async () => {
    if (items.length===0) { flash("⚠ Agrega al menos un producto"); return; }
    for (const item of items) {
      const prod = products.find(p=>p.id===item.id);
      if (prod) {
        await setDoc(doc(db,"products",item.id),{...prod,stock:(prod.stock||0)+item.qty,cost:Number(item.costo)||prod.cost||0});
      } else {
        await setDoc(doc(db,"products",item.id),{id:item.id,name:item.name,price:0,cost:Number(item.costo)||0,stock:item.qty,stockMin:5,category:"Sin categoría"});
      }
    }
    await addDoc(collection(db,"pedidos"),{
      fecha:now(), fechaTs:Date.now(), encargado:usuario.nombre,
      proveedor:proveedor||"Sin especificar", factura:factura||"-",
      montoFactura:Number(montoFactura)||0, items, totalCosto,
    });
    setGuardado(true);
    setTimeout(()=>onClose(),2500);
  };

  if (guardado) return (
    <div style={{ minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:60,marginBottom:16 }}>📦</div>
        <div style={{ fontSize:20,fontWeight:700,color:T.green }}>¡Pedido recibido!</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:8 }}>Stock actualizado correctamente</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:T.font,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} input::placeholder{color:#9ca3af} input:focus{border-color:${T.accent}!important} @keyframes zoomIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>
      {flashMsg&&(<div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",background:T.accent,color:"#fff",padding:"9px 18px",borderRadius:20,fontSize:13,fontWeight:600,zIndex:9999,whiteSpace:"nowrap",animation:"zoomIn 0.18s ease" }}>{flashMsg}</div>)}

      <div style={{ background:"#059669",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.8)" }}>RECEPCIÓN DE MERCADERÍA</div>
          <div style={{ fontSize:16,fontWeight:700,color:"#fff" }}>📦 {usuario.nombre}</div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)",border:"none",borderRadius:9,color:"#fff",padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:T.font }}>← Volver</button>
      </div>

      {showScanner&&(
        <div style={{ position:"fixed",inset:0,background:"#000",zIndex:500,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto" }}>
          <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:600,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.75)" }}>
            <span style={{ fontSize:14,color:"#fff",fontWeight:600 }}>📷 Escanear</span>
            <button onClick={()=>setShowScanner(false)} style={{ background:"#ef4444",border:"none",borderRadius:12,color:"#fff",padding:"12px 22px",cursor:"pointer",fontSize:15,fontFamily:T.font,fontWeight:700 }}>✕ CERRAR</button>
          </div>
          <div style={{ marginTop:58,flex:1,background:"#000",overflow:"hidden" }}>
            <div id="qr-recepcion" style={{ width:"100%" }} />
          </div>
          <div style={{ padding:16,background:"#fff" }}>
            {scanMsg&&(<div style={{ padding:"12px 14px",borderRadius:10,marginBottom:12,background:scanMsg.ok?T.greenBg:"#fffbeb",border:`1px solid ${scanMsg.ok?"#a7f3d0":"#fde68a"}`,display:"flex",alignItems:"center",gap:10 }}><span style={{ fontSize:20 }}>{scanMsg.ok?"✅":"📦"}</span><div><div style={{ fontSize:12,fontWeight:600,color:scanMsg.ok?T.green:T.yellow }}>{scanMsg.ok?"Encontrado":"Nuevo producto"}</div><div style={{ fontSize:13,color:T.sub }}>{scanMsg.text}</div></div></div>)}
            <div style={{ display:"flex",gap:8 }}>
              <input value={manualCode} onChange={e=>setManualCode(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){handleCode(manualCode);setManualCode("");}}} placeholder="Código manual..." style={{ ...inputStyle,flex:1 }} />
              <button onClick={()=>{handleCode(manualCode);setManualCode("");}} style={{ ...primaryBtn,width:46,height:46,borderRadius:10,fontSize:18,flexShrink:0 }}>→</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex:1,overflowY:"auto",padding:16 }}>
        <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:14,boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>📋 Datos del pedido</div>
          <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
            <input value={proveedor} onChange={e=>setProveedor(e.target.value)} placeholder="Proveedor / Distribuidor" style={inputStyle} />
            <input value={factura} onChange={e=>setFactura(e.target.value)} placeholder="N° Factura / Guía de despacho" style={inputStyle} />
            <input value={montoFactura} onChange={e=>setMontoFactura(e.target.value)} placeholder="Monto total factura $" type="number" style={inputStyle} />
          </div>
        </div>

        <button onClick={()=>setShowScanner(true)} style={{ ...primaryBtn,width:"100%",padding:15,borderRadius:12,fontSize:14,fontWeight:600,marginBottom:10 }}>
          📷 Escanear productos recibidos
        </button>
        <div style={{ display:"flex",gap:8,marginBottom:14 }}>
          <input value={manualCode} onChange={e=>setManualCode(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){handleCode(manualCode);setManualCode("");}}} placeholder="O ingresa código manual..." style={{ ...inputStyle,flex:1 }} />
          <button onClick={()=>{handleCode(manualCode);setManualCode("");}} style={{ ...primaryBtn,width:46,height:46,borderRadius:10,fontSize:18,flexShrink:0 }}>→</button>
        </div>

        {items.length===0 ? (
          <div style={{ textAlign:"center",color:T.muted,marginTop:40,fontSize:13 }}>
            <div style={{ fontSize:40,marginBottom:12 }}>📦</div>Escanea los productos del pedido
          </div>
        ) : (
          <>
            <div style={{ fontSize:12,color:T.muted,fontWeight:500,marginBottom:12 }}>
              {items.length} productos · Costo total: <b style={{color:T.text}}>${totalCosto.toLocaleString("es-CL")}</b>
            </div>
            {items.map(item=>(
              <div key={item.id} style={{ background:"#fff",border:`1px solid ${item.nuevo?T.yellow:T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    {item.nuevo&&(<span style={{ fontSize:9,color:T.yellow,fontWeight:700,background:"#fffbeb",padding:"2px 7px",borderRadius:20,marginBottom:4,display:"inline-block" }}>NUEVO</span>)}
                    <div style={{ fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.name}</div>
                    <div style={{ fontSize:11,color:T.muted }}>{item.id}</div>
                  </div>
                  <button onClick={()=>removeItem(item.id)} style={{ width:30,height:30,borderRadius:8,border:"none",background:T.redBg,color:T.red,cursor:"pointer",fontSize:14 }}>✕</button>
                </div>
                {item.nuevo&&(<input value={item.name.startsWith("Código:")?"":(item.name)} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="Nombre del producto" style={{ ...inputStyle,marginBottom:8 }} />)}
                <div style={{ display:"flex",gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11,color:T.muted,marginBottom:4 }}>Cantidad</div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <button onClick={()=>updateItem(item.id,"qty",Math.max(1,item.qty-1))} style={{ width:30,height:30,borderRadius:8,border:`1.5px solid ${T.border}`,background:"#fff",color:T.text,fontSize:16,cursor:"pointer" }}>−</button>
                      <input type="number" value={item.qty} onChange={e=>updateItem(item.id,"qty",Number(e.target.value)||1)} style={{ ...inputStyle,width:55,textAlign:"center",padding:"8px 4px" }} />
                      <button onClick={()=>updateItem(item.id,"qty",item.qty+1)} style={{ width:30,height:30,borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>+</button>
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11,color:T.muted,marginBottom:4 }}>Costo unit. $</div>
                    <input type="number" value={item.costo} onChange={e=>updateItem(item.id,"costo",Number(e.target.value)||0)} placeholder="$0" style={{ ...inputStyle,padding:"8px 10px" }} />
                  </div>
                </div>
                <div style={{ fontSize:12,color:T.green,fontWeight:600,marginTop:8,textAlign:"right" }}>
                  Subtotal: ${((Number(item.costo)||0)*item.qty).toLocaleString("es-CL")}
                </div>
              </div>
            ))}

            <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                <span style={{ color:T.muted }}>Total unidades</span>
                <span style={{ fontWeight:700 }}>{items.reduce((a,i)=>a+i.qty,0)}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:montoFactura?6:0 }}>
                <span style={{ color:T.muted }}>Costo total</span>
                <span style={{ fontWeight:700,color:T.red }}>${totalCosto.toLocaleString("es-CL")}</span>
              </div>
              {montoFactura&&(
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13 }}>
                  <span style={{ color:T.muted }}>Monto factura</span>
                  <span style={{ fontWeight:700,color:Number(montoFactura)===totalCosto?T.green:T.yellow }}>
                    ${Number(montoFactura).toLocaleString("es-CL")} {Number(montoFactura)!==totalCosto&&"⚠"}
                  </span>
                </div>
              )}
            </div>

            <button onClick={confirmar} style={{ ...greenBtn,width:"100%",padding:16,borderRadius:12,fontSize:15,fontWeight:700 }}>
              ✓ Confirmar recepción del pedido
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE APERTURA DE CAJA
// ══════════════════════════════════════════════════════════════════════════════
function AperturaCaja({ usuario, cajaMinima, onAbrir, onLogout }) {
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");

  const handleAbrir = async () => {
    const m = Number(monto);
    if (!monto || isNaN(m) || m < 0) { setError("Ingresa un monto válido"); return; }
    if (cajaMinima > 0 && m < cajaMinima) {
      setError(`El monto mínimo de apertura es ${fmt(cajaMinima)}`);
      return;
    }
    const apertura = {
      vendedor: usuario.nombre,
      montoApertura: m,
      fechaApertura: now(),
      fechaTs: Date.now(),
      estado: "abierta",
    };
    await addDoc(collection(db, "cajas"), apertura);
    onAbrir(m);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a56db,#059669)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:20, fontFamily:T.font }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28,
        width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>

        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>💰</div>
          <div style={{ fontSize:20, fontWeight:700, color:T.text }}>Apertura de Caja</div>
          <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>👤 {usuario.nombre}</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.sub, marginBottom:8 }}>
            Monto inicial en caja (efectivo)
          </div>
          <input
            type="number"
            value={monto}
            onChange={e => { setMonto(e.target.value); setError(""); }}
            onKeyDown={e => e.key==="Enter" && handleAbrir()}
            placeholder="Ej: 10000"
            style={{ ...inputStyle, fontSize:20, fontWeight:700, textAlign:"center" }}
          />
          {cajaMinima > 0 && (
            <div style={{ fontSize:12, color:T.muted, marginTop:6, textAlign:"center" }}>
              Mínimo requerido: <b>{fmt(cajaMinima)}</b>
            </div>
          )}
        </div>

        {/* Montos rápidos */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[5000, 10000, 20000, 50000].map(v => (
            <button key={v} onClick={() => setMonto(v)}
              style={{ flex:1, padding:"9px 0", borderRadius:9, cursor:"pointer",
                fontFamily:T.font, fontSize:12, fontWeight:600,
                border:Number(monto)===v?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                background:Number(monto)===v?T.accentBg:"#fff",
                color:Number(monto)===v?T.accent:T.sub }}>
              {fmt(v)}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background:T.redBg, border:`1px solid #fecaca`, borderRadius:10,
            padding:"10px 14px", marginBottom:14, fontSize:13, color:T.red, fontWeight:500 }}>
            ⚠ {error}
          </div>
        )}

        <button onClick={handleAbrir}
          style={{ ...greenBtn, width:"100%", padding:16, borderRadius:12, fontSize:15, fontWeight:700, marginBottom:10 }}>
          ✓ Abrir caja · {monto ? fmt(Number(monto)) : "$0"}
        </button>

        <button onClick={onLogout}
          style={{ ...ghostBtn, width:"100%", padding:12, borderRadius:12, fontSize:14 }}>
          ← Volver al login
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE CIERRE DE CAJA
// ══════════════════════════════════════════════════════════════════════════════
function CierreCaja({ usuario, montoApertura, sales, onCerrar, onCancelar }) {
  const [conteoEfectivo, setConteoEfectivo] = useState("");
  const [cerrado, setCerrado] = useState(false);

  const misSales = sales.filter(s => s.vendedor === usuario.nombre);
  const totalEfectivo = misSales.filter(s=>s.payMethod==="efectivo").reduce((a,x)=>a+x.total,0);
  const totalDebito   = misSales.filter(s=>s.payMethod==="débito").reduce((a,x)=>a+x.total,0);
  const totalCredito  = misSales.filter(s=>s.payMethod==="crédito").reduce((a,x)=>a+x.total,0);
  const totalTransfer = misSales.filter(s=>s.payMethod==="transferencia").reduce((a,x)=>a+x.total,0);
  const totalVentas   = misSales.reduce((a,x)=>a+x.total,0);
  const efectivoEsperado = montoApertura + totalEfectivo;
  const diferencia = conteoEfectivo ? Number(conteoEfectivo) - efectivoEsperado : null;

  const handleCerrar = async () => {
    const cierre = {
      vendedor: usuario.nombre,
      montoApertura,
      totalVentas,
      totalEfectivo,
      totalDebito,
      totalCredito,
      totalTransfer,
      efectivoEsperado,
      conteoEfectivo: Number(conteoEfectivo) || 0,
      diferencia: diferencia || 0,
      cantidadVentas: misSales.length,
      fechaCierre: now(),
      fechaTs: Date.now(),
    };
    await addDoc(collection(db, "cierres"), cierre);
    setCerrado(true);
    setTimeout(() => onCerrar(), 2500);
  };

  if (cerrado) return (
    <div style={{ minHeight:"100vh", background:"#f4f5f7", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:T.font }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:20, fontWeight:700, color:T.green }}>¡Caja cerrada!</div>
        <div style={{ fontSize:13, color:T.muted, marginTop:8 }}>Hasta pronto {usuario.nombre}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:T.font,
      display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>

      <div style={{ background:"#059669", padding:"14px 16px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)" }}>CIERRE DE CAJA</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>👤 {usuario.nombre}</div>
        </div>
        <button onClick={onCancelar}
          style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:9,
            color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:13, fontFamily:T.font }}>
          ← Volver
        </button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* Resumen ventas */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12,
          padding:"14px 16px", marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>
            Resumen del turno
          </div>
          {[
            ["Ventas realizadas", misSales.length + " venta(s)"],
            ["Total vendido", fmt(totalVentas)],
          ].map(([label,val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between",
              padding:"7px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
              <span style={{ color:T.muted }}>{label}</span>
              <span style={{ fontWeight:700, color:T.text }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Desglose por medio de pago */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12,
          padding:"14px 16px", marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>
            Por medio de pago
          </div>
          {[
            ["💵 Efectivo en ventas", totalEfectivo],
            ["💳 Débito", totalDebito],
            ["💳 Crédito", totalCredito],
            ["📲 Transferencia", totalTransfer],
          ].map(([label,val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between",
              padding:"7px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
              <span style={{ color:T.muted }}>{label}</span>
              <span style={{ fontWeight:700, color:val>0?T.text:T.muted }}>{fmt(val)}</span>
            </div>
          ))}
        </div>

        {/* Conteo de efectivo */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12,
          padding:"14px 16px", marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>
            Conteo de efectivo en caja
          </div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>
            Apertura: {fmt(montoApertura)} + Ventas: {fmt(totalEfectivo)} = <b>Esperado: {fmt(efectivoEsperado)}</b>
          </div>
          <input type="number" value={conteoEfectivo}
            onChange={e => setConteoEfectivo(e.target.value)}
            placeholder="Cuenta el efectivo físico..."
            style={{ ...inputStyle, fontSize:18, fontWeight:700, textAlign:"center" }} />

          {conteoEfectivo && diferencia !== null && (
            <div style={{ marginTop:12, padding:"12px 16px", borderRadius:10,
              background: diferencia===0?"#f0fdf4":diferencia>0?"#eff4ff":T.redBg,
              border: `1px solid ${diferencia===0?"#bbf7d0":diferencia>0?"#bfdbfe":"#fecaca"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:14, fontWeight:600,
                  color: diferencia===0?T.green:diferencia>0?T.accent:T.red }}>
                  {diferencia===0?"✓ Cuadra perfecto":diferencia>0?"↑ Sobran":differencia<0?"↓ Faltan":""}
                </span>
                <span style={{ fontSize:22, fontWeight:800,
                  color: diferencia===0?T.green:diferencia>0?T.accent:T.red }}>
                  {diferencia===0?"$0":fmt(Math.abs(diferencia))}
                </span>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleCerrar}
          style={{ ...primaryBtn, width:"100%", padding:16, borderRadius:12,
            fontSize:15, fontWeight:700, background:"#7c3aed",
            boxShadow:"0 2px 8px rgba(124,58,237,0.3)" }}>
          Confirmar cierre de caja
        </button>
      </div>
    </div>
  );
}
function LoginScreen({ vendedores, onLogin, onAdmin }) {
  const [mode, setMode]     = useState("vendedor"); // vendedor | admin
  const [nombre, setNombre] = useState("");
  const [pass, setPass]     = useState("");
  const [error, setError]   = useState("");

  const handleVendedor = () => {
    if (!nombre.trim()) { setError("Ingresa tu nombre"); return; }
    onLogin({ nombre: nombre.trim(), rol: "vendedor" });
  };

  const handleAdmin = () => {
    if (pass === ADMIN_PASS) { onAdmin(); }
    else { setError("Contraseña incorrecta"); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a56db,#7c3aed)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:T.font }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:380,
        boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>

        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🏪</div>
          <div style={{ fontSize:20, fontWeight:700, color:T.text }}>Terminal POS</div>
          <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>Sistema de Punto de Venta</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:T.bg, borderRadius:12, padding:4, marginBottom:20 }}>
          {[["vendedor","👤 Vendedor"],["admin","🔐 Admin"]].map(([v,label]) => (
            <button key={v} onClick={() => { setMode(v); setError(""); }}
              style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", cursor:"pointer",
                fontFamily:T.font, fontSize:13, fontWeight:600, transition:"all 0.15s",
                background: mode===v ? "#fff" : "transparent",
                color: mode===v ? (v==="admin"?T.admin:T.accent) : T.muted,
                boxShadow: mode===v ? shadow : "none" }}>
              {label}
            </button>
          ))}
        </div>

        {mode === "vendedor" ? (
          <>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:6 }}>Tu nombre</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleVendedor()}
                placeholder="Ej: María, Juan..." style={inputStyle} />
            </div>
            {vendedores.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,color:T.muted,marginBottom:8 }}>O selecciona tu nombre:</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
                  {vendedores.map(v => (
                    <button key={v.id} onClick={() => setNombre(v.nombre)}
                      style={{ padding:"7px 14px",borderRadius:20,border:`1.5px solid ${T.border}`,
                        background:nombre===v.nombre?T.accentBg:"#fff",
                        color:nombre===v.nombre?T.accent:T.sub,
                        fontFamily:T.font,fontSize:13,fontWeight:500,cursor:"pointer" }}>
                      {v.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <div style={{ color:T.red,fontSize:12,marginBottom:10 }}>⚠ {error}</div>}
            <button onClick={handleVendedor}
              style={{ ...primaryBtn,width:"100%",padding:14,borderRadius:12,fontSize:15 }}>
              Entrar a la caja
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:6 }}>Contraseña admin</div>
              <input value={pass} onChange={e => setPass(e.target.value)} type="password"
                onKeyDown={e => e.key==="Enter" && handleAdmin()}
                placeholder="••••••••" style={inputStyle} />
            </div>
            {error && <div style={{ color:T.red,fontSize:12,marginBottom:10 }}>⚠ {error}</div>}
            <button onClick={handleAdmin}
              style={{ ...adminBtn,width:"100%",padding:14,borderRadius:12,fontSize:15 }}>
              <LockIcon /> Entrar como Admin
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANEL ADMIN
// ══════════════════════════════════════════════════════════════════════════════
function AdminPanel({ products, sales, vendedores, cajaMinima, onLogout, onSaveProduct, onDeleteProduct, onSaveCajaMinima }) {
  const [tab, setTab]           = useState("resumen");
  const [editProduct, setEditProduct] = useState(null);
  const [newVendedor, setNewVendedor] = useState("");
  const [search, setSearch]     = useState("");
  const [flashMsg, setFlashMsg] = useState("");
  const [newCajaMinima, setNewCajaMinima] = useState(String(cajaMinima));
  const [filtroPeriodo, setFiltroPeriodo] = useState("hoy");
  const [pedidos, setPedidos] = useState([]);

  // Cargar pedidos desde Firebase
  useEffect(() => {
    const q = query(collection(db,"pedidos"), orderBy("fechaTs","desc"));
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d=>({...d.data(),fireId:d.id})));
    });
    return ()=>unsub();
  },[]);

  const filtrarPorPeriodo = (ventas, periodo) => {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    const lunesTs = hoy - ((ahora.getDay() || 7) - 1) * 86400000;
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    return ventas.filter(s => {
      const ts = s.dateTs || 0;
      if (periodo === "hoy")    return ts >= hoy;
      if (periodo === "semana") return ts >= lunesTs;
      if (periodo === "mes")    return ts >= inicioMes;
      return true;
    });
  };

  const flash = (msg) => { setFlashMsg(msg); setTimeout(()=>setFlashMsg(""),2000); };

  const productosAlerta = products.filter(p => p.stock <= (p.stockMin || 5));

  const addVendedor = async () => {
    if (!newVendedor.trim()) return;
    await addDoc(collection(db, "vendedores"), { nombre: newVendedor.trim(), activo: true });
    setNewVendedor("");
    flash("✓ Vendedor agregado");
  };

  const deleteVendedor = async (id) => {
    await deleteDoc(doc(db, "vendedores", id));
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:T.font,
      display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>

      <style>{`*{box-sizing:border-box;margin:0;padding:0} input::placeholder{color:#9ca3af} input:focus{border-color:${T.admin}!important;box-shadow:0 0 0 3px rgba(124,58,237,0.1)}`}</style>

      {flashMsg && (
        <div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",
          background:T.admin,color:"#fff",padding:"9px 18px",borderRadius:20,
          fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 4px 20px rgba(124,58,237,0.4)" }}>
          {flashMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ background:T.admin,padding:"14px 16px",display:"flex",
        alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200 }}>
        <div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:500 }}>PANEL DE ADMINISTRACIÓN</div>
          <div style={{ fontSize:16,fontWeight:700,color:"#fff" }}>🔐 Admin</div>
        </div>
        <button onClick={onLogout}
          style={{ background:"rgba(255,255,255,0.2)",border:"none",borderRadius:9,
            color:"#fff",padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:500 }}>
          Salir
        </button>
      </div>

      {/* Alertas stock */}
      {productosAlerta.length > 0 && (
        <div style={{ background:"#fffbeb",border:`1px solid #fde68a`,margin:"12px 16px 0",
          borderRadius:12,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start" }}>
          <span style={{ color:T.yellow,fontSize:20,flexShrink:0 }}><AlertIcon /></span>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:T.yellow }}>Stock bajo en {productosAlerta.length} producto(s)</div>
            <div style={{ fontSize:12,color:"#92400e",marginTop:3 }}>
              {productosAlerta.map(p=>`${p.name.substring(0,20)}: ${p.stock} ud`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex",background:"#fff",borderBottom:`1px solid ${T.border}`,marginTop:12,overflowX:"auto" }}>
        {[["resumen","Resumen"],["inventario","Inventario"],["vendedores","Vendedores"],["pedidos","Pedidos"],["historial","Historial"],["config","Config"]].map(([v,label]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flexShrink:0,padding:"11px 12px",background:"none",border:"none",
            borderBottom:tab===v?`2px solid ${T.admin}`:"2px solid transparent",
            color:tab===v?T.admin:T.muted,fontSize:10,fontWeight:tab===v?700:500,
            cursor:"pointer",fontFamily:T.font }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:16 }}>

        {/* ── RESUMEN ── */}
        {/* ── DASHBOARD RENTABILIDAD ── */}
        {tab==="resumen" && (() => {
          const sf = filtrarPorPeriodo(sales, filtroPeriodo);
          const IVA = 0.19;
          const totalVentas   = sf.reduce((a,s)=>a+s.total,0);
          const totalNeto     = sf.reduce((a,s)=>a+Math.round(s.total/(1+IVA)),0);
          const totalIVA      = totalVentas - totalNeto;

          // Calcular costo y ganancia por venta
          let totalCosto = 0;
          const rankMap = {};
          sf.forEach(sale => {
            sale.items?.forEach(item => {
              const prod = products.find(p=>p.id===item.id);
              const costo = (prod?.cost || 0) * item.qty;
              totalCosto += costo;
              if (!rankMap[item.id]) rankMap[item.id] = { name:item.name, qty:0, venta:0, costo:0 };
              rankMap[item.id].qty   += item.qty;
              rankMap[item.id].venta += item.price * item.qty;
              rankMap[item.id].costo += costo;
            });
          });
          const totalGanancia = totalVentas - totalCosto;
          const margenPct = totalVentas > 0 ? Math.round((totalGanancia/totalVentas)*100) : 0;

          const ranking = Object.values(rankMap).sort((a,b)=>b.qty-a.qty);
          const masVendidos = ranking.slice(0,5);
          const sinRotacion = products.filter(p => !rankMap[p.id] && p.stock > 0);

          // Ventas por hora (hoy)
          const porHora = Array(24).fill(0);
          sf.forEach(s => {
            if (s.dateTs) {
              const h = new Date(s.dateTs).getHours();
              porHora[h] += s.total;
            }
          });
          const maxHora = Math.max(...porHora, 1);
          const horasActivas = porHora.map((v,h) => ({ h, v })).filter(x=>x.v>0);

          return (
            <div>
              {/* Filtro período */}
              <div style={{ display:"flex",gap:7,marginBottom:16 }}>
                {[["hoy","Hoy"],["semana","Semana"],["mes","Mes"],["todo","Todo"]].map(([v,label])=>(
                  <button key={v} onClick={()=>setFiltroPeriodo(v)} style={{
                    flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                    fontSize:11,fontWeight:600,
                    border:filtroPeriodo===v?`2px solid ${T.admin}`:`2px solid ${T.border}`,
                    background:filtroPeriodo===v?T.adminBg:"#fff",
                    color:filtroPeriodo===v?T.admin:T.muted,
                  }}>{label}</button>
                ))}
              </div>

              {/* KPIs principales */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
                {[
                  { label:"Ventas totales",  val:fmt(totalVentas),   color:T.accent },
                  { label:"Ganancia neta",   val:fmt(totalGanancia), color:T.green  },
                  { label:`Margen promedio`, val:`${margenPct}%`,    color:T.admin  },
                  { label:"N° de boletas",   val:sf.length,          color:T.yellow },
                ].map(({label,val,color})=>(
                  <div key={label} style={{ background:"#fff",border:`1px solid ${T.border}`,
                    borderRadius:12,padding:"14px 16px",boxShadow:shadow }}>
                    <div style={{ fontSize:11,color:T.muted,fontWeight:500,marginBottom:6 }}>{label}</div>
                    <div style={{ fontSize:22,fontWeight:800,color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Desglose financiero */}
              <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
                padding:"14px 16px",marginBottom:14,boxShadow:shadow }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
                  💰 Desglose financiero
                </div>
                {[
                  ["Ventas brutas",    fmt(totalVentas),   T.text  ],
                  ["Costo mercadería", fmt(totalCosto),    T.red   ],
                  ["IVA 19%",          fmt(totalIVA),      T.muted ],
                  ["Neto s/IVA",       fmt(totalNeto),     T.muted ],
                ].map(([label,val,color])=>(
                  <div key={label} style={{ display:"flex",justifyContent:"space-between",
                    padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
                    <span style={{ color:T.muted }}>{label}</span>
                    <span style={{ fontWeight:700,color }}>{val}</span>
                  </div>
                ))}
                <div style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:14 }}>
                  <span style={{ fontWeight:700,color:T.green }}>✓ Ganancia neta</span>
                  <span style={{ fontWeight:800,color:T.green,fontSize:18 }}>{fmt(totalGanancia)}</span>
                </div>
              </div>

              {/* Ventas por medio de pago */}
              <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
                padding:"14px 16px",marginBottom:14,boxShadow:shadow }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
                  💳 Por medio de pago
                </div>
                {[["efectivo","💵"],["débito","💳"],["crédito","💳"],["transferencia","📲"]].map(([m,ico])=>{
                  const v = sf.filter(s=>s.payMethod===m).reduce((a,x)=>a+x.total,0);
                  return (
                    <div key={m} style={{ display:"flex",justifyContent:"space-between",
                      padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
                      <span style={{ color:T.sub,textTransform:"capitalize" }}>{ico} {m}</span>
                      <span style={{ fontWeight:700,color:v>0?T.text:T.muted }}>{fmt(v)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Top productos más vendidos */}
              {masVendidos.length > 0 && (
                <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
                  padding:"14px 16px",marginBottom:14,boxShadow:shadow }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
                    🏆 Más vendidos
                  </div>
                  {masVendidos.map((p,i)=>{
                    const gan = p.venta - p.costo;
                    const mgn = p.venta > 0 ? Math.round((gan/p.venta)*100) : 0;
                    return (
                      <div key={p.name} style={{ display:"flex",alignItems:"center",gap:10,
                        padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div style={{ width:24,height:24,borderRadius:"50%",
                          background:i===0?"#fbbf24":i===1?"#9ca3af":i===2?"#92400e":T.accentBg,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:11,fontWeight:700,color:"#fff",flexShrink:0 }}>
                          {i+1}
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:12,fontWeight:600,color:T.text,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize:11,color:T.muted,marginTop:2 }}>
                            {p.qty} unid · Ganancia: {fmt(gan)} · Margen: {mgn}%
                          </div>
                        </div>
                        <div style={{ fontSize:14,fontWeight:700,color:T.green,flexShrink:0 }}>
                          {fmt(p.venta)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Productos sin rotación */}
              {sinRotacion.length > 0 && (
                <div style={{ background:"#fff",border:`1px solid ${T.yellow}`,borderRadius:12,
                  padding:"14px 16px",marginBottom:14,boxShadow:shadow }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.yellow,marginBottom:12 }}>
                    🐌 Sin rotación en este período ({sinRotacion.length})
                  </div>
                  {sinRotacion.slice(0,5).map(p=>(
                    <div key={p.id} style={{ display:"flex",justifyContent:"space-between",
                      padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:12 }}>
                      <span style={{ color:T.sub }}>{p.name.substring(0,28)}</span>
                      <span style={{ color:T.muted }}>Stock: {p.stock}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Ventas por vendedor */}
              {vendedores.length > 0 && (
                <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
                  padding:"14px 16px",marginBottom:14,boxShadow:shadow }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
                    👤 Por vendedor
                  </div>
                  {vendedores.map(v=>{
                    const vv = sf.filter(s=>s.vendedor===v.nombre);
                    const tot = vv.reduce((a,x)=>a+x.total,0);
                    return (
                      <div key={v.id} style={{ display:"flex",justifyContent:"space-between",
                        padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
                        <span style={{ color:T.sub }}>👤 {v.nombre}</span>
                        <span style={{ color:T.muted,fontSize:12 }}>
                          {vv.length} venta(s) · <b style={{color:T.text}}>{fmt(tot)}</b>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alertas stock */}
              {productosAlerta.length > 0 && (
                <div style={{ background:T.redBg,border:`1px solid #fecaca`,borderRadius:12,
                  padding:"14px 16px",boxShadow:shadow }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.red,marginBottom:8 }}>
                    ⚠ Stock bajo — {productosAlerta.length} producto(s)
                  </div>
                  {productosAlerta.map(p=>(
                    <div key={p.id} style={{ display:"flex",justifyContent:"space-between",
                      padding:"5px 0",fontSize:12 }}>
                      <span style={{ color:T.sub }}>{p.name.substring(0,28)}</span>
                      <span style={{ color:T.red,fontWeight:600 }}>{p.stock} unid</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── INVENTARIO ── */}
        {tab==="inventario" && (
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:600,color:T.sub }}>{products.length} productos</div>
              <button onClick={() => setEditProduct({ id:"",name:"",price:0,stock:0,stockMin:5,category:"" })}
                style={{ ...adminBtn,padding:"8px 16px",borderRadius:9,fontSize:13 }}>+ Nuevo</button>
            </div>

            <div style={{ marginBottom:14 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar producto..." style={inputStyle} />
            </div>

            {editProduct && (
              <div style={{ background:T.adminBg,border:`1.5px solid ${T.admin}`,
                borderRadius:12,padding:16,marginBottom:16 }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.admin,marginBottom:12 }}>
                  {editProduct.name?"Editar producto":"Nuevo producto"}
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  <input value={editProduct.id} onChange={e=>setEditProduct(p=>({...p,id:e.target.value}))}
                    placeholder="Código de barras (EAN-13)" style={inputStyle} />
                  <input value={editProduct.name} onChange={e=>setEditProduct(p=>({...p,name:e.target.value}))}
                    placeholder="Nombre del producto" style={inputStyle} />
                  <input value={editProduct.category} onChange={e=>setEditProduct(p=>({...p,category:e.target.value}))}
                    placeholder="Categoría" style={inputStyle} />
                  <div style={{ display:"flex",gap:8 }}>
                    <input value={editProduct.price} onChange={e=>setEditProduct(p=>({...p,price:Number(e.target.value)}))}
                      placeholder="Precio venta $" type="number" style={inputStyle} />
                    <input value={editProduct.cost||""} onChange={e=>setEditProduct(p=>({...p,cost:Number(e.target.value)}))}
                      placeholder="Precio costo $" type="number" style={inputStyle} />
                  </div>
                  {editProduct.price > 0 && editProduct.cost > 0 && (
                    <div style={{ background:T.greenBg,border:`1px solid #a7f3d0`,borderRadius:9,
                      padding:"8px 12px",fontSize:12,color:T.green,fontWeight:500 }}>
                      Margen: {fmt(editProduct.price - editProduct.cost)} ({Math.round(((editProduct.price-editProduct.cost)/editProduct.price)*100)}%)
                    </div>
                  )}
                  <div style={{ display:"flex",gap:8 }}>
                    <input value={editProduct.stock} onChange={e=>setEditProduct(p=>({...p,stock:Number(e.target.value)}))}
                      placeholder="Stock" type="number" style={inputStyle} />
                    <input value={editProduct.stockMin||5} onChange={e=>setEditProduct(p=>({...p,stockMin:Number(e.target.value)}))}
                      placeholder="Stock mínimo" type="number" style={inputStyle} />
                  </div>
                  <div style={{ display:"flex",gap:8,marginTop:4 }}>
                    <button onClick={() => { onSaveProduct(editProduct); setEditProduct(null); flash("✓ Guardado"); }}
                      style={{ ...greenBtn,flex:1,padding:12,borderRadius:10,fontSize:14 }}>Guardar</button>
                    <button onClick={() => setEditProduct(null)}
                      style={{ ...ghostBtn,flex:1,padding:12,borderRadius:10,fontSize:14 }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {filtered.map(p => (
              <div key={p.id} style={{ background:"#fff",border:`1px solid ${p.stock<=(p.stockMin||5)?T.yellow:T.border}`,
                borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10,
                boxShadow:shadow }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:T.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                  <div style={{ display:"flex",gap:12,marginTop:4,alignItems:"center" }}>
                    <span style={{ fontSize:14,fontWeight:700,color:T.text }}>{fmt(p.price)}</span>
                    <span style={{ fontSize:12,color:p.stock<=(p.stockMin||5)?T.yellow:T.muted,fontWeight:500 }}>
                      {p.stock<=(p.stockMin||5)?"⚠ ":""}{p.stock} en stock
                    </span>
                  </div>
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button onClick={() => setEditProduct({...p})}
                    style={{ width:34,height:34,borderRadius:9,border:`1.5px solid ${T.border}`,
                      background:"#fff",color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <EditIcon />
                  </button>
                  <button onClick={() => onDeleteProduct(p.id)}
                    style={{ width:34,height:34,borderRadius:9,border:"none",
                      background:T.redBg,color:T.red,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VENDEDORES ── */}
        {tab==="vendedores" && (
          <div>
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:14 }}>
              Gestión de vendedores
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:16 }}>
              <input value={newVendedor} onChange={e=>setNewVendedor(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addVendedor()}
                placeholder="Nombre del vendedor..." style={{ ...inputStyle,flex:1 }} />
              <button onClick={addVendedor}
                style={{ ...adminBtn,padding:"11px 16px",borderRadius:10,fontSize:14,flexShrink:0 }}>
                + Agregar
              </button>
            </div>
            {vendedores.length === 0 ? (
              <div style={{ textAlign:"center",color:T.muted,marginTop:40,fontSize:13 }}>
                <div style={{ fontSize:40,marginBottom:12 }}>👤</div>
                Sin vendedores registrados
              </div>
            ) : vendedores.map(v => (
              <div key={v.id} style={{ background:"#fff",border:`1px solid ${T.border}`,
                borderRadius:10,padding:"12px 14px",marginBottom:8,
                display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:shadow }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:"50%",background:T.adminBg,
                    display:"flex",alignItems:"center",justifyContent:"center",color:T.admin }}>
                    <UserIcon />
                  </div>
                  <div>
                    <div style={{ fontSize:14,fontWeight:600,color:T.text }}>{v.nombre}</div>
                    <div style={{ fontSize:12,color:T.muted }}>
                      {sales.filter(s=>s.vendedor===v.nombre).length} venta(s) hoy
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteVendedor(v.id)}
                  style={{ width:34,height:34,borderRadius:9,border:"none",
                    background:T.redBg,color:T.red,cursor:"pointer",display:"flex",
                    alignItems:"center",justifyContent:"center" }}>
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── PEDIDOS ── */}
        {tab==="pedidos" && (
          <div>
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:14 }}>
              📦 Pedidos recibidos — {pedidos.length} registros
            </div>

            {/* Resumen compras */}
            {pedidos.length > 0 && (
              <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
                padding:"14px 16px",marginBottom:14,boxShadow:shadow }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
                  Resumen de compras
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                  <span style={{ color:T.muted }}>Total pedidos</span>
                  <span style={{ fontWeight:700,color:T.text }}>{pedidos.length}</span>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6 }}>
                  <span style={{ color:T.muted }}>Total invertido</span>
                  <span style={{ fontWeight:700,color:T.red }}>
                    {fmt(pedidos.reduce((a,p)=>a+(p.montoFactura||p.totalCosto||0),0))}
                  </span>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13 }}>
                  <span style={{ color:T.muted }}>Unidades recibidas</span>
                  <span style={{ fontWeight:700,color:T.text }}>
                    {pedidos.reduce((a,p)=>a+(p.items?.reduce((b,i)=>b+i.qty,0)||0),0)}
                  </span>
                </div>
              </div>
            )}

            {pedidos.length === 0 ? (
              <div style={{ textAlign:"center",color:T.muted,marginTop:40,fontSize:13 }}>
                <div style={{ fontSize:40,marginBottom:12 }}>📦</div>
                Sin pedidos registrados aún
              </div>
            ) : pedidos.map(p => (
              <div key={p.fireId} style={{ background:"#fff",border:`1px solid ${T.border}`,
                borderRadius:12,padding:"14px 16px",marginBottom:12,boxShadow:shadow }}>

                {/* Header pedido */}
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text }}>
                      🏢 {p.proveedor}
                    </div>
                    <div style={{ fontSize:12,color:T.muted,marginTop:2 }}>
                      📋 Guía/Factura: <b style={{color:T.sub}}>{p.factura}</b>
                    </div>
                    <div style={{ fontSize:12,color:T.muted,marginTop:2 }}>
                      👤 Recibió: {p.encargado} · {p.fecha}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:16,fontWeight:700,color:T.red }}>
                      {fmt(p.montoFactura||p.totalCosto||0)}
                    </div>
                    <div style={{ fontSize:11,color:T.muted,marginTop:2 }}>factura</div>
                  </div>
                </div>

                {/* Línea divisora */}
                <div style={{ height:1,background:T.border,marginBottom:10 }} />

                {/* Productos del pedido */}
                <div style={{ fontSize:11,color:T.muted,fontWeight:600,marginBottom:8,
                  letterSpacing:"0.05em",textTransform:"uppercase" }}>
                  Productos recibidos
                </div>
                {p.items?.map((item,i) => (
                  <div key={i} style={{ display:"flex",justifyContent:"space-between",
                    alignItems:"center",padding:"6px 0",
                    borderBottom:`1px solid ${T.border}`,fontSize:12 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        {item.name}
                      </div>
                      <div style={{ color:T.muted,fontSize:11,marginTop:1 }}>
                        {item.id}
                      </div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0,marginLeft:10 }}>
                      <div style={{ color:T.text,fontWeight:600 }}>
                        x{item.qty} · {fmt(item.costo||0)} c/u
                      </div>
                      <div style={{ color:T.green,fontSize:11,fontWeight:600 }}>
                        {fmt((item.costo||0)*item.qty)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total pedido */}
                <div style={{ display:"flex",justifyContent:"space-between",
                  padding:"10px 0 0",fontSize:13 }}>
                  <span style={{ color:T.muted }}>
                    {p.items?.reduce((a,i)=>a+i.qty,0)} unidades
                  </span>
                  <span style={{ fontWeight:700,color:T.red }}>
                    Costo: {fmt(p.totalCosto||0)}
                  </span>
                </div>

                {/* Alerta si no cuadra */}
                {p.montoFactura > 0 && p.montoFactura !== p.totalCosto && (
                  <div style={{ background:"#fffbeb",border:"1px solid #fde68a",
                    borderRadius:8,padding:"8px 12px",marginTop:8,fontSize:11,
                    color:T.yellow,fontWeight:500 }}>
                    ⚠ Diferencia: {fmt(Math.abs(p.montoFactura - p.totalCosto))} entre factura y costo ingresado
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORIAL ADMIN ── */}
        {tab==="historial" && (
          <div>
            {/* Filtros y exportación */}
            <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
              padding:"14px 16px",marginBottom:16,boxShadow:shadow }}>
              <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
                📊 Exportar libro de ventas (SII)
              </div>

              {/* Período */}
              <div style={{ fontSize:12,fontWeight:600,color:T.muted,marginBottom:8 }}>Período</div>
              <div style={{ display:"flex",gap:7,marginBottom:14 }}>
                {[["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["todo","Todo"]].map(([v,label]) => (
                  <button key={v} onClick={() => setFiltroPeriodo(v)} style={{
                    flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                    fontSize:11,fontWeight:600,transition:"all 0.12s",
                    border:filtroPeriodo===v?`2px solid ${T.admin}`:`2px solid ${T.border}`,
                    background:filtroPeriodo===v?T.adminBg:"#fff",
                    color:filtroPeriodo===v?T.admin:T.muted,
                  }}>{label}</button>
                ))}
              </div>

              {/* Resumen filtrado */}
              {(() => {
                const sf = filtrarPorPeriodo(sales, filtroPeriodo);
                const IVA = 0.19;
                const totalNeto = sf.reduce((a,s)=>a+Math.round(s.total/(1+IVA)),0);
                const totalIVA  = sf.reduce((a,s)=>a+(s.total-Math.round(s.total/(1+IVA))),0);
                return (
                  <div style={{ background:T.adminBg,borderRadius:10,padding:"12px 14px",marginBottom:12 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6 }}>
                      <span style={{ color:T.muted }}>Boletas del período</span>
                      <span style={{ fontWeight:700,color:T.text }}>{sf.length}</span>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6 }}>
                      <span style={{ color:T.muted }}>Neto</span>
                      <span style={{ fontWeight:700,color:T.text }}>{fmt(totalNeto)}</span>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6 }}>
                      <span style={{ color:T.muted }}>IVA 19%</span>
                      <span style={{ fontWeight:700,color:T.text }}>{fmt(totalIVA)}</span>
                    </div>
                    <div style={{ height:1,background:T.border,margin:"8px 0" }} />
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:14 }}>
                      <span style={{ fontWeight:600,color:T.admin }}>Total</span>
                      <span style={{ fontWeight:800,color:T.admin }}>{fmt(sf.reduce((a,s)=>a+s.total,0))}</span>
                    </div>
                  </div>
                );
              })()}

              <button onClick={() => {
                  const sf = filtrarPorPeriodo(sales, filtroPeriodo);
                  exportCSV(sf, filtroPeriodo);
                }}
                style={{ ...adminBtn,width:"100%",padding:13,borderRadius:10,fontSize:14 }}>
                ⬇ Descargar CSV para SII
              </button>
            </div>

            {/* Lista ventas */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:12 }}>
              {filtrarPorPeriodo(sales,filtroPeriodo).length} ventas · {filtroPeriodo}
            </div>
            {filtrarPorPeriodo(sales,filtroPeriodo).length===0 ? (
              <div style={{ textAlign:"center",color:T.muted,marginTop:30,fontSize:13 }}>
                <div style={{ fontSize:36,marginBottom:10 }}>📋</div>Sin ventas en este período
              </div>
            ) : filtrarPorPeriodo(sales,filtroPeriodo).map(sale => (
              <div key={sale.fireId||sale.id} style={{ background:"#fff",border:`1px solid ${T.border}`,
                borderRadius:10,padding:"13px 15px",marginBottom:10,boxShadow:shadow }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:11,color:T.muted }}>N° {sale.id}</div>
                    <div style={{ fontSize:11,color:T.muted }}>{sale.date}</div>
                    {sale.vendedor&&<div style={{ fontSize:12,color:T.admin,fontWeight:600,marginTop:2 }}>👤 {sale.vendedor}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18,fontWeight:700,color:T.text }}>{fmt(sale.total)}</div>
                    <div style={{ fontSize:11,color:T.muted,textTransform:"capitalize" }}>{sale.payMethod}</div>
                  </div>
                </div>
                <div style={{ fontSize:11,color:T.muted }}>
                  {sale.items?.map(i=>`${i.name.substring(0,20)} x${i.qty}`).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ── CONFIG ── */}
        {tab==="config" && (
          <div>
            <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
              padding:"14px 16px",marginBottom:16,boxShadow:shadow }}>
              <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:4 }}>
                💰 Monto mínimo de apertura de caja
              </div>
              <div style={{ fontSize:12,color:T.muted,marginBottom:12 }}>
                Los vendedores no podrán abrir caja con menos de este monto
              </div>
              <input type="number" value={newCajaMinima}
                onChange={e=>setNewCajaMinima(e.target.value)}
                placeholder="Ej: 10000" style={inputStyle} />
              <button onClick={async()=>{
                  await onSaveCajaMinima(Number(newCajaMinima)||0);
                  flash("✓ Monto mínimo guardado");
                }}
                style={{ ...adminBtn,width:"100%",padding:12,borderRadius:10,fontSize:14,marginTop:10 }}>
                Guardar configuración
              </button>
            </div>

            {/* Historial de cierres */}
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
              Historial de cierres de caja
            </div>
            <CierresAdmin />
          </div>
        )}
      </div>
    </div>
  );
}

function CierresAdmin() {
  const [cierres, setCierres] = useState([]);
  useEffect(() => {
    const q = query(collection(db,"cierres"), orderBy("fechaTs","desc"));
    const unsub = onSnapshot(q, snap => {
      setCierres(snap.docs.map(d=>({...d.data(),id:d.id})));
    });
    return ()=>unsub();
  },[]);

  if (cierres.length===0) return (
    <div style={{ textAlign:"center",color:"#9ca3af",fontSize:13,marginTop:20 }}>
      Sin cierres registrados aún
    </div>
  );

  return cierres.map(c => (
    <div key={c.id} style={{ background:"#fff",border:`1px solid ${T.border}`,
      borderRadius:10,padding:"13px 15px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
        <div>
          <div style={{ fontSize:13,fontWeight:700,color:"#7c3aed" }}>👤 {c.vendedor}</div>
          <div style={{ fontSize:11,color:"#6b7280" }}>{c.fechaCierre}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:16,fontWeight:700,color:"#111827" }}>{fmt(c.totalVentas)}</div>
          <div style={{ fontSize:11,color:"#6b7280" }}>{c.cantidadVentas} venta(s)</div>
        </div>
      </div>
      <div style={{ fontSize:11,color:"#6b7280",display:"flex",gap:14 }}>
        <span>Apertura: {fmt(c.montoApertura)}</span>
        <span>Efectivo: {fmt(c.totalEfectivo)}</span>
        {c.diferencia!==0&&(
          <span style={{ color:c.diferencia>0?"#059669":"#dc2626",fontWeight:600 }}>
            {c.diferencia>0?"Sobran ":"Faltan "}{fmt(Math.abs(c.diferencia))}
          </span>
        )}
      </div>
    </div>
  ));
}
function VendedorPOS({ usuario, products, sales, cajaMinima, onLogout }) {
  const [cajaAbierta, setCajaAbierta]   = useState(false);
  const [montoApertura, setMontoApertura] = useState(0);
  const [showCierre, setShowCierre]     = useState(false);
  const [showRecepcion, setShowRecepcion] = useState(false);
  const [cart, setCart]           = useState([]);
  const [tab, setTab]             = useState("sale");
  const [search, setSearch]       = useState("");
  const [scanMsg, setScanMsg]     = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [showScanner, setShowScanner]   = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBoleta, setShowBoleta]     = useState(false);
  const [lastSale, setLastSale]         = useState(null);
  const [flashMsg, setFlashMsg]         = useState("");
  const [clientName, setClientName]     = useState("");
  const [clientPhone, setClientPhone]   = useState("");
  const [clientEmail, setClientEmail]   = useState("");
  const [discount, setDiscount]         = useState(0);
  const [payMethod, setPayMethod]       = useState("efectivo");
  const [cashReceived, setCashReceived] = useState("");
  const [scanActive, setScanActive]     = useState(false);

  const html5QrRef  = useRef(null);
  const lastCodeRef = useRef("");

  const flash = (msg) => { setFlashMsg(msg); setTimeout(()=>setFlashMsg(""),2200); };

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const ex = prev.find(i=>i.id===product.id);
      return ex ? prev.map(i=>i.id===product.id?{...i,qty:i.qty+1}:i) : [...prev,{...product,qty:1}];
    });
    flash(`✓ ${product.name.substring(0,32)}`);
  },[]);

  const updateQty = (id,d) => setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+d)}:i).filter(i=>i.qty>0));
  const removeFromCart = (id) => setCart(prev=>prev.filter(i=>i.id!==id));

  const cartCount = cart.reduce((s,i)=>s+i.qty,0);
  const subtotal  = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const discountAmt = Math.round(subtotal*discount/100);
  const total     = subtotal - discountAmt;

  const handleCode = useCallback((code) => {
    if (code===lastCodeRef.current) return;
    lastCodeRef.current = code;
    setTimeout(()=>{lastCodeRef.current="";},2500);
    const p = products.find(x=>x.id===code);
    if (p) { addToCart(p); setScanMsg({ok:true,text:p.name}); }
    else    { setScanMsg({ok:false,text:`Sin resultado: ${code}`}); }
  },[products,addToCart]);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader-vendedor");
      html5QrRef.current = scanner;
      await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:220,height:120}},
        (code)=>handleCode(code),()=>{});
      setScanActive(true);
    } catch { flash("❌ No se pudo acceder a la cámara"); }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); html5QrRef.current.clear(); } catch {}
      html5QrRef.current = null;
    }
    setScanActive(false); setScanMsg(null);
  };

  useEffect(() => {
    if (showScanner) setTimeout(()=>startScanner(),300);
    else stopScanner();
    return ()=>{ stopScanner(); };
  },[showScanner]);

  const completeSale = async () => {
    const id = String(Date.now());
    const sale = {
      id, date:now(), dateTs:Date.now(),
      items:cart.map(i=>({...i})),
      subtotal, discountAmt, discount, total, payMethod,
      cashReceived: payMethod==="efectivo"?Number(cashReceived):null,
      clientName, clientPhone, clientEmail,
      vendedor: usuario.nombre,
    };
    await addDoc(collection(db,"sales"), sale);
    setLastSale(sale);
    setCart([]);
    setClientName(""); setClientPhone(""); setClientEmail("");
    setDiscount(0); setPayMethod("efectivo"); setCashReceived("");
    setShowCheckout(false); setShowBoleta(true);
  };

  const sendWA = (sale) => {
    const text = buildWAText(sale);
    const phone = (sale.clientPhone||"").replace(/\D/g,"");
    const url = phone
      ? `https://wa.me/${phone.startsWith("56")?phone:"56"+phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url,"_blank");
  };

  const sendEmail = (sale) => {
    window.open(`mailto:${sale.clientEmail||""}?subject=${encodeURIComponent(`Boleta N° ${sale.id}`)}&body=${encodeURIComponent(buildWAText(sale))}`);
  };

  const misSales = sales.filter(s=>s.vendedor===usuario.nombre);
  const filtered = products.filter(p=>
    p.name.toLowerCase().includes(search.toLowerCase())||p.id.includes(search)
  );

  // Si caja no está abierta, mostrar pantalla de apertura
  if (!cajaAbierta) {
    return (
      <AperturaCaja
        usuario={usuario}
        cajaMinima={cajaMinima}
        onAbrir={(m) => { setMontoApertura(m); setCajaAbierta(true); }}
        onLogout={onLogout}
      />
    );
  }

  // Si está en cierre de caja
  if (showCierre) {
    return (
      <CierreCaja
        usuario={usuario}
        montoApertura={montoApertura}
        sales={misSales}
        onCerrar={() => onLogout()}
        onCancelar={() => setShowCierre(false)}
      />
    );
  }

  // Si está en recepción de pedido
  if (showRecepcion) {
    return (
      <RecepcionPedido
        usuario={usuario}
        products={products}
        onClose={() => setShowRecepcion(false)}
      />
    );
  }

  return (
    <div style={{ minHeight:"100vh",background:T.bg,color:T.text,fontFamily:T.font,
      display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",position:"relative" }}>

      <style>{`*{box-sizing:border-box;margin:0;padding:0} input::placeholder{color:#9ca3af} input:focus{border-color:${T.accent}!important;box-shadow:0 0 0 3px rgba(26,86,219,0.12)} @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}} @keyframes zoomIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>

      {flashMsg && (
        <div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",
          background:T.accent,color:"#fff",padding:"9px 18px",borderRadius:20,
          fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 4px 20px rgba(26,86,219,0.35)",
          whiteSpace:"nowrap",animation:"zoomIn 0.18s ease" }}>
          {flashMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:`1px solid ${T.border}`,padding:"13px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:200,boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div>
          <div style={{ fontSize:11,color:T.muted,fontWeight:500 }}>POINT OF SALE</div>
          <div style={{ fontSize:15,fontWeight:700,color:T.text }}>👤 {usuario.nombre}</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={()=>setShowRecepcion(true)}
            style={{ background:"#059669",border:"none",borderRadius:8,
              color:"#fff",padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:T.font,fontWeight:600 }}>
            📦 Pedido
          </button>
          <button onClick={()=>setShowCierre(true)}
            style={{ background:"#7c3aed",border:"none",borderRadius:8,
              color:"#fff",padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:T.font,fontWeight:600 }}>
            Cerrar caja
          </button>
          <button onClick={onLogout}
            style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:8,
              color:T.muted,padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:T.font }}>
            Salir
          </button>
          <div onClick={()=>cart.length&&setShowCheckout(true)}
            style={{ position:"relative",cursor:cart.length?"pointer":"default",
              color:cart.length?T.accent:T.muted }}>
            <CartIcon />
            {cartCount>0&&(
              <span style={{ position:"absolute",top:-8,right:-8,background:T.accent,color:"#fff",
                fontSize:10,fontWeight:700,borderRadius:"50%",width:18,height:18,
                display:"flex",alignItems:"center",justifyContent:"center" }}>
                {cartCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",background:"#fff",borderBottom:`1px solid ${T.border}` }}>
        {[["sale","Venta"],["history","Mi historial"],["catalog","Catálogo"]].map(([v,label])=>(
          <button key={v} onClick={()=>{setTab(v);setSearch("");}} style={{
            flex:1,padding:"12px 0",background:"none",border:"none",
            borderBottom:tab===v?`2px solid ${T.accent}`:"2px solid transparent",
            color:tab===v?T.accent:T.muted,fontSize:12,fontWeight:tab===v?700:500,
            cursor:"pointer",fontFamily:T.font }}>{label}</button>
        ))}
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:16 }}>

        {/* ── VENTA ── */}
        {tab==="sale" && (
          <div>
            <button onClick={()=>setShowScanner(true)}
              style={{ ...primaryBtn,width:"100%",padding:16,borderRadius:12,fontSize:14,fontWeight:600,marginBottom:14 }}>
              <ScanIcon /> Escanear código de barras
            </button>
            <div style={{ marginBottom:14 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                style={inputStyle} placeholder="Buscar y agregar producto..." />
            </div>
            {search && filtered.slice(0,5).map(p=>(
              <div key={p.id} onClick={()=>{addToCart(p);setSearch("");}}
                style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,
                  padding:"12px 14px",display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:8,cursor:"pointer",boxShadow:shadow }}>
                <div>
                  <span style={{ fontSize:10,color:T.accent,fontWeight:600,background:T.accentBg,
                    padding:"2px 8px",borderRadius:20,textTransform:"uppercase" }}>{p.category}</span>
                  <div style={{ fontSize:14,fontWeight:500,color:T.text,marginTop:5 }}>{p.name}</div>
                  <div style={{ fontSize:14,fontWeight:700,color:T.accent,marginTop:2 }}>{fmt(p.price)}</div>
                </div>
                <div style={{ width:36,height:36,borderRadius:10,background:T.accent,color:"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>+</div>
              </div>
            ))}

            {cart.length===0&&!search ? (
              <div style={{ textAlign:"center",color:T.muted,marginTop:52 }}>
                <div style={{ fontSize:42,marginBottom:12 }}>🛒</div>
                <div style={{ fontSize:14,fontWeight:500 }}>Carrito vacío</div>
                <div style={{ fontSize:13,marginTop:4,color:"#9ca3af" }}>Escanea o busca un producto</div>
              </div>
            ) : !search && (
              <>
                <div style={{ fontSize:12,color:T.muted,fontWeight:500,marginBottom:12 }}>
                  Carrito · {cartCount} items
                </div>
                {cart.map(item=>(
                  <div key={item.id} style={{ background:"#fff",border:`1px solid ${T.border}`,
                    borderRadius:10,padding:"12px 14px",marginBottom:8,
                    display:"flex",alignItems:"center",gap:10,boxShadow:shadow }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:500,color:T.text,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.name}</div>
                      <div style={{ fontSize:14,fontWeight:700,color:T.accent,marginTop:3 }}>
                        {fmt(item.price*item.qty)}
                        <span style={{ color:T.muted,fontSize:12,fontWeight:400 }}> · {fmt(item.price)} c/u</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <button onClick={()=>updateQty(item.id,-1)}
                        style={{ width:30,height:30,borderRadius:8,border:`1.5px solid ${T.border}`,
                          background:"#fff",color:T.text,fontSize:16,cursor:"pointer",fontFamily:T.font }}>−</button>
                      <span style={{ fontSize:15,fontWeight:600,minWidth:24,textAlign:"center" }}>{item.qty}</span>
                      <button onClick={()=>updateQty(item.id,+1)}
                        style={{ width:30,height:30,borderRadius:8,border:"none",
                          background:T.accent,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>+</button>
                      <button onClick={()=>removeFromCart(item.id)}
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
                <button onClick={()=>setShowCheckout(true)}
                  style={{ ...greenBtn,width:"100%",padding:16,borderRadius:12,fontSize:15,fontWeight:600 }}>
                  Cobrar →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── MI HISTORIAL ── */}
        {tab==="history" && (
          <div>
            {misSales.length>0&&(
              <div style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,
                padding:"14px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",boxShadow:shadow }}>
                <div>
                  <div style={{ fontSize:12,color:T.muted }}>Mis ventas hoy</div>
                  <div style={{ fontSize:22,fontWeight:700,color:T.text }}>{misSales.length}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12,color:T.muted }}>Mi total</div>
                  <div style={{ fontSize:22,fontWeight:700,color:T.green }}>
                    {fmt(misSales.reduce((s,x)=>s+x.total,0))}
                  </div>
                </div>
              </div>
            )}
            {misSales.length===0?(
              <div style={{ textAlign:"center",color:T.muted,marginTop:52 }}>
                <div style={{ fontSize:42,marginBottom:12 }}>📋</div>
                <div style={{ fontSize:14,fontWeight:500 }}>Sin ventas aún hoy</div>
              </div>
            ):misSales.map(sale=>(
              <div key={sale.fireId||sale.id} style={{ background:"#fff",border:`1px solid ${T.border}`,
                borderRadius:10,padding:"13px 15px",marginBottom:10,boxShadow:shadow }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:12,color:T.muted }}>N° {sale.id}</div>
                    <div style={{ fontSize:12,color:T.muted }}>{sale.date}</div>
                    {sale.clientName&&<div style={{ fontSize:13,color:T.sub,fontWeight:500,marginTop:3 }}>👤 {sale.clientName}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18,fontWeight:700,color:T.text }}>{fmt(sale.total)}</div>
                    <div style={{ fontSize:11,color:T.muted }}>{sale.payMethod}</div>
                  </div>
                </div>
                <div style={{ fontSize:11,color:T.muted,marginBottom:10 }}>
                  {sale.items?.map(i=>`${i.name.substring(0,20)} x${i.qty}`).join(" · ")}
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  {sale.clientPhone&&(
                    <button onClick={()=>sendWA(sale)}
                      style={{ flex:1,padding:"9px 0",borderRadius:9,border:"none",
                        background:"#dcfce7",color:"#15803d",cursor:"pointer",fontFamily:T.font,
                        fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                      <WAIcon /> WA
                    </button>
                  )}
                  {sale.clientEmail&&(
                    <button onClick={()=>sendEmail(sale)}
                      style={{ flex:1,padding:"9px 0",borderRadius:9,border:"none",
                        background:"#eff6ff",color:"#1d4ed8",cursor:"pointer",fontFamily:T.font,
                        fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                      <MailIcon /> Email
                    </button>
                  )}
                  <button onClick={()=>{setLastSale(sale);setShowBoleta(true);}}
                    style={{ flex:1,padding:"9px 0",borderRadius:9,border:`1.5px solid ${T.border}`,
                      background:"#fff",color:T.sub,cursor:"pointer",fontFamily:T.font,fontSize:12,fontWeight:500 }}>
                    Ver boleta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CATÁLOGO ── */}
        {tab==="catalog" && (
          <div>
            <div style={{ marginBottom:14 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                style={inputStyle} placeholder="Buscar en catálogo..." />
            </div>
            {filtered.map(p=>(
              <div key={p.id} style={{ background:"#fff",border:`1px solid ${T.border}`,
                borderRadius:10,padding:"12px 14px",marginBottom:8,
                display:"flex",alignItems:"center",gap:12,boxShadow:shadow }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <span style={{ fontSize:10,color:T.accent,fontWeight:600,background:T.accentBg,
                    padding:"2px 8px",borderRadius:20,textTransform:"uppercase" }}>{p.category}</span>
                  <div style={{ fontSize:14,fontWeight:500,color:T.text,marginTop:5 }}>{p.name}</div>
                  <div style={{ display:"flex",gap:14,marginTop:5 }}>
                    <span style={{ fontSize:15,fontWeight:700,color:T.text }}>{fmt(p.price)}</span>
                    <span style={{ fontSize:12,color:p.stock<=(p.stockMin||5)?T.yellow:T.muted,fontWeight:500 }}>
                      {p.stock<=(p.stockMin||5)?"⚠ ":""}{p.stock} en stock
                    </span>
                  </div>
                </div>
                <button onClick={()=>addToCart(p)}
                  style={{ width:36,height:36,borderRadius:10,border:"none",background:T.accent,
                    color:"#fff",fontSize:22,cursor:"pointer",fontWeight:600,display:"flex",
                    alignItems:"center",justifyContent:"center" }}>+</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL SCANNER ── */}
      {showScanner && (
        <div style={{ position:"fixed",inset:0,background:"#000",zIndex:500,
          display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto" }}>
          <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:600,
            padding:"14px 16px",display:"flex",alignItems:"center",
            justifyContent:"space-between",background:"rgba(0,0,0,0.75)" }}>
            <span style={{ fontSize:14,color:"#fff",fontWeight:600 }}>📷 Escáner</span>
            <button onClick={()=>setShowScanner(false)}
              style={{ background:"#ef4444",border:"none",borderRadius:12,
                color:"#fff",padding:"12px 22px",cursor:"pointer",fontSize:15,fontFamily:T.font,fontWeight:700 }}>
              ✕ CERRAR
            </button>
          </div>
          <div style={{ marginTop:58,flex:1,background:"#000",overflow:"hidden" }}>
            <div id="qr-reader-vendedor" style={{ width:"100%" }} />
          </div>
          <div style={{ padding:16,background:"#fff" }}>
            {scanMsg&&(
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
            <div style={{ display:"flex",gap:8 }}>
              <input value={manualCode} onChange={e=>setManualCode(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){handleCode(manualCode);setManualCode("");}}}
                placeholder="Código manual..." style={{ ...inputStyle,flex:1 }} />
              <button onClick={()=>{handleCode(manualCode);setManualCode("");}}
                style={{ ...primaryBtn,width:46,height:46,borderRadius:10,fontSize:18,flexShrink:0 }}>→</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CHECKOUT ── */}
      {showCheckout && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:400,
          display:"flex",alignItems:"flex-end" }} onClick={()=>setShowCheckout(false)}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:"#fff",borderRadius:"20px 20px 0 0",padding:"20px 20px 28px",
              width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto",
              boxShadow:"0 -4px 24px rgba(0,0,0,0.12)",animation:"slideUp 0.28s ease" }}>
            <div style={{ width:40,height:4,background:T.border,borderRadius:2,margin:"0 auto 20px" }} />
            <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:20 }}>Cobrar venta</div>

            {/* Datos cliente */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>
              Datos del cliente <span style={{ fontWeight:400,color:T.muted }}>(opcional)</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:9,marginBottom:20 }}>
              <input value={clientName} onChange={e=>setClientName(e.target.value)} style={inputStyle} placeholder="Nombre" />
              <input value={clientPhone} onChange={e=>setClientPhone(e.target.value)} style={inputStyle} placeholder="WhatsApp (+56912345678)" type="tel" />
              <input value={clientEmail} onChange={e=>setClientEmail(e.target.value)} style={inputStyle} placeholder="Correo electrónico" type="email" />
            </div>

            {/* Items editables */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>
              Productos <span style={{ fontWeight:400,color:T.muted }}>(puedes editar)</span>
            </div>
            <div style={{ background:T.bg,borderRadius:12,padding:"4px 10px",marginBottom:18 }}>
              {cart.map(i=>(
                <div key={i.id} style={{ display:"flex",alignItems:"center",gap:8,
                  padding:"10px 0",borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:500,color:T.text,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{i.name}</div>
                    <div style={{ fontSize:13,fontWeight:700,color:T.accent,marginTop:2 }}>
                      {fmt(i.price*i.qty)}<span style={{ color:T.muted,fontWeight:400,fontSize:11 }}> · {fmt(i.price)} c/u</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:5,flexShrink:0 }}>
                    <button onClick={()=>updateQty(i.id,-1)}
                      style={{ width:30,height:30,borderRadius:8,border:`1.5px solid ${T.border}`,
                        background:"#fff",color:T.text,fontSize:16,cursor:"pointer",fontFamily:T.font,fontWeight:600 }}>−</button>
                    <span style={{ fontSize:14,fontWeight:700,color:T.text,minWidth:24,textAlign:"center" }}>{i.qty}</span>
                    <button onClick={()=>updateQty(i.id,+1)}
                      style={{ width:30,height:30,borderRadius:8,border:"none",
                        background:T.accent,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>+</button>
                    <button onClick={()=>removeFromCart(i.id)}
                      style={{ width:30,height:30,borderRadius:8,border:"none",
                        background:T.redBg,color:T.red,fontSize:14,cursor:"pointer",fontWeight:600 }}>✕</button>
                  </div>
                </div>
              ))}
              {cart.length===0&&(
                <div style={{ padding:"20px 0",textAlign:"center",color:T.muted,fontSize:13 }}>
                  Carrito vacío
                </div>
              )}
            </div>

            {/* Descuento */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>Descuento</div>
            <div style={{ display:"flex",gap:7,marginBottom:20 }}>
              {[0,5,10,15,20].map(d=>(
                <button key={d} onClick={()=>setDiscount(d)} style={{
                  flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                  fontSize:13,fontWeight:600,transition:"all 0.12s",
                  border:discount===d?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                  background:discount===d?T.accentBg:"#fff",
                  color:discount===d?T.accent:T.muted }}>{d}%</button>
              ))}
            </div>

            {/* Total */}
            <div style={{ background:T.bg,borderRadius:12,padding:"14px 16px",marginBottom:20 }}>
              {discount>0&&(
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

            {/* Método pago */}
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>Método de pago</div>
            <div style={{ display:"flex",gap:7,marginBottom:16 }}>
              {["Efectivo","Débito","Crédito","Transferencia"].map(m=>(
                <button key={m} onClick={()=>{setPayMethod(m.toLowerCase());setCashReceived("");}} style={{
                  flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                  fontSize:11,fontWeight:600,transition:"all 0.12s",
                  border:payMethod===m.toLowerCase()?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                  background:payMethod===m.toLowerCase()?T.accentBg:"#fff",
                  color:payMethod===m.toLowerCase()?T.accent:T.muted }}>{m}</button>
              ))}
            </div>

            {/* Vuelto efectivo */}
            {payMethod==="efectivo"&&(
              <div style={{ background:T.bg,borderRadius:12,padding:"14px 16px",marginBottom:20 }}>
                <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:10 }}>Efectivo recibido</div>
                <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                  {[...new Set([Math.ceil(total/1000)*1000,Math.ceil(total/2000)*2000,Math.ceil(total/5000)*5000])].map(v=>(
                    <button key={v} onClick={()=>setCashReceived(v)}
                      style={{ flex:1,padding:"9px 0",borderRadius:9,cursor:"pointer",fontFamily:T.font,
                        fontSize:12,fontWeight:600,
                        border:Number(cashReceived)===v?`2px solid ${T.accent}`:`2px solid ${T.border}`,
                        background:Number(cashReceived)===v?T.accentBg:"#fff",
                        color:Number(cashReceived)===v?T.accent:T.sub }}>{fmt(v)}</button>
                  ))}
                </div>
                <input type="number" value={cashReceived} onChange={e=>setCashReceived(e.target.value)}
                  placeholder="O ingresa monto exacto..." style={inputStyle} />
                {cashReceived&&Number(cashReceived)>=total&&(
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                    background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,
                    padding:"12px 16px",marginTop:10 }}>
                    <span style={{ fontSize:14,fontWeight:600,color:T.green }}>Vuelto</span>
                    <span style={{ fontSize:24,fontWeight:800,color:T.green }}>{fmt(Number(cashReceived)-total)}</span>
                  </div>
                )}
                {cashReceived&&Number(cashReceived)<total&&(
                  <div style={{ background:T.redBg,border:"1px solid #fecaca",borderRadius:10,
                    padding:"10px 14px",marginTop:10,fontSize:13,color:T.red,fontWeight:600,textAlign:"center" }}>
                    Faltan {fmt(total-Number(cashReceived))}
                  </div>
                )}
              </div>
            )}

            <button onClick={completeSale}
              disabled={payMethod==="efectivo"&&cashReceived&&Number(cashReceived)<total}
              style={{ ...greenBtn,width:"100%",padding:16,borderRadius:12,fontSize:15,fontWeight:700,
                opacity:payMethod==="efectivo"&&cashReceived&&Number(cashReceived)<total?0.4:1 }}>
              ✓ Confirmar venta · {fmt(total)}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL BOLETA ── */}
      {showBoleta&&lastSale&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:600,
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={()=>setShowBoleta(false)}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:"#fff",borderRadius:18,padding:22,width:"100%",maxWidth:420,
              animation:"zoomIn 0.22s ease",maxHeight:"90vh",overflowY:"auto",
              boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
            <div style={{ textAlign:"center",marginBottom:20 }}>
              <div style={{ width:60,height:60,borderRadius:"50%",background:T.greenBg,
                border:`2px solid ${T.green}`,display:"flex",alignItems:"center",
                justifyContent:"center",margin:"0 auto 12px",fontSize:26 }}>✓</div>
              <div style={{ fontSize:16,fontWeight:700,color:T.green }}>¡Venta registrada!</div>
              <div style={{ fontSize:13,color:T.muted,marginTop:4 }}>N° {lastSale.id}</div>
            </div>
            <div style={{ background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,
              padding:14,marginBottom:18,fontSize:12,lineHeight:1.9,
              whiteSpace:"pre-wrap",color:T.sub,fontFamily:"'Courier New',monospace",
              maxHeight:260,overflowY:"auto" }}>
              {buildWAText(lastSale)}
            </div>
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,marginBottom:12 }}>Enviar al cliente</div>
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:14 }}>
              <button onClick={()=>sendWA(lastSale)}
                style={{ width:"100%",padding:14,borderRadius:11,border:"none",background:"#25D366",
                  color:"#fff",cursor:"pointer",fontFamily:T.font,fontSize:14,fontWeight:600,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
                <WAIcon /> Enviar por WhatsApp
              </button>
              <button onClick={()=>sendEmail(lastSale)}
                style={{ width:"100%",padding:14,borderRadius:11,border:"none",background:T.accent,
                  color:"#fff",cursor:"pointer",fontFamily:T.font,fontSize:14,fontWeight:600,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
                <MailIcon /> Enviar por correo
              </button>
            </div>
            <button onClick={()=>setShowBoleta(false)}
              style={{ ...ghostBtn,width:"100%",padding:13,borderRadius:11,fontSize:14 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [usuario, setUsuario]     = useState(null);
  const [products, setProducts]   = useState(INITIAL_PRODUCTS);
  const [sales, setSales]         = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [cajaMinima, setCajaMinima] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"products"), async (snap) => {
      if (snap.empty) {
        for (const p of INITIAL_PRODUCTS) { await setDoc(doc(db,"products",p.id),p); }
      } else {
        setProducts(snap.docs.map(d=>({...d.data(),id:d.id})));
      }
    });
    return ()=>unsub();
  },[]);

  useEffect(() => {
    const q = query(collection(db,"sales"),orderBy("dateTs","desc"));
    const unsub = onSnapshot(q,(snap)=>{
      setSales(snap.docs.map(d=>({...d.data(),fireId:d.id})));
    });
    return ()=>unsub();
  },[]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"vendedores"),(snap)=>{
      setVendedores(snap.docs.map(d=>({...d.data(),id:d.id})));
    });
    return ()=>unsub();
  },[]);

  // Cargar config (caja mínima)
  useEffect(() => {
    const unsub = onSnapshot(doc(db,"config","general"),(snap)=>{
      if (snap.exists()) setCajaMinima(snap.data().cajaMinima || 0);
    });
    return ()=>unsub();
  },[]);

  const saveProduct = async (p) => { await setDoc(doc(db,"products",p.id),p); };
  const deleteProduct = async (id) => { await deleteDoc(doc(db,"products",id)); };
  const saveCajaMinima = async (m) => { await setDoc(doc(db,"config","general"),{cajaMinima:m}); };

  if (!usuario) {
    return (
      <LoginScreen
        vendedores={vendedores}
        onLogin={(u) => setUsuario(u)}
        onAdmin={() => setUsuario({ rol:"admin", nombre:"Admin" })}
      />
    );
  }

  if (usuario.rol === "admin") {
    return (
      <AdminPanel
        products={products}
        sales={sales}
        vendedores={vendedores}
        cajaMinima={cajaMinima}
        onLogout={() => setUsuario(null)}
        onSaveProduct={saveProduct}
        onDeleteProduct={deleteProduct}
        onSaveCajaMinima={saveCajaMinima}
      />
    );
  }

  return (
    <VendedorPOS
      usuario={usuario}
      products={products}
      sales={sales}
      cajaMinima={cajaMinima}
      onLogout={() => setUsuario(null)}
    />
  );
}
