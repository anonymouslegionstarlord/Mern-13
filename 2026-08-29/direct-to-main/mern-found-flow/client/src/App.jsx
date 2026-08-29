import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const categories = ["electronics", "clothing", "documents", "keys", "bags", "accessories", "other"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function freshForm() {
  return {
    kind: "lost",
    title: "",
    category: "electronics",
    location: "",
    eventDate: today(),
    description: "",
    contactAlias: "",
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
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, lost: 0, found: 0, returned: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("open");
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (kind) params.set("kind", kind);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, kind, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([
        request("/items" + (search ? "?" + search : "")),
        request("/items/stats"),
      ]);
      setItems(rows);
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
      await request("/items", { method: "POST", body: JSON.stringify(form) });
      setForm(freshForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item, nextStatus) {
    try {
      await request("/items/" + item._id, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function findMatches(item) {
    setError("");
    try {
      const suggestions = await request("/items/" + item._id + "/matches");
      setMatches({ item, suggestions });
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm("Delete the report for " + item.title + "?")) return;
    try {
      await request("/items/" + item._id, { method: "DELETE" });
      if (matches?.item._id === item._id) setMatches(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Lost meets found</span><h1>FoundFlow</h1><p>Turn scattered reports into clear, useful matches.</p></div>
        <div className="mark" aria-hidden="true"><span>?</span><i>✓</i></div>
      </header>

      <section className="stats" aria-label="Lost and found summary">
        <article><span>All reports</span><strong>{stats.total}</strong></article>
        <article><span>Open reports</span><strong>{stats.open}</strong></article>
        <article><span>Lost / found</span><strong>{stats.lost} / {stats.found}</strong></article>
        <article><span>Returned</span><strong>{stats.returned}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="safety"><strong>Safe contact:</strong> use a desk, team, or platform alias rather than personal contact information.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">Create a report</span><h2>Describe the item</h2>
          <div className="toggle">
            <label><input type="radio" name="kind" value="lost" checked={form.kind === "lost"} onChange={updateForm} /> I lost it</label>
            <label><input type="radio" name="kind" value="found" checked={form.kind === "found"} onChange={updateForm} /> I found it</label>
          </div>
          <label>Item title<input name="title" value={form.title} onChange={updateForm} minLength="3" maxLength="100" placeholder="Black wireless earbuds" required /></label>
          <div className="twoCol">
            <label>Category<select name="category" value={form.category} onChange={updateForm}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Date<input name="eventDate" type="date" value={form.eventDate} onChange={updateForm} max={today()} required /></label>
          </div>
          <label>Location<input name="location" value={form.location} onChange={updateForm} minLength="2" maxLength="100" placeholder="Library second floor" required /></label>
          <label>Description<textarea name="description" value={form.description} onChange={updateForm} minLength="10" maxLength="500" rows="4" placeholder="Color, identifying marks, and where it was last seen" required /></label>
          <label>Contact alias<input name="contactAlias" value={form.contactAlias} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,60}" maxLength="60" placeholder="front-desk-2" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Publishing..." : "Publish report"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Community board</span><h2>Item reports</h2></div><strong>{items.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, location, description" aria-label="Search item reports" />
            <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Report type"><option value="">Lost and found</option><option>lost</option><option>found</option></select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Report status"><option value="">All statuses</option><option>open</option><option>matched</option><option>returned</option></select>
          </div>
          {loading ? <p className="empty">Loading reports...</p> : items.length === 0 ? <p className="empty">No reports match this view.</p> : (
            <div className="cards">{items.map((item) => (
              <article className={"card " + item.kind} key={item._id}>
                <div className="cardTop"><div><span className={"kind " + item.kind}>{item.kind}</span><strong>{item.title}</strong></div><span className={"badge " + item.status}>{item.status}</span></div>
                <p>{item.description}</p>
                <dl><div><dt>Category</dt><dd>{item.category}</dd></div><div><dt>Location</dt><dd>{item.location}</dd></div><div><dt>Date</dt><dd>{displayDate(item.eventDate)}</dd></div><div><dt>Contact</dt><dd>{item.contactAlias}</dd></div></dl>
                <div className="actions">
                  {item.status === "open" && <button onClick={() => findMatches(item)}>Find matches</button>}
                  {item.status === "open" && <button onClick={() => updateStatus(item, "matched")}>Mark matched</button>}
                  {item.status === "matched" && <button onClick={() => updateStatus(item, "returned")}>Mark returned</button>}
                  {item.status !== "open" && <button onClick={() => updateStatus(item, "open")}>Reopen</button>}
                  <button className="delete" onClick={() => remove(item)}>Delete</button>
                </div>
              </article>
            ))}</div>
          )}
        </section>
      </section>

      {matches && <div className="modalBackdrop" onMouseDown={() => setMatches(null)}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="match-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="close" aria-label="Close suggestions" onClick={() => setMatches(null)}>×</button>
          <span className="eyebrow">Potential connections</span><h2 id="match-title">Matches for {matches.item.title}</h2>
          {matches.suggestions.length === 0 ? <p className="empty">No likely opposite report yet. Check again later.</p> : matches.suggestions.map((suggestion) => (
            <article className="suggestion" key={suggestion._id}><div><strong>{suggestion.title}</strong><span>{suggestion.location} · {displayDate(suggestion.eventDate)}</span></div><b>{suggestion.matchScore} pts</b></article>
          ))}
        </section>
      </div>}
    </main>
  );
}

