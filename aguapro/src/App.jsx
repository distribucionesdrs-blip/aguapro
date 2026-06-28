import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAUSobqTwQpUVFvBRdc1mMqog-T_Q9dYUI",
  authDomain: "agua-2026.firebaseapp.com",
  databaseURL: "https://agua-2026-default-rtdb.firebaseio.com",
  projectId: "agua-2026",
  storageBucket: "agua-2026.firebasestorage.app",
  messagingSenderId: "1086687268882",
  appId: "1:1086687268882:web:170d78461c7d41f0c608cb",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

function useFirebase(path, initial) {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const r = ref(db, path);
    const unsub = onValue(r, snap => {
      const val = snap.val();
      if (val !== null) {
        const arr = Object.entries(val).map(([k, v]) => ({ ...v, id: String(k) }));
        setData(arr);
      } else {
        const withStringIds = initial.map(item => ({ ...item, id: String(item.id) }));
        set(r, Object.fromEntries(withStringIds.map(i => [i.id, i])));
        setData(withStringIds);
      }
      setReady(true);
    });
    return () => unsub();
  }, [path]);

  const update = (newData) => {
    const obj = Object.fromEntries(newData.map(item => [String(item.id), { ...item, id: String(item.id) }]));
    const arr = newData.map(item => ({ ...item, id: String(item.id) }));
    setData(arr);
    set(ref(db, path), obj);
  };

  return [data, update, ready];
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0F1D35",
  surface: "#162542",
  surfaceHigh: "#1E3157",
  accent: "#00C9A7",
  amber: "#F4A83A",
  danger: "#E05A5A",
  text: "#F8F7F4",
  muted: "#8A9BB0",
};

const BRAND_COLORS = {
  "Fresh":    "#00C9A7",
  "Vital":    "#4EAAFF",
  "Spring":   "#A78BFA",
  "San Luis": "#F4A83A",
};

const getBrandColor = (name) => BRAND_COLORS[name] || "#8A9BB0";

const PAGO_COLORS = {
  "Yape":          "#7B2FF7",
  "Plin":          "#00C9A7",
  "Transferencia": "#4EAAFF",
  "Crédito":       "#F4A83A",
  "Efectivo":      "#8A9BB0",
};

const PAGOS = ["Yape", "Plin", "Transferencia", "Crédito", "Efectivo"];
const PAGO_MAP = { Y: "Yape", P: "Plin", T: "Transferencia", C: "Crédito", E: "Efectivo" };
const BRANDS = ["Fresh", "Vital", "Spring", "San Luis", "Otra"];

// ─── Date helpers ─────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const toDate = (s) => new Date(s + "T00:00:00");
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (s) => { if (!s) return "—"; const [y, m, dd] = s.split("-"); return `${dd}/${m}/${y}`; };
const daysFromToday = (s) => { if (!s) return null; return diffDays(today(), s); };

// ─── Forecast ─────────────────────────────────────────────────────────────────
function calcForecast(orders) {
  if (!orders || orders.length < 2) return null;
  const sorted = [...orders].sort((a, b) => a.date.localeCompare(b.date));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(diffDays(sorted[i-1].date, sorted[i].date));
  const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const last = sorted[sorted.length - 1].date;
  return { avg, next: addDays(last, avg), last };
}

// ─── Urgency badge ────────────────────────────────────────────────────────────
function UrgencyBadge({ nextDate, manualDate }) {
  const target = manualDate || nextDate;
  if (!target) return null;
  const d = daysFromToday(target);
  let color, text;
  if (d < 0)       { color = COLORS.danger; text = `Hace ${Math.abs(d)}d`; }
  else if (d === 0) { color = COLORS.amber;  text = "Hoy"; }
  else if (d <= 2)  { color = COLORS.amber;  text = `En ${d}d`; }
  else              { color = COLORS.accent;  text = `En ${d}d`; }
  return (
    <span style={{
      background: color + "22", color,
      border: `1px solid ${color}55`,
      borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>{text}</span>
  );
}

// ─── Telegram parser ──────────────────────────────────────────────────────────
function parseTelegramClients(jsonText) {
  let data;
  try { data = JSON.parse(jsonText); } catch { return { clientes: [], errors: ["JSON inválido."] }; }
  const messages = data.messages || data.chats?.list?.flatMap(c => c.messages || []) || [];
  const clientes = [], errors = [], vistos = new Set();
  messages.forEach((msg) => {
    const raw = typeof msg.text === "string" ? msg.text
      : Array.isArray(msg.text) ? msg.text.map(t => typeof t === "string" ? t : (t.text || "")).join("") : "";
    if (!raw.trim()) return;
    const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const lineaPedido = lines.find(l => /^\d+\s+\w/i.test(l));
    if (!lineaPedido) return;
    const idx = lines.indexOf(lineaPedido);
    const nombre = lines[idx + 1] || "";
    if (!nombre || nombre.length < 2) return;
    const INICIALES_PAGO = new Set(["Y", "P", "T", "C", "E"]);
    const dirLines = [];
    for (let i = idx + 2; i < Math.min(idx + 5, lines.length); i++) {
      const l = lines[i];
      if (INICIALES_PAGO.has(l.toUpperCase()) || l.length === 1) break;
      dirLines.push(l);
    }
    const key = nombre.toUpperCase().trim();
    if (vistos.has(key)) return;
    vistos.add(key);
    clientes.push({ nombre: nombre.trim(), direccion: dirLines.join(", ").trim() });
  });
  if (clientes.length === 0) errors.push("No se encontraron mensajes con el formato esperado.");
  return { clientes, errors };
}

// ─── Initial data ─────────────────────────────────────────────────────────────
const initialProducts = [
  { id: 1, name: "Fresh",    proveedor: "Distribuidora Fresh S.A.",  price: 8.50, stock: 40, tipo: "bidon" },
  { id: 2, name: "Vital",    proveedor: "Agua Vital Ltda.",           price: 9.00, stock: 5,  tipo: "bidon" },
  { id: 3, name: "Spring",   proveedor: "Spring Waters Corp.",        price: 9.50, stock: 0,  tipo: "bidon" },
  { id: 4, name: "San Luis", proveedor: "San Luis Distribuciones",    price: 8.00, stock: 22, tipo: "bidon" },
];
const initialClients = [
  { id: 1, name: "Restaurante El Buen Sabor", phone: "555-1001", direccion: "Av. Central 123", notas: "", brand: "", nextManual: "", isDebtor: false, debtAmount: 0 },
  { id: 2, name: "Oficinas García & Asociados", phone: "555-2002", direccion: "Calle 5 Norte 88", notas: "", brand: "", nextManual: "", isDebtor: false, debtAmount: 0 },
  { id: 3, name: "Juan Pérez", phone: "555-3003", direccion: "Pasaje Los Olivos 4", notas: "", brand: "", nextManual: "", isDebtor: false, debtAmount: 0 },
];
const initialSales = [
  { id: 1, client: "Restaurante El Buen Sabor", marca: "Fresh",    qty: 10, total: 85,  unitPrice: 8.50, pago: "Yape",          date: "2026-06-10" },
  { id: 2, client: "Oficinas García & Asociados", marca: "Vital",  qty: 6,  total: 54,  unitPrice: 9.00, pago: "Transferencia", date: "2026-06-11" },
  { id: 3, client: "Juan Pérez",                  marca: "San Luis",qty: 3,  total: 24,  unitPrice: 8.00, pago: "Crédito",       date: "2026-06-12" },
];

const fmt = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
const stockColor = (s) => s === 0 ? COLORS.danger : s <= 5 ? COLORS.amber : COLORS.accent;

// ─── Base UI components ───────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: COLORS.surface, borderRadius: 14, padding: "16px 18px",
      borderBottom: `3px solid ${accent || COLORS.accent}`,
      flex: "1 1 140px", minWidth: 130,
    }}>
      <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: accent || COLORS.accent, fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{
      background: (color || COLORS.accent) + "22", color: color || COLORS.accent,
      borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600,
    }}>{children}</span>
  );
}

