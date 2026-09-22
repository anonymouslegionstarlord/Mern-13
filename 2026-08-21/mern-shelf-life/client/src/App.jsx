import { useEffect, useState } from "react";

const categories = ["Produce", "Dairy", "Grains", "Snacks", "Frozen", "Other"];
const units = ["item", "g", "kg", "ml", "l", "pack"];
const blank = { name: "", category: "Produce", quantity: 1, unit: "item", location: "Pantry", purchaseDate: "", expiryDate: "" };

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(", ") || data.message || "Request failed");
  return data;
}

export default function App() {
  const [items, setItems] = useState([]); const [stats, setStats] = useState({});
  const [form, setForm] = useState(blank); const [filters, setFilters] = useState({ status: "", category: "", search: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
      const [list, totals] = await Promise.all([api(`/api/items${query ? `?${query}` : ""}`), api("/api/items/stats")]);
      setItems(list); setStats(totals); setError("");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [filters.status, filters.category, filters.search]);
  const submit = async (event) => {
    event.preventDefault();
    try { await api("/api/items", { method: "POST", body: JSON.stringify(form) }); setForm(blank); await load(); }
    catch (err) { setError(err.message); }
  };
  const change = async (id, changes) => {
    try { await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(changes) }); await load(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this pantry item?")) return;
    try { await api(`/api/items/${id}`, { method: "DELETE" }); await load(); } catch (err) { setError(err.message); }
  };
  const days = (date) => Math.ceil((new Date(date) - new Date()) / 86400000);
  return <main className="shell">
    <header><p className="eyebrow">PANTRY INTELLIGENCE</p><h1>Shelf<span>Life</span></h1><p>Buy thoughtfully. Use food on time. Waste less.</p></header>
    <section className="stats">{["available", "expiringSoon", "expired", "consumed"].map(key => <article key={key}><b>{stats[key] || 0}</b><small>{key.replace(/([A-Z])/g, " $1")}</small></article>)}</section>
    <form onSubmit={submit} className="form">
      <input required minLength="2" maxLength="80" placeholder="Item name" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
      <select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>{categories.map(x => <option key={x}>{x}</option>)}</select>
      <input required type="number" min="0.01" max="10000" step="0.01" value={form.quantity} onChange={e => setForm({...form, quantity:Number(e.target.value)})}/>
      <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})}>{units.map(x => <option key={x}>{x}</option>)}</select>
      <select value={form.location} onChange={e => setForm({...form, location:e.target.value})}>{["Pantry","Fridge","Freezer"].map(x => <option key={x}>{x}</option>)}</select>
      <label>Purchased<input type="date" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate:e.target.value})}/></label>
      <label>Expires<input required type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate:e.target.value})}/></label>
      <button>Add item</button>
    </form>
    <div className="filters"><input placeholder="Search pantry" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/><select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option><option value="available">Available</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option><option value="consumed">Consumed</option></select><select value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">All categories</option>{categories.map(x=><option key={x}>{x}</option>)}</select></div>
    {error && <p role="alert" className="error">{error}</p>}
    {loading ? <p>Checking the pantry…</p> : <section className="grid">{items.map(item => { const left=days(item.expiryDate); return <article className={`card ${item.consumed ? "done" : ""}`} key={item._id}><div><span className="tag">{item.category}</span><span className={left < 0 ? "late" : left <= 7 ? "soon" : "fresh"}>{item.consumed ? "Consumed" : left < 0 ? `${Math.abs(left)}d overdue` : `${left}d left`}</span></div><h2>{item.name}</h2><p>{item.quantity} {item.unit} · {item.location}</p><footer><button onClick={()=>change(item._id,{consumed:!item.consumed})}>{item.consumed ? "Restore" : "Consume"}</button><button className="delete" onClick={()=>remove(item._id)}>Delete</button></footer></article>})}{!items.length && <p>No pantry items match.</p>}</section>}
  </main>;
}

