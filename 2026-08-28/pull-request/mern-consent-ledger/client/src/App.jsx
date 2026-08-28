import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function freshForm() {
  return {
    subjectRef: "",
    purpose: "",
    channel: "web",
    policyVersion: "v1.0",
    grantedAt: dateAfter(0),
    expiresAt: dateAfter(365),
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

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0, revoked: 0 });
  const [form, setForm] = useState(freshForm);
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
        request("/consents" + (search ? "?" + search : "")),
        request("/consents/stats"),
      ]);
      setRecords(items);
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
      await request("/consents", { method: "POST", body: JSON.stringify(form) });
      setForm(freshForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function revoke(record) {
    if (!window.confirm("Revoke consent for " + record.subjectRef + "?")) return;
    try {
      await request("/consents/" + record._id + "/revoke", { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(record) {
    if (!window.confirm("Permanently delete this consent record?")) return;
    try {
      await request("/consents/" + record._id, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Privacy operations</span><h1>ConsentLedger</h1><p>Keep consent decisions clear, current, and reviewable.</p></div>
        <div className="seal" aria-hidden="true"><span>✓</span></div>
      </header>

      <section className="stats" aria-label="Consent summary">
        <article><span>Total records</span><strong>{stats.total}</strong></article>
        <article><span>Active</span><strong>{stats.active}</strong></article>
        <article><span>Expiring in 30 days</span><strong>{stats.expiring}</strong></article>
        <article><span>Expired / revoked</span><strong>{stats.expired + stats.revoked}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="privacyNote"><strong>Privacy by design:</strong> use a pseudonymous subject reference, never a name or email address.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New decision</span><h2>Record consent</h2>
          <label>Subject reference<input name="subjectRef" value={form.subjectRef} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,64}" maxLength="64" placeholder="customer_2048" required /></label>
          <label>Purpose<input name="purpose" value={form.purpose} onChange={updateForm} minLength="3" maxLength="160" placeholder="Monthly product updates" required /></label>
          <div className="twoCol">
            <label>Channel<select name="channel" value={form.channel} onChange={updateForm}><option>web</option><option>mobile</option><option>email</option><option>in-person</option></select></label>
            <label>Policy version<input name="policyVersion" value={form.policyVersion} onChange={updateForm} maxLength="30" required /></label>
          </div>
          <div className="twoCol">
            <label>Granted on<input name="grantedAt" value={form.grantedAt} onChange={updateForm} type="date" required /></label>
            <label>Expires on<input name="expiresAt" value={form.expiresAt} onChange={updateForm} type="date" required /></label>
          </div>
          <label>Notes<textarea name="notes" value={form.notes} onChange={updateForm} rows="3" maxLength="300" /></label>
          <button className="primary" disabled={saving}>{saving ? "Recording..." : "Record consent"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Decision history</span><h2>Consent records</h2></div><strong>{records.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, purpose, policy" aria-label="Search consent records" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Consent status"><option value="">All statuses</option><option>active</option><option>expired</option><option>revoked</option></select>
          </div>
          {loading ? <p className="empty">Loading consent records...</p> : records.length === 0 ? <p className="empty">No consent records match this view.</p> : (
            <div className="records">{records.map((record) => (
              <article className={"record " + record.effectiveStatus} key={record._id}>
                <div className="recordTop"><div><strong>{record.subjectRef}</strong><span>{record.purpose}</span></div><span className={"badge " + record.effectiveStatus}>{record.effectiveStatus}</span></div>
                <dl><div><dt>Channel</dt><dd>{record.channel}</dd></div><div><dt>Policy</dt><dd>{record.policyVersion}</dd></div><div><dt>Granted</dt><dd>{formatDate(record.grantedAt)}</dd></div><div><dt>Expires</dt><dd>{formatDate(record.expiresAt)}</dd></div></dl>
                {record.notes && <p>{record.notes}</p>}
                <div className="actions">{record.effectiveStatus === "active" && <button onClick={() => revoke(record)}>Revoke</button>}<button className="delete" onClick={() => remove(record)}>Delete</button></div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}