function MarcaDot({ marca }) {
  const c = getBrandColor(marca);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c + "22", color: c,
      borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />
      {marca}
    </span>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: "20px 0 12px" }}>{children}</h2>;
}

function Input({ placeholder, value, onChange, type = "text" }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      style={{
        background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
        color: COLORS.text, padding: "10px 14px", fontSize: 14, width: "100%",
        outline: "none", boxSizing: "border-box",
      }} />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange}
      style={{
        background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
        color: COLORS.text, padding: "10px 14px", fontSize: 14, width: "100%", outline: "none",
      }}>
      {children}
    </select>
  );
}

function Btn({ children, onClick, color, small, danger }) {
  return (
    <button onClick={onClick} style={{
      background: danger ? COLORS.danger : color || COLORS.accent,
      color: (color === COLORS.surfaceHigh || danger) ? COLORS.text : "#0F1D35",
      border: "none", borderRadius: 10,
      padding: small ? "7px 14px" : "11px 20px",
      fontWeight: 700, fontSize: small ? 12 : 14, cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function FormBox({ children }) {
  return (
    <div style={{
      background: COLORS.surface, borderRadius: 14, padding: 16,
      marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
    }}>{children}</div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
      zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: COLORS.surface, borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 430, maxHeight: "90vh",
        overflowY: "auto", padding: "20px 16px 32px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>{title}</span>
          <button onClick={onClose} style={{
            background: COLORS.surfaceHigh, border: "none", color: COLORS.muted,
            fontSize: 18, cursor: "pointer", borderRadius: 8, width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{children}</div>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ sales, products }) {
  const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
  const lowStock = products.filter(p => p.stock <= 5).length;
  const todaySales = sales.filter(s => s.date === today()).reduce((a, s) => a + s.qty, 0);

  const porMarca = products.map(p => ({
    name: p.name, color: getBrandColor(p.name),
    qty: sales.filter(s => s.marca === p.name).reduce((a, s) => a + s.qty, 0),
  }));
  const maxQty = Math.max(...porMarca.map(m => m.qty), 1);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const revenueByDay = last7.map(d => sales.filter(s => s.date === d).reduce((a, s) => a + s.total, 0));
  const maxRev = Math.max(...revenueByDay, 1);

  return (
    <div>
      <SectionTitle>Resumen General</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <KpiCard label="Ingresos Totales" value={fmt(totalRevenue)} sub="todas las ventas" />
        <KpiCard label="Unidades Hoy" value={todaySales} sub="vendidas hoy" accent={COLORS.amber} />
        <KpiCard label="Stock Bajo" value={lowStock} sub="productos" accent={lowStock > 0 ? COLORS.danger : COLORS.accent} />
      </div>

      <SectionTitle>Ventas por producto</SectionTitle>
      <div style={{ background: COLORS.surface, borderRadius: 14, padding: "16px 12px" }}>
        {porMarca.map(m => (
          <div key={m.name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: m.color, fontSize: 12, fontWeight: 700 }}>{m.name}</span>
              <span style={{ color: COLORS.muted, fontSize: 12 }}>{m.qty} uds.</span>
            </div>
            <div style={{ background: COLORS.surfaceHigh, borderRadius: 6, height: 8 }}>
              <div style={{ background: m.color, borderRadius: 6, height: 8, width: `${(m.qty / maxQty) * 100}%`, transition: "width 0.5s" }} />
            </div>
          </div>
        ))}
      </div>

      <SectionTitle>Ingresos por forma de pago</SectionTitle>
      <div style={{ background: COLORS.surface, borderRadius: 14, padding: "16px 12px" }}>
        {PAGOS.map(p => {
          const total = sales.filter(s => s.pago === p).reduce((a, s) => a + s.total, 0);
          return (
            <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{
                background: (PAGO_COLORS[p] || COLORS.muted) + "22",
                color: PAGO_COLORS[p] || COLORS.muted,
                borderRadius: 99, padding: "3px 12px", fontSize: 12, fontWeight: 700,
              }}>{p}</span>
              <span style={{ color: total > 0 ? COLORS.text : COLORS.muted, fontWeight: 600 }}>{fmt(total)}</span>
            </div>
          );
        })}
      </div>

      <SectionTitle>Ingresos — Últimos 7 días</SectionTitle>
      <div style={{ background: COLORS.surface, borderRadius: 14, padding: "16px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
          {revenueByDay.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                background: v > 0 ? COLORS.accent : COLORS.surfaceHigh,
                borderRadius: "4px 4px 0 0", width: "100%",
                height: Math.max(4, (v / maxRev) * 64), transition: "height 0.4s",
              }} />
              <span style={{ color: COLORS.muted, fontSize: 9 }}>{last7[i].slice(8)}/{last7[i].slice(5,7)}</span>
            </div>
          ))}
        </div>
      </div>

      <SectionTitle>Últimas Ventas</SectionTitle>
      {[...sales].reverse().slice(0, 4).map(s => (
        <div key={s.id} style={{
          background: COLORS.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderLeft: `3px solid ${getBrandColor(s.marca)}`,
        }}>
          <div>
            <MarcaDot marca={s.marca} />
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{s.client} · ×{s.qty} · {s.date}</div>
          </div>
          <span style={{ color: COLORS.accent, fontWeight: 700 }}>{fmt(s.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Inventario ───────────────────────────────────────────────────────────────
function Inventory({ products, setProducts, sales, envases }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", proveedor: "", price: "", stock: "", tipo: "otro" });

  const startEdit = (p) => { setEditId(p.id); setEditForm({ name: p.name, proveedor: p.proveedor, price: p.price, stock: p.stock }); };
  const saveEdit = (id) => {
    setProducts(products.map(p => p.id === id ? {
      ...p, name: editForm.name || p.name, proveedor: editForm.proveedor || p.proveedor,
      price: editForm.price !== "" ? +editForm.price : p.price,
      stock: editForm.stock !== "" ? +editForm.stock : p.stock,
    } : p));
    setEditId(null);
  };
  const saveNew = () => {
    if (!newForm.name || !newForm.price) return;
    setProducts([...products, { id: String(Date.now()), name: newForm.name, proveedor: newForm.proveedor, price: +newForm.price, stock: +newForm.stock || 0, tipo: newForm.tipo }]);
    setNewForm({ name: "", proveedor: "", price: "", stock: "", tipo: "otro" });
    setAdding(false);
  };

  const totalBidones = products.filter(p => ["Fresh","Vital","Spring"].includes(p.name)).reduce((a, p) => a + p.stock, 0);
  const totalVendidos = sales.filter(s => ["Fresh","Vital","Spring"].includes(s.marca)).reduce((a, s) => a + s.qty, 0);
  const totalPrestados = (envases || []).reduce((a, e) => a + (e.qty || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Inventario</SectionTitle>
        <Btn small onClick={() => setAdding(!adding)}>{adding ? "Cancelar" : "+ Producto"}</Btn>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 120px", background: COLORS.surface, borderRadius: 14, padding: "14px 16px", borderBottom: `3px solid ${COLORS.accent}` }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>En stock</div>
          <div style={{ color: COLORS.accent, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalBidones}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>Fresh + Vital + Spring</div>
        </div>
        <div style={{ flex: "1 1 120px", background: COLORS.surface, borderRadius: 14, padding: "14px 16px", borderBottom: `3px solid ${COLORS.amber}` }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Vacíos</div>
          <div style={{ color: COLORS.amber, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalVendidos}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>despachados</div>
        </div>
        <div style={{ flex: "1 1 120px", background: COLORS.surface, borderRadius: 14, padding: "14px 16px", borderBottom: `3px solid ${COLORS.danger}` }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Prestados</div>
          <div style={{ color: COLORS.danger, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalPrestados}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>por recoger</div>
        </div>
      </div>
      {adding && (
        <FormBox>
          <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700 }}>Nuevo producto</div>
          <Input placeholder="Nombre" value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} />
          <Input placeholder="Proveedor" value={newForm.proveedor} onChange={e => setNewForm({ ...newForm, proveedor: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Input placeholder="Precio S/" type="number" value={newForm.price} onChange={e => setNewForm({ ...newForm, price: e.target.value })} />
            <Input placeholder="Stock inicial" type="number" value={newForm.stock} onChange={e => setNewForm({ ...newForm, stock: e.target.value })} />
          </div>
          <Btn onClick={saveNew}>Guardar Producto</Btn>
        </FormBox>
      )}
      {products.map(p => (
        <div key={p.id} style={{ background: COLORS.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${getBrandColor(p.name)}` }}>
          {editId === p.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Input placeholder="Nombre" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              <Input placeholder="Proveedor" value={editForm.proveedor} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} />
              <div style={{ display: "flex", gap: 8 }}>
                <Input placeholder="Precio" type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
                <Input placeholder="Stock" type="number" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small onClick={() => saveEdit(p.id)}>Guardar</Btn>
                <Btn small color={COLORS.surfaceHigh} onClick={() => setEditId(null)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{p.proveedor}</div>
                  <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600, marginTop: 2 }}>{fmt(p.price)} / unidad</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: stockColor(p.stock), fontWeight: 800, fontSize: 22 }}>{p.stock}</div>
                  <div style={{ color: COLORS.muted, fontSize: 10 }}>en stock</div>
                  {p.stock === 0 && <Badge color={COLORS.danger}>Sin stock</Badge>}
                  {p.stock > 0 && p.stock <= 5 && <Badge color={COLORS.amber}>Stock bajo</Badge>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn small color={COLORS.surfaceHigh} onClick={() => startEdit(p)}>✏️ Editar</Btn>
                <Btn small danger onClick={() => setProducts(products.filter(x => x.id !== p.id))}>Eliminar</Btn>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Ventas ───────────────────────────────────────────────────────────────────
function Sales({ sales, setSales, products, setProducts, clients }) {
  const [form, setForm] = useState({ client: "", marca: "", qty: 1, customPrice: "", pago: "", tipoVenta: "A" });
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");
  const PRECIO_ENVASE = 25;

  const adjustStock = (marca, delta) => setProducts(prev => prev.map(p => p.name === marca ? { ...p, stock: Math.max(0, p.stock + delta) } : p));

  const save = () => {
    const prod = products.find(p => p.name === form.marca);
    if (!form.client || !prod || form.qty < 1 || !form.pago) return;
    const precioAgua = form.customPrice !== "" ? +form.customPrice : prod.price;
    const precioEnvase = form.tipoVenta === "C" ? PRECIO_ENVASE : 0;
    const unitPrice = precioAgua + precioEnvase;
    const total = unitPrice * +form.qty;
    setSales([...sales, { id: String(Date.now()), client: form.client, marca: form.marca, qty: +form.qty, unitPrice, precioAgua, precioEnvase, total, pago: form.pago, tipoVenta: form.tipoVenta, date: today() }]);
    adjustStock(form.marca, -form.qty);
    setForm({ client: "", marca: "", qty: 1, customPrice: "", pago: "", tipoVenta: "A" });
    setClientSearch("");
    setAdding(false);
  };

  const startEdit = (s) => { setEditId(s.id); setEditForm({ client: s.client, marca: s.marca, qty: s.qty, customPrice: s.unitPrice ?? "", pago: s.pago || "", date: s.date || today() }); };
  const saveEdit = (id) => {
    const orig = sales.find(s => s.id === id);
    const prod = products.find(p => p.name === editForm.marca);
    if (!prod) return;
    const unitPrice = editForm.customPrice !== "" ? +editForm.customPrice : prod.price;
    const total = unitPrice * +editForm.qty;
    adjustStock(orig.marca, +orig.qty);
    adjustStock(editForm.marca, -editForm.qty);
    setSales(sales.map(s => s.id === id ? { ...s, client: editForm.client, marca: editForm.marca, qty: +editForm.qty, unitPrice, total, pago: editForm.pago, date: editForm.date || s.date } : s));
    setEditId(null);
  };
  const deleteSale = (id) => { const sale = sales.find(s => s.id === id); if (sale) adjustStock(sale.marca, +sale.qty); setSales(sales.filter(s => s.id !== id)); };

  const clientesFiltrados = clientSearch.trim() ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.direccion || "").toLowerCase().includes(clientSearch.toLowerCase())) : clients;
  const selectedProd = products.find(p => p.name === form.marca);
  const newUnitPrice = form.customPrice !== "" ? +form.customPrice : selectedProd?.price || 0;
  const editProd = products.find(p => p.name === editForm.marca);
  const editUnitPrice = editForm.customPrice !== "" ? +editForm.customPrice : editProd?.price || 0;
  const ventasFiltradas = salesSearch.trim()
    ? [...sales].reverse().filter(s => s.client.toLowerCase().includes(salesSearch.toLowerCase()) || s.marca.toLowerCase().includes(salesSearch.toLowerCase()) || (s.pago || "").toLowerCase().includes(salesSearch.toLowerCase()) || (s.date || "").includes(salesSearch))
    : [...sales].reverse();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Ventas</SectionTitle>
        <Btn small onClick={() => { setAdding(!adding); setClientSearch(""); setShowClientList(false); }}>{adding ? "Cancelar" : "+ Venta"}</Btn>
      </div>
      {adding && (
        <FormBox>
          <div style={{ position: "relative" }}>
            <input placeholder="🔍 Buscar cliente…" value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
              onFocus={() => setShowClientList(true)}
              style={{ background: COLORS.surfaceHigh, border: `2px solid ${form.client ? COLORS.accent : "transparent"}`, borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" }} />
            {form.client && (
              <div style={{ color: COLORS.accent, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                ✓ {form.client}
                <button onClick={() => { setForm({ ...form, client: "" }); setClientSearch(""); }} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", marginLeft: 8, fontSize: 12 }}>✕ Cambiar</button>
              </div>
            )}
            {showClientList && clientSearch.trim().length > 0 && !form.client && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: COLORS.surface, borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                {clientesFiltrados.length === 0 ? <div style={{ color: COLORS.muted, padding: "12px 14px", fontSize: 13 }}>Sin resultados</div>
                  : clientesFiltrados.map(c => (
                    <div key={c.id} onClick={() => { setForm({ ...form, client: c.name }); setClientSearch(c.name); setShowClientList(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.surfaceHigh}` }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHigh}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      {c.direccion && <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>}
                    </div>
                  ))}
              </div>
            )}
          </div>
          <Select value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value, customPrice: "" })}>
            <option value="">Seleccionar producto…</option>
            {products.map(p => <option key={p.id} value={p.name}>{p.name} — {fmt(p.price)} (stock: {p.stock})</option>)}
          </Select>
          <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600 }}>TIPO DE VENTA</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "A", label: "A — Entrega su envase", color: COLORS.accent }, { id: "B", label: "B — Se le presta", color: COLORS.amber }, { id: "C", label: "C — Compra envase", color: COLORS.danger }].map(t => (
              <button key={t.id} onClick={() => setForm({ ...form, tipoVenta: t.id })} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", background: form.tipoVenta === t.id ? t.color : COLORS.surfaceHigh, color: form.tipoVenta === t.id ? "#0F1D35" : COLORS.muted, fontWeight: 700, fontSize: 11, cursor: "pointer", lineHeight: 1.4 }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input placeholder="Cantidad" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
            <Input placeholder={selectedProd ? `Precio (${fmt(selectedProd.price)})` : "Precio unit."} type="number" value={form.customPrice} onChange={e => setForm({ ...form, customPrice: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PAGOS.map(p => (
              <button key={p} onClick={() => setForm({ ...form, pago: p })} style={{ flex: 1, minWidth: 70, padding: "8px 4px", borderRadius: 10, border: "none", background: form.pago === p ? PAGO_COLORS[p] : COLORS.surfaceHigh, color: form.pago === p ? "#fff" : COLORS.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{p}</button>
            ))}
          </div>
          {form.tipoVenta !== "C" && selectedProd && form.qty > 0 && (
            <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>Total: {fmt(newUnitPrice * form.qty)}</div>
          )}
          <Btn onClick={save}>Registrar Venta</Btn>
        </FormBox>
      )}
      {!adding && (
        <input placeholder="🔍 Buscar por cliente, marca, pago o fecha…" value={salesSearch} onChange={e => setSalesSearch(e.target.value)}
          style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
      )}
      {ventasFiltradas.map(s => (
        <div key={s.id} style={{ background: COLORS.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 8, borderLeft: `3px solid ${getBrandColor(s.marca)}` }}>
          {editId === s.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Select value={editForm.client} onChange={e => setEditForm({ ...editForm, client: e.target.value })}>
                {clients.map(c => <option key={c.id}>{c.name}</option>)}
              </Select>
              <Select value={editForm.marca} onChange={e => setEditForm({ ...editForm, marca: e.target.value, customPrice: "" })}>
                {products.map(p => <option key={p.id} value={p.name}>{p.name} — {fmt(p.price)}</option>)}
              </Select>
              <div style={{ display: "flex", gap: 8 }}>
                <Input placeholder="Cantidad" type="number" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} />
                <Input placeholder="Precio unit." type="number" value={editForm.customPrice} onChange={e => setEditForm({ ...editForm, customPrice: e.target.value })} />
              </div>
              <input type="date" value={editForm.date || ""} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PAGOS.map(p => (
                  <button key={p} onClick={() => setEditForm({ ...editForm, pago: p })} style={{ flex: 1, minWidth: 70, padding: "8px 4px", borderRadius: 10, border: "none", background: editForm.pago === p ? PAGO_COLORS[p] : COLORS.surfaceHigh, color: editForm.pago === p ? "#fff" : COLORS.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{p}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small onClick={() => saveEdit(s.id)}>Guardar</Btn>
                <Btn small color={COLORS.surfaceHigh} onClick={() => setEditId(null)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <MarcaDot marca={s.marca} />
                  {s.tipoVenta && (
                    <span style={{ display: "inline-block", marginLeft: 6, background: s.tipoVenta === "A" ? COLORS.accent + "22" : s.tipoVenta === "B" ? COLORS.amber + "22" : COLORS.danger + "22", color: s.tipoVenta === "A" ? COLORS.accent : s.tipoVenta === "B" ? COLORS.amber : COLORS.danger, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>Tipo {s.tipoVenta}</span>
                  )}
                  <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{s.client}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>×{s.qty} uds. · {s.date}</div>
                  {s.pago && <span style={{ display: "inline-block", marginTop: 5, background: (PAGO_COLORS[s.pago] || COLORS.muted) + "22", color: PAGO_COLORS[s.pago] || COLORS.muted, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{s.pago}</span>}
                </div>
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>{fmt(s.total)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn small color={COLORS.surfaceHigh} onClick={() => startEdit(s)}>✏️ Editar</Btn>
                <Btn small danger onClick={() => deleteSale(s.id)}>Eliminar</Btn>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Client Detail Modal ──────────────────────────────────────────────────────
function ClientDetailModal({ client, sales, envases, onClose, onEdit, onDelete, onSaveManualDate, onToggleDebtor }) {
  const clientSales = sales.filter(s => s.client === client.name).sort((a, b) => b.date.localeCompare(a.date));
  const clientEnvases = envases.filter(e => e.clientId === client.id).reduce((a, e) => a + (e.qty || 0), 0);
  const fc = calcForecast(clientSales.map(s => ({ date: s.date, qty: s.qty })));
  const [manualDate, setManualDate] = useState(client.nextManual || "");
  const [savingDate, setSavingDate] = useState(false);

  return (
    <Modal title={client.name} onClose={onClose}>
      {/* Info rápida */}
      <div style={{ background: COLORS.surfaceHigh, borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, lineHeight: 2 }}>
        {client.phone && <div>📞 <a href={`tel:${client.phone}`} style={{ color: COLORS.accent, textDecoration: "none" }}>{client.phone}</a></div>}
        {client.direccion && <div>📍 {client.direccion}</div>}
        {client.brand && <div>💧 <span style={{ color: getBrandColor(client.brand) }}>{client.brand}</span></div>}
        {client.notas && <div>📝 {client.notas}</div>}
        {client.isDebtor && <div style={{ color: COLORS.danger }}>💳 Deuda: {fmt(client.debtAmount || 0)}</div>}
        {clientEnvases > 0 && <div style={{ color: COLORS.amber }}>🫙 {clientEnvases} bidón{clientEnvases !== 1 ? "es" : ""} prestado{clientEnvases !== 1 ? "s" : ""}</div>}
      </div>

      {/* Pronóstico */}
      <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.surfaceHigh}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Pronóstico de pedido</div>
        {fc ? (
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div>🔁 Frecuencia: <strong style={{ color: COLORS.text }}>cada {fc.avg} día{fc.avg !== 1 ? "s" : ""}</strong></div>
            <div>📅 Último pedido: <strong style={{ color: COLORS.text }}>{fmtDate(fc.last)}</strong></div>
            <div>🔮 Próximo estimado: <strong style={{ color: COLORS.accent }}>{fmtDate(fc.next)}</strong> <UrgencyBadge nextDate={fc.next} manualDate={client.nextManual} /></div>
            {client.nextManual && <div style={{ color: COLORS.amber }}>📌 Fecha manual: <strong>{fmtDate(client.nextManual)}</strong></div>}
          </div>
        ) : clientSales.length === 1 ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Necesitas al menos 2 pedidos para calcular la frecuencia.</div>
        ) : (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Sin ventas registradas aún.</div>
        )}

        {/* Fecha manual */}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)}
            style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 8, color: COLORS.text, padding: "8px 10px", fontSize: 13, flex: 1, outline: "none", boxSizing: "border-box" }} />
          <button onClick={() => { setSavingDate(true); onSaveManualDate(client.id, manualDate); setTimeout(() => setSavingDate(false), 800); }}
            style={{ background: COLORS.amber, color: "#0F1D35", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            {savingDate ? "✓" : "Fijar fecha"}
          </button>
          {manualDate && (
            <button onClick={() => { setManualDate(""); onSaveManualDate(client.id, ""); }}
              style={{ background: COLORS.surfaceHigh, color: COLORS.muted, border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
          )}
        </div>
      </div>

      {/* Deudor toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, background: COLORS.surfaceHigh, borderRadius: 10, padding: "10px 14px" }}>
        <input type="checkbox" id="debtorCheck" checked={!!client.isDebtor} onChange={e => onToggleDebtor(client.id, e.target.checked)} style={{ width: 16, height: 16 }} />
        <label htmlFor="debtorCheck" style={{ fontSize: 13, color: COLORS.text, cursor: "pointer", flex: 1 }}>Marcar como deudor</label>
        {client.isDebtor && <span style={{ color: COLORS.danger, fontWeight: 700, fontSize: 13 }}>{fmt(client.debtAmount || 0)}</span>}
      </div>

      {/* Historial */}
      <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
        Historial ({clientSales.length} pedidos · {clientSales.reduce((a, s) => a + s.qty, 0)} bidones)
      </div>
      {clientSales.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin ventas registradas</div>}
      {clientSales.slice(0, 10).map(s => (
        <div key={s.id} style={{ background: COLORS.surfaceHigh, borderRadius: 8, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>
              {s.qty} bidón{s.qty !== 1 ? "es" : ""} <span style={{ color: getBrandColor(s.marca), fontSize: 11 }}>{s.marca}</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>{fmtDate(s.date)} · {s.pago} · {fmt(s.total)}</div>
          </div>
        </div>
      ))}

      {/* Acciones */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.surfaceHigh}` }}>
        <Btn small color={COLORS.surfaceHigh} onClick={onEdit}>✏️ Editar</Btn>
        <Btn small danger onClick={onDelete}>Eliminar</Btn>
      </div>
    </Modal>
  );
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
function Clients({ clients, setClients, sales, envases }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", direccion: "", notas: "", brand: "", nextManual: "", isDebtor: false, debtAmount: "" });
  const [editForm, setEditForm] = useState({});
  const [vista, setVista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("asc");
  const [detailClient, setDetailClient] = useState(null);

  const save = () => {
    if (!form.name) return;
    setClients([...clients, { id: String(Date.now()), ...form, isDebtor: false, debtAmount: 0 }]);
    setForm({ name: "", phone: "", direccion: "", notas: "", brand: "", nextManual: "", isDebtor: false, debtAmount: "" });
    setAdding(false);
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setEditForm({ name: c.name, phone: c.phone, direccion: c.direccion, notas: c.notas || "", brand: c.brand || "", nextManual: c.nextManual || "", isDebtor: c.isDebtor || false, debtAmount: c.debtAmount || "" });
  };

  const saveEdit = (id) => {
    setClients(clients.map(c => c.id === id ? { ...c, ...editForm, debtAmount: editForm.isDebtor ? +editForm.debtAmount || 0 : 0 } : c));
    setEditId(null);
  };

  const deleteClient = (id) => {
    setClients(clients.filter(c => c.id !== id));
    setDetailClient(null);
  };

  const saveManualDate = (id, date) => setClients(clients.map(c => c.id === id ? { ...c, nextManual: date } : c));
  const toggleDebtor = (id, val) => setClients(clients.map(c => c.id === id ? { ...c, isDebtor: val } : c));

  // Pronósticos
  const withForecast = useMemo(() => clients.map(c => {
    const cSales = sales.filter(s => s.client === c.name);
    const fc = calcForecast(cSales.map(s => ({ date: s.date, qty: s.qty })));
    return { ...c, forecast: fc, orderCount: cSales.length };
  }), [clients, sales]);

  // Próximos 7 días
  const proximosPedidos = withForecast.filter(c => {
    const target = c.nextManual || c.forecast?.next;
    if (!target) return false;
    const d = daysFromToday(target);
    return d !== null && d <= 7;
  }).sort((a, b) => {
    const da = daysFromToday(a.nextManual || a.forecast?.next);
    const db = daysFromToday(b.nextManual || b.forecast?.next);
    return da - db;
  });

  // Deudores
  const deudores = withForecast.filter(c => c.isDebtor);
  const totalDeuda = deudores.reduce((a, c) => a + Number(c.debtAmount || 0), 0);

  // Lista filtrada (vista todos)
  const clientesFiltrados = withForecast.filter(c =>
    !busqueda.trim() ||
    c.name.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.phone || "").includes(busqueda) ||
    (c.direccion || "").toLowerCase().includes(busqueda.toLowerCase())
  ).sort((a, b) => orden === "asc" ? a.name.localeCompare(b.name, "es") : b.name.localeCompare(a.name, "es"));

  const detailFull = detailClient ? withForecast.find(c => c.id === detailClient.id) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Clientes</SectionTitle>
        <Btn small onClick={() => setAdding(!adding)}>{adding ? "Cancelar" : "+ Cliente"}</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["todos", "Todos"], ["proximos", "📅 Próximos"], ["deudores", "💳 Deudores"]].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{ flex: 1, padding: "7px 4px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, background: vista === v ? COLORS.accent : COLORS.surfaceHigh, color: vista === v ? "#0F1D35" : COLORS.muted, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* Buscador */}
      {vista === "todos" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="🔍 Buscar…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 13, flex: 1, outline: "none", boxSizing: "border-box" }} />
          <button onClick={() => setOrden(o => o === "asc" ? "desc" : "asc")} style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.accent, fontWeight: 700, fontSize: 13, padding: "10px 14px", cursor: "pointer" }}>
            {orden === "asc" ? "A→Z" : "Z→A"}
          </button>
        </div>
      )}

      {/* Deuda total */}
      {vista === "deudores" && deudores.length > 0 && (
        <div style={{ background: COLORS.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 14, borderBottom: `3px solid ${COLORS.danger}` }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Total deuda pendiente</div>
          <div style={{ color: COLORS.danger, fontSize: 26, fontWeight: 800, marginTop: 4 }}>{fmt(totalDeuda)}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>{deudores.length} cliente(s)</div>
        </div>
      )}

      {/* Formulario nuevo cliente */}
      {adding && (
        <FormBox>
          <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700 }}>Nuevo cliente</div>
          <Input placeholder="Nombre / Empresa *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
          <Select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}>
            <option value="">— Marca preferida —</option>
            {BRANDS.map(b => <option key={b}>{b}</option>)}
          </Select>
          <textarea placeholder="Notas" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
            style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 13, width: "100%", minHeight: 60, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "system-ui" }} />
          <Btn onClick={save}>Guardar Cliente</Btn>
        </FormBox>
      )}

      {/* Vista PRÓXIMOS */}
      {vista === "proximos" && (
        <>
          {proximosPedidos.length === 0 && (
            <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>
              Ningún pedido esperado en los próximos 7 días.{"\n"}Asegúrate de tener al menos 2 ventas por cliente o fijar una fecha manual.
            </div>
          )}
          {proximosPedidos.map(c => {
            const target = c.nextManual || c.forecast?.next;
            const d = daysFromToday(target);
            return (
              <div key={c.id} onClick={() => setDetailClient(c)}
                style={{ background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${d < 0 ? COLORS.danger : d <= 2 ? COLORS.amber : COLORS.accent}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{c.phone && `📞 ${c.phone}`}{c.brand && ` · `}{c.brand && <span style={{ color: getBrandColor(c.brand) }}>{c.brand}</span>}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <UrgencyBadge nextDate={c.forecast?.next} manualDate={c.nextManual} />
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{fmtDate(target)}</div>
                  {c.nextManual && <div style={{ fontSize: 10, color: COLORS.amber }}>manual</div>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Vista DEUDORES */}
      {vista === "deudores" && (
        <>
          {deudores.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>Sin deudores registrados ✅</div>}
          {deudores.map(c => (
            <div key={c.id} onClick={() => setDetailClient(c)}
              style={{ background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${COLORS.danger}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>{c.phone}</div>
              </div>
              <div style={{ color: COLORS.danger, fontWeight: 800, fontSize: 18 }}>{fmt(c.debtAmount || 0)}</div>
            </div>
          ))}
        </>
      )}

      {/* Vista TODOS */}
      {vista === "todos" && clientesFiltrados.map(c => {
        const target = c.nextManual || c.forecast?.next;
        return (
          <div key={c.id} style={{ background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
            {editId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700 }}>Editando cliente</div>
                <Input placeholder="Nombre / Empresa" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                <Input placeholder="Teléfono" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                <Input placeholder="Dirección" value={editForm.direccion} onChange={e => setEditForm({ ...editForm, direccion: e.target.value })} />
                <Select value={editForm.brand || ""} onChange={e => setEditForm({ ...editForm, brand: e.target.value })}>
                  <option value="">— Marca preferida —</option>
                  {BRANDS.map(b => <option key={b}>{b}</option>)}
                </Select>
                <textarea placeholder="Notas" value={editForm.notas || ""} onChange={e => setEditForm({ ...editForm, notas: e.target.value })}
                  style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 13, width: "100%", minHeight: 60, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "system-ui" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id={`debtor-${c.id}`} checked={!!editForm.isDebtor} onChange={e => setEditForm({ ...editForm, isDebtor: e.target.checked })} />
                  <label htmlFor={`debtor-${c.id}`} style={{ fontSize: 13, color: COLORS.text, cursor: "pointer" }}>Deudor</label>
                  {editForm.isDebtor && <Input placeholder="Monto S/" type="number" value={editForm.debtAmount} onChange={e => setEditForm({ ...editForm, debtAmount: e.target.value })} />}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small onClick={() => saveEdit(c.id)}>Guardar</Btn>
                  <Btn small color={COLORS.surfaceHigh} onClick={() => setEditId(null)}>Cancelar</Btn>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {c.name}
                      {c.isDebtor && <span style={{ color: COLORS.danger, fontSize: 11 }}>💳</span>}
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
                      {c.phone && `📞 ${c.phone}`}
                      {c.brand && <span style={{ marginLeft: 6, color: getBrandColor(c.brand) }}>● {c.brand}</span>}
                    </div>
                    {c.direccion && <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>}
                    {c.notas && <div style={{ color: COLORS.amber, fontSize: 11, marginTop: 3 }}>📝 {c.notas}</div>}
                    <div style={{ marginTop: 6, fontSize: 11, color: COLORS.muted }}>
                      {c.orderCount} venta{c.orderCount !== 1 ? "s" : ""}
                      {c.forecast && <span> · cada ~{c.forecast.avg}d</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                    {target && <UrgencyBadge nextDate={c.forecast?.next} manualDate={c.nextManual} />}
                    {target && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>{fmtDate(target)}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn small color={COLORS.surfaceHigh} onClick={() => startEdit(c)}>✏️ Editar</Btn>
                  <Btn small color={COLORS.surfaceHigh} onClick={() => setDetailClient(c)}>📋 Ficha</Btn>
                  <Btn small danger onClick={() => deleteClient(c.id)}>Eliminar</Btn>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Modal detalle */}
      {detailClient && detailFull && (
        <ClientDetailModal
          client={detailFull}
          sales={sales}
          envases={envases}
          onClose={() => setDetailClient(null)}
          onEdit={() => { startEdit(detailFull); setDetailClient(null); }}
          onDelete={() => deleteClient(detailFull.id)}
          onSaveManualDate={saveManualDate}
          onToggleDebtor={toggleDebtor}
        />
      )}
    </div>
  );
}

// ─── Importador Telegram ──────────────────────────────────────────────────────
function Importer({ clients, setClients }) {
  const [status, setStatus] = useState("idle");
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [jsonText, setJsonText] = useState("");

  const procesar = (text) => {
    const { clientes, errors } = parseTelegramClients(text);
    setPreview(clientes); setErrors(errors);
    setStatus(clientes.length > 0 ? "preview" : "error");
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setJsonText(ev.target.result); procesar(ev.target.result); };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const nuevos = preview.filter(p => !clients.find(c => c.name.toUpperCase() === p.nombre.toUpperCase()))
      .map(p => ({ id: String(Date.now() + Math.random()), name: p.nombre, phone: "", direccion: p.direccion, notas: "", brand: "", nextManual: "", isDebtor: false, debtAmount: 0 }));
    if (nuevos.length > 0) setClients(prev => [...prev, ...nuevos]);
    setStatus("done"); setPreview([]);
  };

  const reset = () => { setStatus("idle"); setPreview([]); setErrors([]); setJsonText(""); };

  return (
    <div>
      <SectionTitle>Importar clientes desde Telegram</SectionTitle>
      <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
        Exporta tu chat de Telegram en formato JSON y extrae nombres y direcciones automáticamente.
      </div>
      {status === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormBox>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>📋 Pega el contenido JSON</div>
            <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Pega aquí el contenido del JSON de Telegram…"
              style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "12px 14px", fontSize: 13, width: "100%", minHeight: 140, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "monospace" }} />
            <Btn onClick={() => { if (!jsonText.trim()) return; procesar(jsonText); }}>Procesar clientes</Btn>
          </FormBox>
          <div style={{ background: COLORS.surface, borderRadius: 14, padding: 16, border: `2px dashed ${COLORS.surfaceHigh}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>¿Prefieres subir el archivo?</div>
            <label style={{ background: COLORS.surfaceHigh, color: COLORS.text, borderRadius: 10, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📂 Elegir archivo JSON
              <input type="file" accept=".json" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      )}
      {status === "preview" && (
        <div>
          <div style={{ background: COLORS.surface, borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: COLORS.accent, fontWeight: 700 }}>{preview.length} clientes encontrados</span>
            <Btn small color={COLORS.surfaceHigh} onClick={reset}>Cancelar</Btn>
          </div>
          {preview.map((p, i) => {
            const existe = clients.find(c => c.name.toUpperCase() === p.nombre.toUpperCase());
            return (
              <div key={i} style={{ background: COLORS.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 8, borderLeft: `3px solid ${existe ? COLORS.muted : COLORS.accent}`, opacity: existe ? 0.5 : 1 }}>
                <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {p.direccion}</div>
                {existe && <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>Ya registrado</div>}
              </div>
            );
          })}
          <Btn onClick={handleImport}>✅ Importar {preview.filter(p => !clients.find(c => c.name.toUpperCase() === p.nombre.toUpperCase())).length} clientes nuevos</Btn>
        </div>
      )}
      {status === "done" && (
        <div style={{ background: COLORS.surface, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>¡Clientes importados!</div>
          <Btn onClick={reset}>Importar otro archivo</Btn>
        </div>
      )}
      {status === "error" && (
        <div style={{ background: COLORS.surface, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ color: COLORS.danger, fontWeight: 700 }}>No se encontraron clientes</div>
          {errors.map((e, i) => <div key={i} style={{ color: COLORS.muted, fontSize: 12 }}>{e}</div>)}
          <Btn onClick={reset}>Intentar de nuevo</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Envases ──────────────────────────────────────────────────────────────────
function Envases({ envases, setEnvases, clients }) {
  const [addModal, setAddModal] = useState(null); // clientId
  const [clientSearch, setClientSearch] = useState("");

  // envases: array de { id, clientId, qty, date }
  const byClient = useMemo(() => {
    const map = {};
    envases.forEach(e => {
      if (!map[e.clientId]) map[e.clientId] = 0;
      map[e.clientId] += (e.qty || 0);
    });
    return map;
  }, [envases]);

  const totalPrestados = Object.values(byClient).reduce((a, b) => a + b, 0);

  const clientesFiltrados = clientSearch.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;

  const prestar = (clientId, qty) => {
    setEnvases([...envases, { id: String(Date.now()), clientId, qty: +qty, date: today() }]);
    setAddModal(null);
    setClientSearch("");
  };

  const devolver = (clientId, qty) => {
    let toReturn = +qty;
    const entries = envases.filter(e => e.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date));
    const updated = [];
    const removed = new Set();
    for (const e of entries) {
      if (toReturn <= 0) break;
      if (e.qty <= toReturn) { toReturn -= e.qty; removed.add(e.id); }
      else { updated.push({ ...e, qty: e.qty - toReturn }); removed.add(e.id); toReturn = 0; }
    }
    setEnvases([...envases.filter(e => !removed.has(e.id)), ...updated]);
  };

  const [returnModal, setReturnModal] = useState(null); // {clientId, max}
  const [returnQty, setReturnQty] = useState(1);
  const [prestQty, setPrestQty] = useState(1);

  return (
    <div>
      <SectionTitle>Envases Prestados</SectionTitle>
      <div style={{ background: COLORS.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 14, borderBottom: `3px solid ${COLORS.amber}` }}>
        <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Total pendientes</div>
        <div style={{ color: COLORS.amber, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalPrestados}</div>
        <div style={{ color: COLORS.muted, fontSize: 11 }}>{Object.keys(byClient).filter(id => byClient[id] > 0).length} cliente(s) con envases fuera</div>
      </div>

      <Btn small onClick={() => setAddModal("new")}>+ Registrar préstamo</Btn>

      <div style={{ marginTop: 14 }}>
        {clients.filter(c => byClient[c.id] > 0)
          .sort((a, b) => byClient[b.id] - byClient[a.id])
          .map(c => (
            <div key={c.id} style={{ background: COLORS.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 8, borderLeft: `3px solid ${COLORS.amber}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 11 }}>{c.phone}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: COLORS.amber, fontWeight: 800, fontSize: 22 }}>{byClient[c.id]}</div>
                <div style={{ color: COLORS.muted, fontSize: 10 }}>bidón{byClient[c.id] !== 1 ? "es" : ""}</div>
              </div>
              <button onClick={() => { setReturnModal({ clientId: c.id, name: c.name, max: byClient[c.id] }); setReturnQty(1); }}
                style={{ background: COLORS.accent, color: "#0F1D35", border: "none", borderRadius: 8, padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                ↩ Devolver
              </button>
            </div>
          ))}
        {Object.values(byClient).every(v => v === 0) && (
          <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>No hay envases prestados 🎉</div>
        )}
      </div>

      {/* Modal prestar */}
      {addModal && (
        <Modal title="Registrar préstamo" onClose={() => { setAddModal(null); setClientSearch(""); setPrestQty(1); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldLabel>Buscar cliente</FieldLabel>
            <input placeholder="🔍 Nombre del cliente…" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 10, color: COLORS.text, padding: "10px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" }} />
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {clientesFiltrados.map(c => (
                <div key={c.id}
                  style={{ background: COLORS.surfaceHigh, borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}
                  onClick={() => setAddModal(c.id)}
                  onMouseEnter={e => e.currentTarget.style.opacity = ".8"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                  <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                  {c.direccion && <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>}
                </div>
              ))}
            </div>
            {addModal !== "new" && (
              <>
                <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>
                  Cliente: {clients.find(c => c.id === addModal)?.name}
                </div>
                <FieldLabel>Bidones a prestar</FieldLabel>
                <Input type="number" value={prestQty} onChange={e => setPrestQty(e.target.value)} placeholder="Cantidad" />
                <Btn onClick={() => prestar(addModal, prestQty)}>Registrar préstamo</Btn>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Modal devolver */}
      {returnModal && (
        <Modal title={`Devolver — ${returnModal.name}`} onClose={() => setReturnModal(null)}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ color: COLORS.amber, fontSize: 36, fontWeight: 800 }}>{returnModal.max}</div>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>bidones prestados actualmente</div>
          </div>
          <FieldLabel>¿Cuántos devuelve?</FieldLabel>
          <Input type="number" value={returnQty} onChange={e => setReturnQty(e.target.value)} placeholder="Cantidad" />
          <div style={{ marginTop: 12 }}>
            <Btn onClick={() => {
              if (+returnQty < 1) return;
              if (+returnQty > returnModal.max) return alert(`Máximo ${returnModal.max}`);
              devolver(returnModal.clientId, returnQty);
              setReturnModal(null);
            }}>Confirmar devolución</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Nav icons ────────────────────────────────────────────────────────────────
const icons = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  inventory: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  sales:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  clients:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  envases:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3h8l2 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V7L8 3z"/><line x1="6" y1="7" x2="18" y2="7"/></svg>,
  importer:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

const tabs = [
  { id: "dashboard", label: "Inicio" },
  { id: "sales",     label: "Ventas" },
  { id: "inventory", label: "Stock" },
  { id: "clients",   label: "Clientes" },
  { id: "envases",   label: "Envases" },
  { id: "importer",  label: "Telegram" },
];

// ─── Login ────────────────────────────────────────────────────────────────────
const APP_PASSWORD = "agua2024";

function LoginScreen({ onLogin }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const attempt = () => {
    if (pwd === APP_PASSWORD) { onLogin(); }
    else { setError(true); setPwd(""); setTimeout(() => setError(false), 2000); }
  };
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "system-ui", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, maxWidth: 430, margin: "0 auto" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💧</div>
      <div style={{ color: COLORS.accent, fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>AguaPro</div>
      <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 36 }}>Gestión de bidones</div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="password" placeholder="Contraseña" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()}
          style={{ background: COLORS.surface, border: `2px solid ${error ? COLORS.danger : COLORS.surfaceHigh}`, borderRadius: 12, color: COLORS.text, padding: "14px 16px", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: 4, transition: "border-color 0.2s" }} />
        {error && <div style={{ color: COLORS.danger, fontSize: 13, textAlign: "center", fontWeight: 600 }}>Contraseña incorrecta</div>}
        <button onClick={attempt} style={{ background: COLORS.accent, color: "#0F1D35", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Ingresar</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts, prodReady]    = useFirebase("products", initialProducts);
  const [clients,  setClients,  cliReady]     = useFirebase("clients",  initialClients);
  const [sales,    setSales,    salesReady]   = useFirebase("sales",    initialSales);
  const [envases,  setEnvases,  envasesReady] = useFirebase("envases",  []);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const allReady = prodReady && cliReady && salesReady && envasesReady;
  if (!allReady) return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", gap: 16 }}>
      <div style={{ fontSize: 40 }}>💧</div>
      <div style={{ color: COLORS.accent, fontWeight: 700 }}>Cargando AguaPro...</div>
    </div>
  );

  const screens = {
    dashboard: <Dashboard sales={sales} products={products} />,
    inventory: <Inventory products={products} setProducts={setProducts} sales={sales} envases={envases} />,
    sales:     <Sales sales={sales} setSales={setSales} products={products} setProducts={setProducts} clients={clients} />,
    clients:   <Clients clients={clients} setClients={setClients} sales={sales} envases={envases} />,
    envases:   <Envases envases={envases} setEnvases={setEnvases} clients={clients} />,
    importer:  <Importer clients={clients} setClients={setClients} />,
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: COLORS.text, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ background: COLORS.surface, padding: "16px 20px 12px", borderBottom: `1px solid ${COLORS.surfaceHigh}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>💧 AguaPro</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{tabs.find(t => t.id === tab)?.label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.accent }}>{icons[tab]}</div>
          <button onClick={() => setLoggedIn(false)} style={{ background: COLORS.surfaceHigh, border: "none", borderRadius: 8, color: COLORS.muted, fontSize: 11, fontWeight: 600, padding: "6px 10px", cursor: "pointer" }}>Salir</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: "4px 16px 90px", overflowY: "auto" }}>
        {screens[tab]}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: COLORS.surface, borderTop: `1px solid ${COLORS.surfaceHigh}`, display: "flex", padding: "8px 0 12px" }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", color: active ? COLORS.accent : COLORS.muted, transition: "color 0.2s" }}>
              {icons[t.id]}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{t.label}</span>
              {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
