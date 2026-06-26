import { useState, useEffect } from "react";

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

// ─── Telegram JSON parser ─────────────────────────────────────────────────────
function parseTelegramJSON(jsonText, knownProducts) {
  let data;
  try { data = JSON.parse(jsonText); } catch { return { orders: [], errors: ["JSON inválido"] }; }

  const messages = data.messages || [];
  const orders = [];
  const errors = [];

  messages.forEach((msg, idx) => {
    const raw = typeof msg.text === "string" ? msg.text
      : Array.isArray(msg.text) ? msg.text.map(t => typeof t === "string" ? t : t.text || "").join("") : "";
    if (!raw.trim()) return;

    const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 5) return;

    const line0 = lines[0].toUpperCase();
    const m0 = line0.match(/^(\d+)\s+([A-Z\s]+?)\s+(\d+(?:\.\d+)?)\s*(?:SOLES?|S\/)?/);
    if (!m0) return;

    const qty = parseInt(m0[1]);
    const marcaRaw = m0[2].trim();
    const price = parseFloat(m0[3]);

    const prod = knownProducts.find(p =>
      p.name.toUpperCase() === marcaRaw || marcaRaw.includes(p.name.toUpperCase())
    );
    if (!prod) { errors.push(`Msg ${idx + 1}: marca "${marcaRaw}" no reconocida`); return; }

    const clientName = lines[1] || "Desconocido";
    const direccion = [lines[2], lines[3]].filter(Boolean).join(", ");
    const pagoInit = lines[4] ? lines[4].toUpperCase().charAt(0) : "";
    const pago = PAGO_MAP[pagoInit] || "Efectivo";
    const vendedor = lines[5] ? lines[5].toUpperCase().charAt(0) : "";
    const date = msg.date ? msg.date.slice(0, 10) : new Date().toISOString().slice(0, 10);

    orders.push({ clientName, direccion, marca: prod.name, qty, unitPrice: price, total: price * qty, pago, vendedor, date });
  });

  return { orders, errors };
}

const initialProducts = [
  { id: 1, name: "Fresh",    proveedor: "Distribuidora Fresh S.A.",  price: 8.50,  stock: 40, tipo: "bidon" },
  { id: 2, name: "Vital",    proveedor: "Agua Vital Ltda.",           price: 9.00,  stock: 5,  tipo: "bidon" },
  { id: 3, name: "Spring",   proveedor: "Spring Waters Corp.",        price: 9.50,  stock: 0,  tipo: "bidon" },
  { id: 4, name: "San Luis", proveedor: "San Luis Distribuciones",    price: 8.00,  stock: 22, tipo: "bidon" },
];

const initialClients = [
  { id: 1, name: "Restaurante El Buen Sabor", phone: "555-1001", direccion: "Av. Central 123", notas: "" },
  { id: 2, name: "Oficinas García & Asociados", phone: "555-2002", direccion: "Calle 5 Norte 88", notas: "" },
  { id: 3, name: "Juan Pérez", phone: "555-3003", direccion: "Pasaje Los Olivos 4", notas: "" },
];

const initialSales = [
  { id: 1, client: "Restaurante El Buen Sabor", marca: "Fresh",    qty: 10, total: 85,  unitPrice: 8.50, pago: "Yape",          date: "2026-06-10" },
  { id: 2, client: "Oficinas García & Asociados", marca: "Vital",  qty: 6,  total: 54,  unitPrice: 9.00, pago: "Transferencia", date: "2026-06-11" },
  { id: 3, client: "Juan Pérez",                  marca: "San Luis",qty: 3,  total: 24,  unitPrice: 8.00, pago: "Crédito",       date: "2026-06-12" },
];



const fmt = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
const stockColor = (s) => s === 0 ? COLORS.danger : s <= 5 ? COLORS.amber : COLORS.accent;
const today = () => new Date().toISOString().slice(0, 10);

