import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const itemTypes = ["phone", "computer", "battery", "appliance", "cable", "peripheral", "other"];
const nextStatus = { requested: "scheduled", scheduled: "collected", collected: "recycled" };

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function freshForm() {
  return {
    itemType: "phone",
    quantity: "1",
    estimatedWeight: "",
    pickupArea: "",
    requestedDate: dateAfter(2),
    contactAlias: "",
    notes: "",
  };
}

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function App() {
  const [pickups, setPickups] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, collectedItems: 0, recycledItems: 0, divertedWeight: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [itemType, setItemType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (itemType) params.set("itemType", itemType);
    return params.toString();
  }, [query, status, itemType]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([
        request("/pickups" + (search ? "?" + search : "")),
        request("/pickups/stats"),
      ]);
      setPickups(rows);
      setStats(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      await request("/pickups", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          estimatedWeight: Number(form.estimatedWeight),
        }),
      });
      setForm(freshForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function advance(pickup) {
    const target = nextStatus[pickup.status];
    if (!target) return;
    try {
      await request("/pickups/" + pickup._id + "/advance", { method: "PATCH", body: JSON.stringify({ status: target }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(pickup) {
    if (!window.confirm("Delete this " + pickup.itemType + " pickup request?")) return;
    try {
      await request("/pickups/" + pickup._id, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Circular electronics</span><h1>RecycleRoute</h1><p>Move retired devices from request to responsible recycling.</p></div>
        <div className="orbit" aria-hidden="true"><span>↻</span></div>
      </header>

      <section className="stats" aria-label="E-waste summary">
        <article><span>Total requests</span><strong>{stats.total}</strong></article>
        <article><span>Pending pickups</span><strong>{stats.pending}</strong></article>
        <article><span>Collected / recycled</span><strong>{stats.collectedItems} / {stats.recycledItems}</strong></article>
        <article><span>Diverted weight</span><strong>{stats.divertedWeight} kg</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="privacy"><strong>Privacy reminder:</strong> enter only a broad pickup area and an internal contact alias.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New collection</span><h2>Request a pickup</h2>
          <div className="twoCol">
            <label>Item type<select name="itemType" value={form.itemType} onChange={updateForm}>{itemTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Quantity<input name="quantity" type="number" min="1" max="100" value={form.quantity} onChange={updateForm} required /></label>
          </div>
          <div className="twoCol">
            <label>Estimated weight (kg)<input name="estimatedWeight" type="number" min="0.1" max="500" step="0.1" value={form.estimatedWeight} onChange={updateForm} required /></label>
            <label>Preferred date<input name="requestedDate" type="date" min={dateAfter(0)} value={form.requestedDate} onChange={updateForm} required /></label>
          </div>
          <label>Pickup area<input name="pickupArea" value={form.pickupArea} onChange={updateForm} minLength="2" maxLength="100" placeholder="North campus collection point" required /></label>
          <label>Contact alias<input name="contactAlias" value={form.contactAlias} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,60}" maxLength="60" placeholder="green-team-3" required /></label>
          <label>Handling notes<textarea name="notes" value={form.notes} onChange={updateForm} rows="3" maxLength="300" placeholder="Battery removed, boxed, or unusually heavy" /></label>
          <button className="primary" disabled={saving}>{saving ? "Submitting..." : "Request pickup"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Collection pipeline</span><h2>Pickup requests</h2></div><strong>{pickups.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search area, alias, or notes" aria-label="Search pickups" />
            <select value={itemType} onChange={(event) => setItemType(event.target.value)} aria-label="Item type"><option value="">All item types</option>{itemTypes.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Pickup status"><option value="">All statuses</option><option>requested</option><option>scheduled</option><option>collected</option><option>recycled</option></select>
          </div>
          {loading ? <p className="empty">Loading pickup requests...</p> : pickups.length === 0 ? <p className="empty">No pickup requests match this view.</p> : (
            <div className="cards">{pickups.map((pickup) => (
              <article className={"card " + pickup.status} key={pickup._id}>
                <div className="cardTop"><div><span className="itemIcon">{pickup.itemType.slice(0, 1).toUpperCase()}</span><div><strong>{pickup.quantity} × {pickup.itemType}</strong><span>{pickup.pickupArea}</span></div></div><span className={"badge " + pickup.status}>{pickup.status}</span></div>
                <div className="progress" aria-label={"Status " + pickup.status}><i className={pickup.status}></i></div>
                <dl><div><dt>Weight</dt><dd>{pickup.estimatedWeight} kg</dd></div><div><dt>Preferred date</dt><dd>{displayDate(pickup.requestedDate)}</dd></div><div><dt>Contact</dt><dd>{pickup.contactAlias}</dd></div></dl>
                {pickup.notes && <p>{pickup.notes}</p>}
                <div className="actions">{nextStatus[pickup.status] && <button onClick={() => advance(pickup)}>Move to {nextStatus[pickup.status]}</button>}<button className="delete" onClick={() => remove(pickup)}>Delete</button></div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}

