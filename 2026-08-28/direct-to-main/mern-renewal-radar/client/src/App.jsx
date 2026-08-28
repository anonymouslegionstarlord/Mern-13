import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const emptyForm = { name: "", category: "Software", amount: "", billingCycle: "monthly", nextRenewal: "", autoRenew: true, notes: "" };
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

export default function App() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({ active: 0, monthlyCost: 0, renewingSoon: 0, autoRenew: 0 });
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    return params.toString();
  }, [query, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [items, summary] = await Promise.all([
        request(`/subscriptions${search ? `?${search}` : ""}`),
        request("/subscriptions/stats"),
      ]);
      setSubscriptions(items);
      setStats(summary);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search]);

  function updateForm(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/subscriptions", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      setForm(emptyForm);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function setSubscriptionStatus(item, nextStatus) {
    try {
      await request(`/subscriptions/${item._id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function removeSubscription(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await request(`/subscriptions/${item._id}`, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero"><div><span className="eyebrow">Recurring spend</span><h1>RenewalRadar</h1><p>See every renewal before it becomes a surprise charge.</p></div><div className="radar"><i></i><span></span></div></header>
      <section className="stats" aria-label="Subscription summary">
        <article><span>Active</span><strong>{stats.active}</strong></article>
        <article><span>Monthly equivalent</span><strong>{money.format(stats.monthlyCost)}</strong></article>
        <article><span>Renewing in 30 days</span><strong>{stats.renewingSoon}</strong></article>
        <article><span>Auto-renew enabled</span><strong>{stats.autoRenew}</strong></article>
      </section>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New recurring charge</span><h2>Add subscription</h2>
          <label>Name<input name="name" value={form.name} onChange={updateForm} maxLength="100" required /></label>
          <div className="twoCol"><label>Category<input name="category" value={form.category} onChange={updateForm} maxLength="40" required /></label><label>Billing cycle<select name="billingCycle" value={form.billingCycle} onChange={updateForm}><option>weekly</option><option>monthly</option><option>quarterly</option><option>yearly</option></select></label></div>
          <div className="twoCol"><label>Amount<input name="amount" value={form.amount} onChange={updateForm} type="number" min="0.01" step="0.01" required /></label><label>Next renewal<input name="nextRenewal" value={form.nextRenewal} onChange={updateForm} type="date" required /></label></div>
          <label>Notes<textarea name="notes" value={form.notes} onChange={updateForm} rows="3" maxLength="300" /></label>
          <label className="check"><input name="autoRenew" checked={form.autoRenew} onChange={updateForm} type="checkbox" /> Auto-renew is enabled</label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Track subscription"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Renewal calendar</span><h2>Subscriptions</h2></div><strong>{subscriptions.length}</strong></div>
          <div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or category" aria-label="Search subscriptions" /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Subscription status"><option value="">All statuses</option><option>active</option><option>paused</option><option>cancelled</option></select></div>
          {loading ? <p className="empty">Loading subscriptions...</p> : subscriptions.length === 0 ? <p className="empty">No subscriptions match this view.</p> : (
            <div className="cards">{subscriptions.map((item) => <article className={`card ${item.status}`} key={item._id}>
              <div className="cardTop"><div><strong>{item.name}</strong><span>{item.category} · {item.billingCycle}</span></div><span className={`badge ${item.status}`}>{item.status}</span></div>
              <div className="cost"><strong>{money.format(item.amount)}</strong><span>Renews {new Date(item.nextRenewal).toLocaleDateString()} · {item.autoRenew ? "auto" : "manual"}</span></div>
              {item.notes && <p>{item.notes}</p>}
              <div className="actions">{item.status === "active" && <button onClick={() => setSubscriptionStatus(item, "paused")}>Pause</button>}{item.status === "paused" && <button onClick={() => setSubscriptionStatus(item, "active")}>Resume</button>}{item.status !== "cancelled" && <button onClick={() => setSubscriptionStatus(item, "cancelled")}>Cancel</button>}<button className="delete" onClick={() => removeSubscription(item)}>Delete</button></div>
            </article>)}</div>
          )}
        </section>
      </section>
    </main>
  );
}

