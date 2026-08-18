import { useEffect, useState } from "react";

const severities = ["Low", "Medium", "High", "Critical"];
const statuses = ["Open", "In Progress", "Ready for Retest", "Resolved", "Closed"];
const blank = { title: "", module: "", severity: "Medium", steps: "", expected: "", actual: "" };

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(", ") || data.message || "Request failed");
  return data;
}

export default function App() {
  const [defects, setDefects] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, critical: 0, resolved: 0 });
  const [form, setForm] = useState(blank);
  const [filters, setFilters] = useState({ status: "", severity: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    try {
      const [items, totals] = await Promise.all([api(`/api/defects${query ? `?${query}` : ""}`), api("/api/defects/stats")]);
      setDefects(items);
      setStats(totals);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.status, filters.severity]);

  const submit = async (event) => {
    event.preventDefault();
    const steps = form.steps.split("\n").map((step) => step.trim()).filter(Boolean);
    try {
      await api("/api/defects", { method: "POST", body: JSON.stringify({ ...form, steps }) });
      setForm(blank);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api(`/api/defects/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this defect?")) return;
    try {
      await api(`/api/defects/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="shell">
      <header><span>QA WORKSPACE</span><h1>BugBoard</h1><p>Capture clearly. Prioritize quickly. Verify confidently.</p></header>

      <section className="stats">
        {Object.entries(stats).map(([label, value]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}
      </section>

      <form className="defect-form" onSubmit={submit}>
        <input required minLength="5" placeholder="Defect title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input required minLength="2" placeholder="Module" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
        <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{severities.map((item) => <option key={item}>{item}</option>)}</select>
        <textarea required placeholder="Reproduction steps, one per line" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} />
        <textarea required placeholder="Expected result" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} />
        <textarea required placeholder="Actual result" value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} />
        <button>Log defect</button>
      </form>

      <div className="toolbar">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}><option value="">All severities</option>{severities.map((item) => <option key={item}>{item}</option>)}</select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading defects…</p> : <section className="grid">
        {defects.map((defect) => <article key={defect._id}>
          <div className="meta"><span className={`severity ${defect.severity.toLowerCase()}`}>{defect.severity}</span><span>{defect.module}</span></div>
          <h2>{defect.title}</h2>
          <details><summary>Reproduction details</summary><ol>{defect.steps.map((step) => <li key={step}>{step}</li>)}</ol><p><b>Expected:</b> {defect.expected}</p><p><b>Actual:</b> {defect.actual}</p></details>
          <div className="actions"><select value={defect.status} onChange={(e) => setStatus(defect._id, e.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => remove(defect._id)}>Delete</button></div>
        </article>)}
        {!defects.length && <p>No defects match the filters.</p>}
      </section>}
    </main>
  );
}

