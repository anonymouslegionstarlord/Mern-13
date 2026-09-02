import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const shotTypes = ["wide", "medium", "close-up", "detail", "overhead", "other"];
const statuses = ["planned", "ready", "captured", "approved"];
const priorities = ["low", "medium", "high"];

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function freshForm() {
  return { shotCode: "", title: "", sceneLabel: "", shotType: "wide", locationType: "interior", durationSeconds: "10", scheduledDate: dateAfter(1), priority: "medium", notes: "" };
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

function displayRuntime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? minutes + "m " + remainder + "s" : remainder + "s";
}

export default function App() {
  const [shots, setShots] = useState([]);
  const [stats, setStats] = useState({ total: 0, ready: 0, captured: 0, approved: 0, highPriority: 0, plannedRuntimeSeconds: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [shotType, setShotType] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (shotType) params.set("shotType", shotType);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    return params.toString();
  }, [query, shotType, status, priority]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([request("/shots" + (search ? "?" + search : "")), request("/shots/stats")]);
      setShots(rows);
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
      await request("/shots", { method: "POST", body: JSON.stringify({ ...form, durationSeconds: Number(form.durationSeconds) }) });
      setForm(freshForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(shot, nextStatus) {
    try {
      await request("/shots/" + shot._id + "/status", { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(shot) {
    if (!window.confirm("Delete " + shot.shotCode + "?")) return;
    try {
      await request("/shots/" + shot._id, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero"><div><span className="eyebrow">From storyboard to approved take</span><h1>ShotStack</h1><p>A focused production board for planning, capturing, and approving visual shots.</p></div><div className="frameMark" aria-hidden="true"><span>REC</span></div></header>

      <section className="stats" aria-label="Production summary">
        <article><span>Total shots</span><strong>{stats.total}</strong></article>
        <article><span>Ready / captured</span><strong>{stats.ready} / {stats.captured}</strong></article>
        <article><span>Approved</span><strong>{stats.approved}</strong></article>
        <article><span>Open high priority</span><strong>{stats.highPriority}</strong></article>
        <article><span>Planned runtime</span><strong>{displayRuntime(stats.plannedRuntimeSeconds)}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New frame</span><h2>Plan a shot</h2>
          <div className="twoCol"><label>Shot code<input name="shotCode" value={form.shotCode} onChange={updateForm} pattern="[A-Za-z0-9-]{3,30}" maxLength="30" placeholder="SC03-WIDE" required /></label><label>Scene label<input name="sceneLabel" value={form.sceneLabel} onChange={updateForm} minLength="2" maxLength="60" placeholder="Scene 03" required /></label></div>
          <label>Shot title<input name="title" value={form.title} onChange={updateForm} minLength="3" maxLength="120" placeholder="Team enters the workshop" required /></label>
          <div className="threeCol"><label>Shot type<select name="shotType" value={form.shotType} onChange={updateForm}>{shotTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label>Location<select name="locationType" value={form.locationType} onChange={updateForm}><option>interior</option><option>exterior</option><option>studio</option></select></label><label>Priority<select name="priority" value={form.priority} onChange={updateForm}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <div className="twoCol"><label>Estimated seconds<input name="durationSeconds" type="number" min="1" max="3600" value={form.durationSeconds} onChange={updateForm} required /></label><label>Scheduled date<input name="scheduledDate" type="date" value={form.scheduledDate} onChange={updateForm} required /></label></div>
          <label>Direction notes<textarea name="notes" value={form.notes} onChange={updateForm} minLength="5" maxLength="400" rows="4" placeholder="Movement, framing, light, and continuity notes" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Add shot"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Production queue</span><h2>Shot list</h2></div><strong>{shots.length}</strong></div>
          <div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code, title, scene" aria-label="Search shots" /><select value={shotType} onChange={(event) => setShotType(event.target.value)} aria-label="Shot type"><option value="">All shot types</option>{shotTypes.map((value) => <option key={value}>{value}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Priority"><option value="">All priorities</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></div>
          {loading ? <p className="empty">Loading shots...</p> : shots.length === 0 ? <p className="empty">No shots match this view.</p> : <div className="cards">{shots.map((shot) => <article className={"card " + shot.status} key={shot._id}>
            <div className="cardTop"><div><span className="code">{shot.shotCode}</span><strong>{shot.title}</strong></div><span className={"badge " + shot.status}>{shot.status}</span></div>
            <p>{shot.notes}</p>
            <dl><div><dt>Scene</dt><dd>{shot.sceneLabel}</dd></div><div><dt>Frame</dt><dd>{shot.shotType} / {shot.locationType}</dd></div><div><dt>Schedule</dt><dd>{displayDate(shot.scheduledDate)}</dd></div><div><dt>Runtime</dt><dd>{displayRuntime(shot.durationSeconds)}</dd></div><div><dt>Priority</dt><dd className={"priority " + shot.priority}>{shot.priority}</dd></div></dl>
            <div className="actions"><select value={shot.status} onChange={(event) => updateStatus(shot, event.target.value)} aria-label={"Status for " + shot.shotCode}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="delete" onClick={() => remove(shot)}>Delete</button></div>
          </article>)}</div>}
        </section>
      </section>
    </main>
  );
}
