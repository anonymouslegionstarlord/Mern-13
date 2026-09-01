import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const statuses = ["label-created", "in-transit", "ready", "delivered", "exception"];

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function freshForm() {
  return { referenceAlias: "", carrier: "", direction: "incoming", expectedDate: dateAfter(3), destinationArea: "", notes: "" };
}

async function request(path, options = {}) {
  const response = await fetch(API + path, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function App() {
  const [parcels, setParcels] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, delivered: 0, exceptions: 0, overdue: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (direction) params.set("direction", direction);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, direction, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([
        request("/parcels" + (search ? "?" + search : "")),
        request("/parcels/stats"),
      ]);
      setParcels(rows);
      setStats(summary);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/parcels", { method: "POST", body: JSON.stringify(form) });
      setForm(freshForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(parcel, nextStatus) {
    try {
      await request("/parcels/" + parcel._id + "/status", { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(parcel) {
    if (!window.confirm("Delete " + parcel.referenceAlias + "?")) return;
    try {
      await request("/parcels/" + parcel._id, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Milestones, not surveillance</span><h1>ParcelPath</h1><p>Keep every delivery moving without storing sensitive tracking numbers.</p></div>
        <div className="routeMark" aria-hidden="true"><i></i><i></i><i></i></div>
      </header>

      <section className="stats" aria-label="Parcel summary">
        <article><span>Total parcels</span><strong>{stats.total}</strong></article>
        <article><span>Active / overdue</span><strong>{stats.active} / {stats.overdue}</strong></article>
        <article><span>Delivered</span><strong>{stats.delivered}</strong></article>
        <article><span>Exceptions</span><strong>{stats.exceptions}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="privacy"><strong>Privacy tip:</strong> use your own alias, such as <code>office-chair</code>. Do not paste a real tracking number or exact address.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New parcel</span><h2>Add a delivery</h2>
          <label>Reference alias<input name="referenceAlias" value={form.referenceAlias} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,60}" maxLength="60" placeholder="studio-lamp" required /></label>
          <div className="twoCol">
            <label>Carrier<input name="carrier" value={form.carrier} onChange={updateForm} minLength="2" maxLength="60" placeholder="Local courier" required /></label>
            <label>Direction<select name="direction" value={form.direction} onChange={updateForm}><option>incoming</option><option>outgoing</option></select></label>
          </div>
          <div className="twoCol">
            <label>Expected date<input name="expectedDate" type="date" value={form.expectedDate} onChange={updateForm} required /></label>
            <label>Broad destination area<input name="destinationArea" value={form.destinationArea} onChange={updateForm} minLength="2" maxLength="80" placeholder="North office" required /></label>
          </div>
          <label>Milestone notes<textarea name="notes" value={form.notes} onChange={updateForm} minLength="5" maxLength="300" rows="4" placeholder="Leave at reception after 10 AM" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Add parcel"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Route board</span><h2>Delivery milestones</h2></div><strong>{parcels.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alias, carrier, area" aria-label="Search parcels" />
            <select value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="Direction"><option value="">Both directions</option><option>incoming</option><option>outgoing</option></select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
          </div>
          {loading ? <p className="empty">Loading parcels...</p> : parcels.length === 0 ? <p className="empty">No parcels match this view.</p> : (
            <div className="cards">{parcels.map((parcel) => (
              <article className={"card " + parcel.status} key={parcel._id}>
                <div className="cardTop"><div><span className="direction">{parcel.direction}</span><strong>{parcel.referenceAlias}</strong></div><span className={"badge " + parcel.status}>{parcel.status}</span></div>
                <p>{parcel.notes}</p>
                <dl><div><dt>Carrier</dt><dd>{parcel.carrier}</dd></div><div><dt>Expected</dt><dd>{displayDate(parcel.expectedDate)}</dd></div><div><dt>Area</dt><dd>{parcel.destinationArea}</dd></div></dl>
                <div className="actions">
                  <select value={parcel.status} onChange={(event) => updateStatus(parcel, event.target.value)} aria-label={"Status for " + parcel.referenceAlias}>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
                  <button className="delete" onClick={() => remove(parcel)}>Delete</button>
                </div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}
