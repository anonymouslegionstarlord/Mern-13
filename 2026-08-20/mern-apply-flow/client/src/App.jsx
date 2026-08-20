import { useEffect, useState } from "react";

const statuses = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
const sources = ["Company Website", "LinkedIn", "Naukri", "Referral", "Campus", "Other"];
const empty = { company: "", role: "", location: "", source: "Company Website", status: "Applied", nextActionAt: "", notes: "" };

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(", ") || data.message || "Request failed");
  return data;
}

export default function App() {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, interviews: 0, offers: 0, overdue: 0 });
  const [form, setForm] = useState(empty);
  const [status, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const query = new URLSearchParams(Object.entries({ status, search }).filter(([, value]) => value)).toString();
    try {
      const [items, totals] = await Promise.all([api(`/api/applications${query ? `?${query}` : ""}`), api("/api/applications/stats")]);
      setApplications(items);
      setStats(totals);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [status, search]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api("/api/applications", { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async (id, value) => {
    try {
      await api(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this application?")) return;
    try {
      await api(`/api/applications/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="shell">
      <header><span>CAREER PIPELINE</span><h1>ApplyFlow</h1><p>Keep every application, interview, and follow-up moving.</p></header>
      <section className="stats">{Object.entries(stats).map(([label, value]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</section>

      <form className="application-form" onSubmit={submit}>
        <input required minLength="2" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <input required minLength="2" placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{sources.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <input type="datetime-local" aria-label="Next action date" value={form.nextActionAt} onChange={(e) => setForm({ ...form, nextActionAt: e.target.value })} />
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button>Add application</button>
      </form>

      <section className="toolbar"><input placeholder="Search company, role, location" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={status} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></section>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading applications…</p> : <section className="grid">
        {applications.map((item) => <article key={item._id}>
          <div className="meta"><span>{item.source}</span><span>{item.location}</span></div><h2>{item.role}</h2><h3>{item.company}</h3>
          {item.notes && <p>{item.notes}</p>}
          <p className="followup">{item.nextActionAt ? `Next action: ${new Date(item.nextActionAt).toLocaleString()}` : "No follow-up scheduled"}</p>
          <div className="actions"><select value={item.status} onChange={(e) => updateStatus(item._id, e.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button onClick={() => remove(item._id)}>Delete</button></div>
        </article>)}
        {!applications.length && <p>No applications match the current filters.</p>}
      </section>}
    </main>
  );
}

