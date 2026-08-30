import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function freshForm() {
  return {
    intent: "offering",
    topic: "",
    level: "beginner",
    format: "online",
    availability: "",
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

export default function App() {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, offering: 0, seeking: 0, completed: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("");
  const [format, setFormat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (intent) params.set("intent", intent);
    if (format) params.set("format", format);
    params.set("status", "open");
    return params.toString();
  }, [query, intent, format]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([request("/posts?" + search), request("/posts/stats")]);
      setPosts(rows);
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
      await request("/posts", { method: "POST", body: JSON.stringify(form) });
      setForm(freshForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(post, status) {
    try {
      await request("/posts/" + post._id, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(post) {
    if (!window.confirm("Delete the " + post.topic + " post?")) return;
    try {
      await request("/posts/" + post._id, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Learn together</span><h1>MentorMesh</h1><p>Share what you know. Find the skill you want next.</p></div>
        <div className="mesh" aria-hidden="true"><span></span><span></span><span></span><i></i></div>
      </header>

      <section className="stats" aria-label="Skill exchange summary">
        <article><span>All posts</span><strong>{stats.total}</strong></article>
        <article><span>Open matches</span><strong>{stats.open}</strong></article>
        <article><span>Offering / seeking</span><strong>{stats.offering} / {stats.seeking}</strong></article>
        <article><span>Completed</span><strong>{stats.completed}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="safety"><strong>Safe coordination:</strong> use a community alias and exchange meeting details only through an approved channel.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New skill post</span><h2>Join the mesh</h2>
          <div className="toggle">
            <label><input type="radio" name="intent" value="offering" checked={form.intent === "offering"} onChange={updateForm} /> I can teach</label>
            <label><input type="radio" name="intent" value="seeking" checked={form.intent === "seeking"} onChange={updateForm} /> I want to learn</label>
          </div>
          <label>Skill or topic<input name="topic" value={form.topic} onChange={updateForm} minLength="2" maxLength="100" placeholder="React testing fundamentals" required /></label>
          <div className="twoCol">
            <label>Level<select name="level" value={form.level} onChange={updateForm}><option>beginner</option><option>intermediate</option><option>advanced</option></select></label>
            <label>Format<select name="format" value={form.format} onChange={updateForm}><option>online</option><option>in-person</option><option>hybrid</option></select></label>
          </div>
          <label>Availability<input name="availability" value={form.availability} onChange={updateForm} minLength="3" maxLength="120" placeholder="Weekends, 10:00-12:00" required /></label>
          <label>Contact alias<input name="contactAlias" value={form.contactAlias} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,60}" maxLength="60" placeholder="frontend-club-2" required /></label>
          <label>Details<textarea name="notes" value={form.notes} onChange={updateForm} minLength="10" maxLength="400" rows="4" placeholder="Goals, prerequisites, and what a useful session looks like" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Publishing..." : "Publish skill post"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Open exchanges</span><h2>Skill board</h2></div><strong>{posts.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topic, availability, details" aria-label="Search skill posts" />
            <select value={intent} onChange={(event) => setIntent(event.target.value)} aria-label="Learning intent"><option value="">Teach and learn</option><option>offering</option><option>seeking</option></select>
            <select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Meeting format"><option value="">All formats</option><option>online</option><option>in-person</option><option>hybrid</option></select>
          </div>
          {loading ? <p className="empty">Loading skill posts...</p> : posts.length === 0 ? <p className="empty">No open posts match this view.</p> : (
            <div className="cards">{posts.map((post) => (
              <article className={"card " + post.intent} key={post._id}>
                <div className="cardTop"><div><span className={"intent " + post.intent}>{post.intent === "offering" ? "Can teach" : "Wants to learn"}</span><strong>{post.topic}</strong></div><span className="level">{post.level}</span></div>
                <p>{post.notes}</p>
                <dl><div><dt>Format</dt><dd>{post.format}</dd></div><div><dt>Availability</dt><dd>{post.availability}</dd></div><div><dt>Contact</dt><dd>{post.contactAlias}</dd></div></dl>
                <div className="actions"><button onClick={() => updateStatus(post, "matched")}>Mark matched</button><button onClick={() => updateStatus(post, "completed")}>Complete</button><button className="delete" onClick={() => remove(post)}>Delete</button></div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}

