import { useEffect, useState } from "react";

const categories = ["LAN", "WAN", "Wireless", "DNS", "VPN", "Firewall", "Other"];
const priorities = ["P1", "P2", "P3", "P4"];
const statuses = ["Open", "Investigating", "Monitoring", "Resolved", "Closed"];
const empty = { title: "", site: "", device: "", category: "LAN", priority: "P3", owner: "", symptoms: "" };

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(", ") || data.message || "Request failed");
  return data;
}

export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0, resolved: 0 });
  const [form, setForm] = useState(empty);
  const [filters, setFilters] = useState({ status: "", priority: "", category: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    try {
      const [items, totals] = await Promise.all([api(`/api/incidents${query ? `?${query}` : ""}`), api("/api/incidents/stats")]);
      setIncidents(items);
      setStats(totals);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.status, filters.priority, filters.category]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api("/api/incidents", { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const advance = async (incident) => {
    const index = statuses.indexOf(incident.status);
    const status = statuses[Math.min(index + 1, statuses.length - 1)];
    const resolution = ["Resolved", "Closed"].includes(status) ? window.prompt("Resolution notes:", incident.resolution || "Service restored and verified") : incident.resolution;
    if (["Resolved", "Closed"].includes(status) && !resolution) return;
    try {
      await api(`/api/incidents/${incident._id}`, { method: "PATCH", body: JSON.stringify({ status, resolution }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this incident?")) return;
    try {
      await api(`/api/incidents/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="shell">
      <header><span>NETWORK OPERATIONS</span><h1>NetOps Desk</h1><p>Track incidents from first alert to verified restoration.</p></header>

      <section className="stats">{Object.entries(stats).map(([label, value]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</section>

      <form className="incident-form" onSubmit={submit}>
        <input required minLength="5" placeholder="Incident title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input required placeholder="Site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
        <input required placeholder="Device or circuit" value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select>
        <input placeholder="Owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        <textarea required minLength="5" placeholder="Observed symptoms" value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} />
        <button>Open incident</button>
      </form>

      <section className="filters">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option value="">All priorities</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading incidents…</p> : <section className="grid">
        {incidents.map((incident) => <article key={incident._id}>
          <div className="meta"><span className={`priority ${incident.priority.toLowerCase()}`}>{incident.priority}</span><span>{incident.category} · {incident.site}</span></div>
          <h2>{incident.title}</h2><p className="device">{incident.device} · Owner: {incident.owner}</p><p>{incident.symptoms}</p>
          {incident.resolution && <p className="resolution"><b>Resolution:</b> {incident.resolution}</p>}
          <div className="actions"><span>{incident.status}</span><button disabled={incident.status === "Closed"} onClick={() => advance(incident)}>Advance</button><button className="delete" onClick={() => remove(incident._id)}>Delete</button></div>
        </article>)}
        {!incidents.length && <p>No incidents match these filters.</p>}
      </section>}
    </main>
  );
}