// ─── Base components ──────────────────────────────────────────────────────────
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
    const d = new Date("2026-06-12"); d.setDate(d.getDate() - (6 - i));
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

  const startEdit = (p) => {
    setEditId(p.id);
    setEditForm({ name: p.name, proveedor: p.proveedor, price: p.price, stock: p.stock });
  };

  const saveEdit = (id) => {
    setProducts(products.map(p => p.id === id ? {
      ...p,
      name: editForm.name || p.name,
      proveedor: editForm.proveedor || p.proveedor,
      price: editForm.price !== "" ? +editForm.price : p.price,
      stock: editForm.stock !== "" ? +editForm.stock : p.stock,
    } : p));
    setEditId(null);
  };

  const deleteProduct = (id) => setProducts(products.filter(p => p.id !== id));

  const saveNew = () => {
    if (!newForm.name || !newForm.price) return;
    setProducts([...products, {
      id: Date.now(), name: newForm.name, proveedor: newForm.proveedor,
      price: +newForm.price, stock: +newForm.stock || 0, tipo: newForm.tipo,
    }]);
    setNewForm({ name: "", proveedor: "", price: "", stock: "", tipo: "otro" });
    setAdding(false);
  };

  // Calcular totales de bidones (Fresh, Vital, Spring — excluye San Luis y otros)
  const BIDONES_MARCAS = ["Fresh", "Vital", "Spring"];
  const totalBidones = products
    .filter(p => BIDONES_MARCAS.includes(p.name))
    .reduce((a, p) => a + p.stock, 0);

  // Vacíos = total vendido de esas marcas (los que salieron y podrían volver)
  const totalVendidos = sales
    .filter(s => BIDONES_MARCAS.includes(s.marca))
    .reduce((a, s) => a + s.qty, 0);

  // Prestados pendientes de recojo
  const totalPrestados = (envases || []).reduce((a, e) => a + e.qty, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Inventario</SectionTitle>
        <Btn small onClick={() => setAdding(!adding)}>{adding ? "Cancelar" : "+ Producto"}</Btn>
      </div>

      {/* Resumen de envases */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{
          flex: "1 1 120px", background: COLORS.surface, borderRadius: 14, padding: "14px 16px",
          borderBottom: `3px solid ${COLORS.accent}`,
        }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>En stock</div>
          <div style={{ color: COLORS.accent, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalBidones}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>Fresh + Vital + Spring</div>
        </div>
        <div style={{
          flex: "1 1 120px", background: COLORS.surface, borderRadius: 14, padding: "14px 16px",
          borderBottom: `3px solid ${COLORS.amber}`,
        }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Vacíos</div>
          <div style={{ color: COLORS.amber, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalVendidos}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>despachados</div>
        </div>
        <div style={{
          flex: "1 1 120px", background: COLORS.surface, borderRadius: 14, padding: "14px 16px",
          borderBottom: `3px solid ${COLORS.danger}`,
        }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Prestados</div>
          <div style={{ color: COLORS.danger, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalPrestados}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>por recoger</div>
        </div>
      </div>

      {adding && (
        <FormBox>
          <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700 }}>Nuevo producto</div>
          <Input placeholder="Nombre del producto" value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} />
          <Input placeholder="Proveedor" value={newForm.proveedor} onChange={e => setNewForm({ ...newForm, proveedor: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Input placeholder="Precio S/" type="number" value={newForm.price} onChange={e => setNewForm({ ...newForm, price: e.target.value })} />
            <Input placeholder="Stock inicial" type="number" value={newForm.stock} onChange={e => setNewForm({ ...newForm, stock: e.target.value })} />
          </div>
          <Select value={newForm.tipo} onChange={e => setNewForm({ ...newForm, tipo: e.target.value })}>
            <option value="bidon">Bidón de agua 20L</option>
            <option value="otro">Otro producto</option>
          </Select>
          <Btn onClick={saveNew}>Guardar Producto</Btn>
        </FormBox>
      )}

      {products.map(p => (
        <div key={p.id} style={{
          background: COLORS.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 10,
          borderLeft: `4px solid ${getBrandColor(p.name)}`,
        }}>
          {editId === p.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700 }}>Editando: {p.name}</div>
              <Input placeholder="Nombre" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              <Input placeholder="Proveedor" value={editForm.proveedor} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} />
              <div style={{ display: "flex", gap: 8 }}>
                <Input placeholder="Precio S/" type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
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
                <Btn small danger onClick={() => deleteProduct(p.id)}>Eliminar</Btn>
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

  const PRECIO_ENVASE = 25;

  const adjustStock = (marca, delta) => {
    setProducts(prev => prev.map(p => p.name === marca ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
  };

  const save = () => {
    const prod = products.find(p => p.name === form.marca);
    if (!form.client || !prod || form.qty < 1 || !form.pago) return;
    const precioAgua = form.customPrice !== "" ? +form.customPrice : prod.price;
    const precioEnvase = form.tipoVenta === "C" ? PRECIO_ENVASE : 0;
    const unitPrice = precioAgua + precioEnvase;
    const total = unitPrice * +form.qty;
    setSales([...sales, {
      id: Date.now(), client: form.client, marca: form.marca,
      qty: +form.qty, unitPrice, precioAgua, precioEnvase,
      total, pago: form.pago, tipoVenta: form.tipoVenta, date: today(),
    }]);
    adjustStock(form.marca, -form.qty);
    setForm({ client: "", marca: "", qty: 1, customPrice: "", pago: "", tipoVenta: "A" });
    setClientSearch("");
    setAdding(false);
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setEditForm({ client: s.client, marca: s.marca, qty: s.qty, customPrice: s.unitPrice ?? "", pago: s.pago || "", date: s.date || today() });
  };

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

  const deleteSale = (id) => {
    const sale = sales.find(s => s.id === id);
    if (sale) adjustStock(sale.marca, +sale.qty);
    setSales(sales.filter(s => s.id !== id));
  };

  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);

  const clientesFiltrados = clientSearch.trim().length > 0
    ? clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.direccion || "").toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  const selectedProd = products.find(p => p.name === form.marca);
  const newUnitPrice = form.customPrice !== "" ? +form.customPrice : selectedProd?.price || 0;

  const editProd = products.find(p => p.name === editForm.marca);
  const editUnitPrice = editForm.customPrice !== "" ? +editForm.customPrice : editProd?.price || 0;

  const [salesSearch, setSalesSearch] = useState("");

  const ventasFiltradas = salesSearch.trim()
    ? [...sales].reverse().filter(s =>
        s.client.toLowerCase().includes(salesSearch.toLowerCase()) ||
        s.marca.toLowerCase().includes(salesSearch.toLowerCase()) ||
        (s.pago || "").toLowerCase().includes(salesSearch.toLowerCase()) ||
        (s.date || "").includes(salesSearch)
      )
    : [...sales].reverse();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Ventas</SectionTitle>
        <Btn small onClick={() => { setAdding(!adding); setClientSearch(""); setShowClientList(false); }}>{adding ? "Cancelar" : "+ Venta"}</Btn>
      </div>

      {adding && (
        <FormBox>
          {/* Búsqueda de cliente */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="🔍 Buscar cliente por nombre o dirección…"
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
              onFocus={() => setShowClientList(true)}
              style={{
                background: COLORS.surfaceHigh, border: `2px solid ${form.client ? COLORS.accent : "transparent"}`,
                borderRadius: 10, color: COLORS.text, padding: "10px 14px",
                fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box",
              }}
            />
            {form.client && (
              <div style={{ color: COLORS.accent, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                ✓ {form.client}
                <button onClick={() => { setForm({ ...form, client: "" }); setClientSearch(""); }} style={{
                  background: "none", border: "none", color: COLORS.muted, cursor: "pointer", marginLeft: 8, fontSize: 12,
                }}>✕ Cambiar</button>
              </div>
            )}
            {showClientList && clientSearch.trim().length > 0 && !form.client && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                background: COLORS.surface, borderRadius: 10, marginTop: 4,
                maxHeight: 200, overflowY: "auto",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}>
                {clientesFiltrados.length === 0 ? (
                  <div style={{ color: COLORS.muted, padding: "12px 14px", fontSize: 13 }}>Sin resultados</div>
                ) : clientesFiltrados.map(c => (
                  <div key={c.id} onClick={() => {
                    setForm({ ...form, client: c.name });
                    setClientSearch(c.name);
                    setShowClientList(false);
                  }} style={{
                    padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.surfaceHigh}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    {c.direccion && <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Select value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value, customPrice: "" })}>
            <option value="">Seleccionar producto…</option>
            {products.map(p => (
              <option key={p.id} value={p.name}>{p.name} — {fmt(p.price)} (stock: {p.stock})</option>
            ))}
          </Select>

          {/* Tipo de venta */}
          <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600 }}>TIPO DE VENTA</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "A", label: "A — Entrega su envase", color: COLORS.accent },
              { id: "B", label: "B — Se le presta", color: COLORS.amber },
              { id: "C", label: "C — Compra envase", color: COLORS.danger },
            ].map(t => (
              <button key={t.id} onClick={() => setForm({ ...form, tipoVenta: t.id })} style={{
                flex: 1, padding: "8px 4px", borderRadius: 10, border: "none",
                background: form.tipoVenta === t.id ? t.color : COLORS.surfaceHigh,
                color: form.tipoVenta === t.id ? "#0F1D35" : COLORS.muted,
                fontWeight: 700, fontSize: 11, cursor: "pointer", lineHeight: 1.4,
              }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input placeholder="Cantidad" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
            <Input
              placeholder={selectedProd ? `Precio (${fmt(selectedProd.price)})` : "Precio unit."}
              type="number"
              value={form.customPrice}
              onChange={e => setForm({ ...form, customPrice: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PAGOS.map(p => (
              <button key={p} onClick={() => setForm({ ...form, pago: p })} style={{
                flex: 1, minWidth: 70, padding: "8px 4px", borderRadius: 10, border: "none",
                background: form.pago === p ? PAGO_COLORS[p] : COLORS.surfaceHigh,
                color: form.pago === p ? "#fff" : COLORS.muted,
                fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>{p}</button>
            ))}
          </div>
          {form.customPrice !== "" && selectedProd && (
            <div style={{ color: COLORS.amber, fontSize: 11 }}>
              Precio agua base: {fmt(selectedProd.price)} → Personalizado: {fmt(form.customPrice)}
            </div>
          )}
          {form.tipoVenta === "C" && (
            <div style={{ background: COLORS.surfaceHigh, borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
              <div style={{ color: COLORS.muted }}>💧 Agua: {fmt(form.customPrice !== "" ? +form.customPrice : selectedProd?.price || 0)}</div>
              <div style={{ color: COLORS.muted }}>🪣 Envase: {fmt(PRECIO_ENVASE)}</div>
              <div style={{ color: COLORS.accent, fontWeight: 700, marginTop: 4 }}>
                Total x{form.qty}: {fmt((((form.customPrice !== "" ? +form.customPrice : selectedProd?.price || 0) + PRECIO_ENVASE)) * +form.qty)}
              </div>
            </div>
          )}
          {form.tipoVenta !== "C" && selectedProd && form.qty > 0 && (
            <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>
              Total: {fmt(newUnitPrice * form.qty)}
            </div>
          )}
          <Btn onClick={save}>Registrar Venta</Btn>
        </FormBox>
      )}

      {/* Buscador de ventas */}
      {!adding && (
        <input
          placeholder="🔍 Buscar por cliente, marca, pago o fecha…"
          value={salesSearch}
          onChange={e => setSalesSearch(e.target.value)}
          style={{
            background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
            color: COLORS.text, padding: "10px 14px", fontSize: 13,
            width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 12,
          }}
        />
      )}

      {ventasFiltradas.map(s => (
        <div key={s.id} style={{
          background: COLORS.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          borderLeft: `3px solid ${getBrandColor(s.marca)}`,
        }}>
          {editId === s.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700 }}>Editando venta</div>
              <Select value={editForm.client} onChange={e => setEditForm({ ...editForm, client: e.target.value })}>
                {clients.map(c => <option key={c.id}>{c.name}</option>)}
              </Select>
              <Select value={editForm.marca} onChange={e => setEditForm({ ...editForm, marca: e.target.value, customPrice: "" })}>
                {products.map(p => <option key={p.id} value={p.name}>{p.name} — {fmt(p.price)}</option>)}
              </Select>
              <div style={{ display: "flex", gap: 8 }}>
                <Input placeholder="Cantidad" type="number" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} />
                <Input
                  placeholder={editProd ? `Precio (${fmt(editProd.price)})` : "Precio unit."}
                  type="number"
                  value={editForm.customPrice}
                  onChange={e => setEditForm({ ...editForm, customPrice: e.target.value })}
                />
              </div>
              <div>
                <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>Fecha de la venta</div>
                <input
                  type="date"
                  value={editForm.date || ""}
                  onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  style={{
                    background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
                    color: COLORS.text, padding: "10px 14px", fontSize: 14,
                    width: "100%", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PAGOS.map(p => (
                  <button key={p} onClick={() => setEditForm({ ...editForm, pago: p })} style={{
                    flex: 1, minWidth: 70, padding: "8px 4px", borderRadius: 10, border: "none",
                    background: editForm.pago === p ? PAGO_COLORS[p] : COLORS.surfaceHigh,
                    color: editForm.pago === p ? "#fff" : COLORS.muted,
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                  }}>{p}</button>
                ))}
              </div>
              {editProd && editForm.qty > 0 && (
                <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>
                  Total: {fmt(editUnitPrice * editForm.qty)}
                </div>
              )}
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
                    <span style={{
                      display: "inline-block", marginLeft: 6,
                      background: s.tipoVenta === "A" ? COLORS.accent + "22" : s.tipoVenta === "B" ? COLORS.amber + "22" : COLORS.danger + "22",
                      color: s.tipoVenta === "A" ? COLORS.accent : s.tipoVenta === "B" ? COLORS.amber : COLORS.danger,
                      borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700,
                    }}>Tipo {s.tipoVenta}</span>
                  )}
                  <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{s.client}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>
                    ×{s.qty} uds. · {s.unitPrice ? fmt(s.unitPrice) + "/u" : ""} · {s.date}{s.vendedor ? ` · Vendedor: ${s.vendedor}` : ""}
                  </div>
                  {s.pago && (
                    <span style={{
                      display: "inline-block", marginTop: 5,
                      background: (PAGO_COLORS[s.pago] || COLORS.muted) + "22",
                      color: PAGO_COLORS[s.pago] || COLORS.muted,
                      borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                    }}>{s.pago}</span>
                  )}
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

// ─── Clientes ─────────────────────────────────────────────────────────────────
function Clients({ clients, setClients, sales }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", direccion: "", notas: "" });
  const [editForm, setEditForm] = useState({});
  const [vista, setVista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("asc");

  const save = () => {
    if (!form.name) return;
    setClients([...clients, { id: Date.now(), ...form }]);
    setForm({ name: "", phone: "", direccion: "", notas: "" });
    setAdding(false);
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setEditForm({ name: c.name, phone: c.phone, direccion: c.direccion, notas: c.notas || "" });
  };

  const saveEdit = (id) => {
    setClients(clients.map(c => c.id === id ? { ...c, ...editForm } : c));
    setEditId(null);
  };

  const deleteClient = (id) => setClients(clients.filter(c => c.id !== id));

  // Deudores: clientes con ventas en Crédito
  const deudores = clients.map(c => {
    const ventasCredito = sales.filter(s => s.client === c.name && s.pago === "Crédito");
    const deuda = ventasCredito.reduce((a, s) => a + s.total, 0);
    return { ...c, deuda, ventasCredito };
  }).filter(c => c.deuda > 0);

  const totalDeuda = deudores.reduce((a, c) => a + c.deuda, 0);

  // Próximos pedidos: basado en frecuencia de compras
  const proximosPedidos = clients.map(c => {
    const compras = sales
      .filter(s => s.client === c.name)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (compras.length < 2) return null;

    const fechas = compras.map(s => new Date(s.date));
    const intervalos = [];
    for (let i = 1; i < fechas.length; i++) {
      intervalos.push((fechas[i] - fechas[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const promedioInt = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const ultimaCompra = fechas[fechas.length - 1];
    const proximaFecha = new Date(ultimaCompra.getTime() + promedioInt * 24 * 60 * 60 * 1000);
    const diasRestantes = Math.round((proximaFecha - new Date()) / (1000 * 60 * 60 * 24));
    const marcaFav = compras.reduce((acc, s) => {
      acc[s.marca] = (acc[s.marca] || 0) + s.qty; return acc;
    }, {});
    const marcaMasComprada = Object.entries(marcaFav).sort((a, b) => b[1] - a[1])[0]?.[0];

    return { ...c, diasRestantes, proximaFecha: proximaFecha.toISOString().slice(0, 10), marcaMasComprada, totalCompras: compras.length };
  }).filter(Boolean).sort((a, b) => a.diasRestantes - b.diasRestantes);

  const clientesFiltrados = vista === "deudores" ? deudores
    : vista === "proximos" ? proximosPedidos
    : clients;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Clientes</SectionTitle>
        <Btn small onClick={() => setAdding(!adding)}>{adding ? "Cancelar" : "+ Cliente"}</Btn>
      </div>

      {/* Tabs de vista */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["todos", "Todos"], ["deudores", "Deudores"], ["proximos", "Próximos pedidos"]].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{
            flex: 1, padding: "7px 4px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700,
            background: vista === v ? COLORS.accent : COLORS.surfaceHigh,
            color: vista === v ? "#0F1D35" : COLORS.muted, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {/* Buscador — solo en vista Todos */}
      {vista === "todos" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            placeholder="🔍 Buscar por nombre, teléfono o dirección…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
              color: COLORS.text, padding: "10px 14px", fontSize: 13,
              flex: 1, outline: "none", boxSizing: "border-box",
            }}
          />
          <button onClick={() => setOrden(o => o === "asc" ? "desc" : "asc")} style={{
            background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
            color: COLORS.accent, fontWeight: 700, fontSize: 13, padding: "10px 14px",
            cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {orden === "asc" ? "A → Z" : "Z → A"}
          </button>
        </div>
      )}

      {/* Total deuda */}
      {vista === "deudores" && (
        <div style={{
          background: COLORS.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 14,
          borderBottom: `3px solid ${COLORS.danger}`,
        }}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Total deuda pendiente</div>
          <div style={{ color: COLORS.danger, fontSize: 26, fontWeight: 800, marginTop: 4 }}>{fmt(totalDeuda)}</div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>{deudores.length} cliente(s) con crédito pendiente</div>
        </div>
      )}

      {adding && (
        <FormBox>
          <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700 }}>Nuevo cliente</div>
          <Input placeholder="Nombre / Empresa" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Dirección de entrega" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
          <textarea
            placeholder="Anotaciones (horario, piso, referencias, etc.)"
            value={form.notas}
            onChange={e => setForm({ ...form, notas: e.target.value })}
            style={{
              background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
              color: COLORS.text, padding: "10px 14px", fontSize: 13,
              width: "100%", minHeight: 70, outline: "none", boxSizing: "border-box",
              resize: "vertical", lineHeight: 1.5, fontFamily: "system-ui",
            }}
          />
          <Btn onClick={save}>Guardar Cliente</Btn>
        </FormBox>
      )}

      {vista === "proximos" && proximosPedidos.length === 0 && (
        <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>
          Se necesitan al menos 2 compras por cliente para calcular próximos pedidos.
        </div>
      )}

      {vista === "proximos" ? proximosPedidos.map(c => (
        <div key={c.id} style={{
          background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 8,
          borderLeft: `3px solid ${c.diasRestantes <= 0 ? COLORS.danger : c.diasRestantes <= 3 ? COLORS.amber : COLORS.accent}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>{c.name}</div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>
              <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
                Marca frecuente: <MarcaDot marca={c.marcaMasComprada} />
              </div>
              <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
                Próximo pedido estimado: <span style={{ color: COLORS.text, fontWeight: 600 }}>{c.proximaFecha}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                color: c.diasRestantes <= 0 ? COLORS.danger : c.diasRestantes <= 3 ? COLORS.amber : COLORS.accent,
                fontWeight: 800, fontSize: 20,
              }}>
                {c.diasRestantes <= 0 ? "¡Hoy!" : `${c.diasRestantes}d`}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 10 }}>{c.diasRestantes <= 0 ? "puede pedir" : "para pedir"}</div>
            </div>
          </div>
        </div>
      )) : vista === "deudores" ? deudores.map(c => (
        <div key={c.id} style={{
          background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 8,
          borderLeft: `3px solid ${COLORS.danger}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>{c.name}</div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>📞 {c.phone}</div>
            </div>
            <div style={{ color: COLORS.danger, fontWeight: 800, fontSize: 18 }}>{fmt(c.deuda)}</div>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {c.ventasCredito.map((v, i) => (
              <div key={i} style={{
                background: COLORS.surfaceHigh, borderRadius: 8, padding: "8px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <MarcaDot marca={v.marca} />
                  <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 3 }}>
                    ×{v.qty} uds. · {v.date}
                  </div>
                </div>
                <span style={{ color: COLORS.danger, fontWeight: 700, fontSize: 13 }}>{fmt(v.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )) : clients.filter(c =>
        !busqueda.trim() ||
        c.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        (c.phone || "").includes(busqueda) ||
        (c.direccion || "").toLowerCase().includes(busqueda.toLowerCase())
      ).sort((a, b) => orden === "asc"
        ? a.name.localeCompare(b.name, "es")
        : b.name.localeCompare(a.name, "es")
      ).map(c => {
        const compras = sales.filter(s => s.client === c.name);
        const totalComprado = compras.reduce((a, s) => a + s.total, 0);
        const unidades = compras.reduce((a, s) => a + s.qty, 0);
        return (
          <div key={c.id} style={{ background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
            {editId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700 }}>Editando cliente</div>
                <Input placeholder="Nombre / Empresa" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                <Input placeholder="Teléfono" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                <Input placeholder="Dirección" value={editForm.direccion} onChange={e => setEditForm({ ...editForm, direccion: e.target.value })} />
                <textarea
                  placeholder="Anotaciones"
                  value={editForm.notas || ""}
                  onChange={e => setEditForm({ ...editForm, notas: e.target.value })}
                  style={{
                    background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
                    color: COLORS.text, padding: "10px 14px", fontSize: 13,
                    width: "100%", minHeight: 70, outline: "none", boxSizing: "border-box",
                    resize: "vertical", lineHeight: 1.5, fontFamily: "system-ui",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small onClick={() => saveEdit(c.id)}>Guardar</Btn>
                  <Btn small color={COLORS.surfaceHigh} onClick={() => setEditId(null)}>Cancelar</Btn>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>📞 {c.phone}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>
                    {c.notas && <div style={{ color: COLORS.amber, fontSize: 11, marginTop: 4 }}>📝 {c.notas}</div>}
                  </div>
                </div>
                {unidades > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                    <span style={{ color: COLORS.muted, fontSize: 11 }}>🛒 {unidades} uds. compradas</span>
                    <span style={{ color: COLORS.accent, fontSize: 11, fontWeight: 600 }}>{fmt(totalComprado)}</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn small color={COLORS.surfaceHigh} onClick={() => startEdit(c)}>✏️ Editar</Btn>
                  <Btn small danger onClick={() => deleteClient(c.id)}>Eliminar</Btn>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── Importador Telegram ──────────────────────────────────────────────────────
function Importer({ products, setProducts, clients, setClients, setSales }) {
  const [status, setStatus] = useState("idle"); // idle | preview | done | error
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [jsonText, setJsonText] = useState("");

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setJsonText(text);
      const { orders, errors } = parseTelegramJSON(text, products);
      setPreview(orders);
      setErrors(errors);
      setStatus(orders.length > 0 ? "preview" : "error");
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const newClients = [];
    const newSales = [];

    preview.forEach(order => {
      // Add client if not exists
      const exists = clients.find(c => c.name.toUpperCase() === order.clientName.toUpperCase());
      if (!exists) {
        newClients.push({ id: Date.now() + Math.random(), name: order.clientName, phone: "", direccion: order.direccion });
      }
      // Add sale
      newSales.push({
        id: Date.now() + Math.random(),
        client: order.clientName,
        marca: order.marca,
        qty: order.qty,
        unitPrice: order.unitPrice,
        total: order.total,
        pago: order.pago,
        vendedor: order.vendedor,
        date: order.date,
      });
      // Adjust stock
      setProducts(prev => prev.map(p => p.name === order.marca ? { ...p, stock: Math.max(0, p.stock - order.qty) } : p));
    });

    if (newClients.length > 0) setClients(prev => [...prev, ...newClients]);
    setSales(prev => [...prev, ...newSales]);
    setStatus("done");
    setPreview([]);
  };

  const reset = () => { setStatus("idle"); setPreview([]); setErrors([]); setJsonText(""); };

  return (
    <div>
      <SectionTitle>Importar desde Telegram</SectionTitle>
      <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
        Exporta tu chat de Telegram en formato JSON y súbelo aquí. Los pedidos se importarán automáticamente como ventas y clientes.
      </div>

      {status === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            background: COLORS.surface, borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>📋 Pega el contenido JSON</div>
            <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6 }}>
              1. Abre el archivo JSON exportado de Telegram con cualquier app de texto en tu celular{"\n"}
              2. Selecciona todo el texto (mantén presionado → Seleccionar todo){"\n"}
              3. Cópialo y pégalo aquí abajo
            </div>
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='Pega aquí el contenido del archivo JSON de Telegram...'
              style={{
                background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
                color: COLORS.text, padding: "12px 14px", fontSize: 13,
                width: "100%", minHeight: 140, outline: "none",
                boxSizing: "border-box", resize: "vertical", lineHeight: 1.5,
                fontFamily: "monospace",
              }}
            />
            <Btn onClick={() => {
              if (!jsonText.trim()) return;
              const { orders, errors } = parseTelegramJSON(jsonText, products);
              setPreview(orders);
              setErrors(errors);
              setStatus(orders.length > 0 ? "preview" : "error");
            }}>Procesar pedidos</Btn>
          </div>

          <div style={{
            background: COLORS.surface, borderRadius: 14, padding: 16,
            border: `2px dashed ${COLORS.surfaceHigh}`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>¿Prefieres subir el archivo?</div>
            <label style={{
              background: COLORS.surfaceHigh, color: COLORS.text, borderRadius: 10,
              padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              📂 Elegir archivo JSON
              <input type="file" accept=".json" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      )}

      {status === "preview" && (
        <div>
          <div style={{
            background: COLORS.surface, borderRadius: 12, padding: "12px 16px",
            marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: COLORS.accent, fontWeight: 700 }}>{preview.length} pedidos encontrados</span>
            <Btn small color={COLORS.surfaceHigh} onClick={reset}>Cancelar</Btn>
          </div>

          {errors.length > 0 && (
            <div style={{ background: COLORS.danger + "22", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ color: COLORS.danger, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>⚠️ {errors.length} mensaje(s) no reconocidos</div>
              {errors.map((e, i) => <div key={i} style={{ color: COLORS.muted, fontSize: 11 }}>{e}</div>)}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            {preview.map((o, i) => (
              <div key={i} style={{
                background: COLORS.surface, borderRadius: 12, padding: "12px 14px",
                marginBottom: 8, borderLeft: `3px solid ${getBrandColor(o.marca)}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <MarcaDot marca={o.marca} />
                    <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{o.clientName}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {o.direccion}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>×{o.qty} · {fmt(o.unitPrice)}/u · {o.date}</div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                      <span style={{
                        background: (PAGO_COLORS[o.pago] || COLORS.muted) + "22",
                        color: PAGO_COLORS[o.pago] || COLORS.muted,
                        borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                      }}>{o.pago}</span>
                      {o.vendedor && <span style={{ color: COLORS.muted, fontSize: 11 }}>Vendedor: {o.vendedor}</span>}
                    </div>
                  </div>
                  <span style={{ color: COLORS.accent, fontWeight: 700 }}>{fmt(o.total)}</span>
                </div>
              </div>
            ))}
          </div>

          <Btn onClick={handleImport}>✅ Importar {preview.length} pedidos</Btn>
        </div>
      )}

      {status === "done" && (
        <div style={{
          background: COLORS.surface, borderRadius: 14, padding: 24,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center",
        }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>¡Importación exitosa!</div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Los pedidos y clientes fueron registrados correctamente.</div>
          <Btn onClick={reset}>Importar otro archivo</Btn>
        </div>
      )}

      {status === "error" && (
        <div style={{
          background: COLORS.surface, borderRadius: 14, padding: 24,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center",
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ color: COLORS.danger, fontWeight: 700 }}>No se encontraron pedidos válidos</div>
          {errors.map((e, i) => <div key={i} style={{ color: COLORS.muted, fontSize: 12 }}>{e}</div>)}
          <Btn onClick={reset} color={COLORS.surfaceHigh}>Intentar de nuevo</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Envases Prestados ────────────────────────────────────────────────────────
function Envases({ envases, setEnvases, clients, products, setProducts }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ client: "", marca: "", qty: 1, notas: "", date: today() });
  const [clientSearch, setClientSearch] = useState("");
  const [showList, setShowList] = useState(false);

  const clientesFiltrados = clientSearch.trim()
    ? clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.direccion || "").toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  const save = () => {
    if (!form.client || !form.marca || form.qty < 1) return;
    setEnvases([...envases, { id: Date.now(), ...form, qty: +form.qty }]);
    // Descontar del stock
    setProducts(prev => prev.map(p => p.name === form.marca ? { ...p, stock: Math.max(0, p.stock - +form.qty) } : p));
    setForm({ client: "", marca: "", qty: 1, notas: "", date: today() });
    setClientSearch("");
    setAdding(false);
  };

  const recoger = (id) => {
    const envase = envases.find(e => e.id === id);
    if (envase) {
      // Reponer al stock
      setProducts(prev => prev.map(p => p.name === envase.marca ? { ...p, stock: p.stock + envase.qty } : p));
    }
    setEnvases(envases.filter(e => e.id !== id));
  };

  const totalPrestados = envases.reduce((a, e) => a + e.qty, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Envases Prestados</SectionTitle>
        <Btn small onClick={() => setAdding(!adding)}>{adding ? "Cancelar" : "+ Préstamo"}</Btn>
      </div>

      {/* Resumen */}
      <div style={{
        background: COLORS.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 14,
        borderBottom: `3px solid ${COLORS.amber}`,
      }}>
        <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Pendientes de recojo</div>
        <div style={{ color: COLORS.amber, fontSize: 28, fontWeight: 800, marginTop: 4 }}>{totalPrestados}</div>
        <div style={{ color: COLORS.muted, fontSize: 11 }}>{envases.length} cliente(s) con envases fuera</div>
      </div>

      {adding && (
        <FormBox>
          <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700 }}>Registrar préstamo</div>

          {/* Búsqueda cliente */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="🔍 Buscar cliente…"
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setShowList(true); setForm({ ...form, client: "" }); }}
              onFocus={() => setShowList(true)}
              style={{
                background: COLORS.surfaceHigh, border: `2px solid ${form.client ? COLORS.accent : "transparent"}`,
                borderRadius: 10, color: COLORS.text, padding: "10px 14px",
                fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box",
              }}
            />
            {form.client && (
              <div style={{ color: COLORS.accent, fontSize: 11, fontWeight: 600, marginTop: 4 }}>✓ {form.client}</div>
            )}
            {showList && clientSearch.trim() && !form.client && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                background: COLORS.surface, borderRadius: 10, marginTop: 4, maxHeight: 160, overflowY: "auto",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}>
                {clientesFiltrados.length === 0
                  ? <div style={{ color: COLORS.muted, padding: "12px 14px", fontSize: 13 }}>Sin resultados</div>
                  : clientesFiltrados.map(c => (
                    <div key={c.id} onClick={() => { setForm({ ...form, client: c.name }); setClientSearch(c.name); setShowList(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.surfaceHigh}` }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHigh}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      {c.direccion && <div style={{ color: COLORS.muted, fontSize: 11 }}>📍 {c.direccion}</div>}
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <Select value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })}>
            <option value="">Seleccionar marca del envase…</option>
            {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </Select>
          <div style={{ display: "flex", gap: 8 }}>
            <Input placeholder="Cantidad" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              style={{
                background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
                color: COLORS.text, padding: "10px 14px", fontSize: 14,
                flex: 1, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <textarea
            placeholder="Notas (motivo del préstamo, dónde dejarlo, etc.)"
            value={form.notas}
            onChange={e => setForm({ ...form, notas: e.target.value })}
            style={{
              background: COLORS.surfaceHigh, border: "none", borderRadius: 10,
              color: COLORS.text, padding: "10px 14px", fontSize: 13,
              width: "100%", minHeight: 60, outline: "none", boxSizing: "border-box",
              resize: "vertical", lineHeight: 1.5, fontFamily: "system-ui",
            }}
          />
          <Btn onClick={save}>Registrar Préstamo</Btn>
        </FormBox>
      )}

      {envases.length === 0 && !adding && (
        <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>
          No hay envases prestados pendientes 🎉
        </div>
      )}

      {[...envases].reverse().map(e => (
        <div key={e.id} style={{
          background: COLORS.surface, borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          borderLeft: `3px solid ${COLORS.amber}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>{e.client}</div>
              <div style={{ marginTop: 4 }}><MarcaDot marca={e.marca} /></div>
              <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>📅 {e.date}</div>
              {e.notas && <div style={{ color: COLORS.amber, fontSize: 11, marginTop: 3 }}>📝 {e.notas}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: COLORS.amber, fontWeight: 800, fontSize: 22 }}>{e.qty}</div>
              <div style={{ color: COLORS.muted, fontSize: 10 }}>envase(s)</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Btn small color={COLORS.accent} onClick={() => recoger(e.id)}>✓ Recogido</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const icons = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  inventory: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  sales: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  clients: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  envases: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3h8l2 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V7L8 3z"/><line x1="6" y1="7" x2="18" y2="7"/></svg>,
  importer: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

const tabs = [
  { id: "dashboard", label: "Inicio" },
  { id: "sales",     label: "Ventas" },
  { id: "inventory", label: "Stock" },
  { id: "clients",   label: "Clientes" },
  { id: "envases",   label: "Envases" },
  { id: "importer",  label: "Telegram" },
];

const APP_PASSWORD = "agua2024";

function LoginScreen({ onLogin }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);

  const attempt = () => {
    if (pwd === APP_PASSWORD) {
      onLogin();
    } else {
      setError(true);
      setPwd("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, maxWidth: 430, margin: "0 auto",
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💧</div>
      <div style={{ color: COLORS.accent, fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>AguaPro</div>
      <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 36 }}>Gestión de bidones</div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="password"
          placeholder="Contraseña"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === "Enter" && attempt()}
          style={{
            background: COLORS.surface,
            border: `2px solid ${error ? COLORS.danger : COLORS.surfaceHigh}`,
            borderRadius: 12, color: COLORS.text, padding: "14px 16px",
            fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box",
            textAlign: "center", letterSpacing: 4, transition: "border-color 0.2s",
          }}
        />
        {error && (
          <div style={{ color: COLORS.danger, fontSize: 13, textAlign: "center", fontWeight: 600 }}>
            Contraseña incorrecta
          </div>
        )}
        <button onClick={attempt} style={{
          background: COLORS.accent, color: "#0F1D35", border: "none",
          borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer",
        }}>Ingresar</button>
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState(initialProducts);
  const [clients,  setClients]  = useState(initialClients);
  const [sales,    setSales]    = useState(initialSales);
  const [envases,  setEnvases]  = useState([]);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const screens = {
    dashboard: <Dashboard sales={sales} products={products} />,
    inventory:  <Inventory products={products} setProducts={setProducts} sales={sales} envases={envases} />,
    sales:      <Sales sales={sales} setSales={setSales} products={products} setProducts={setProducts} clients={clients} />,
    clients:    <Clients clients={clients} setClients={setClients} sales={sales} />,
    envases:    <Envases envases={envases} setEnvases={setEnvases} clients={clients} products={products} setProducts={setProducts} />,
    importer:   <Importer products={products} setProducts={setProducts} clients={clients} setClients={setClients} setSales={setSales} />,
  };

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: COLORS.text, display: "flex", flexDirection: "column",
      maxWidth: 430, margin: "0 auto",
    }}>
      <div style={{
        background: COLORS.surface, padding: "16px 20px 12px",
        borderBottom: `1px solid ${COLORS.surfaceHigh}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>💧 AguaPro</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{tabs.find(t => t.id === tab)?.label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.accent }}>
            {icons[tab]}
          </div>
          <button onClick={() => setLoggedIn(false)} style={{
            background: COLORS.surfaceHigh, border: "none", borderRadius: 8,
            color: COLORS.muted, fontSize: 11, fontWeight: 600, padding: "6px 10px", cursor: "pointer",
          }}>Salir</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "4px 16px 90px", overflowY: "auto" }}>
        {screens[tab]}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: COLORS.surface, borderTop: `1px solid ${COLORS.surfaceHigh}`,
        display: "flex", padding: "8px 0 12px",
      }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: "none", border: "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              cursor: "pointer", color: active ? COLORS.accent : COLORS.muted, transition: "color 0.2s",
            }}>
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
