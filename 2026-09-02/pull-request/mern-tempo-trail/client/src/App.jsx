import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const genres = ["classical", "jazz", "rock", "pop", "folk", "film", "other"];
const statuses = ["learning", "polishing", "performance-ready", "archived"];

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function freshForm() {
  return { practiceCode: "", pieceName: "", instrument: "", genre: "classical", currentBpm: "60", targetBpm: "100", plannedMinutes: "30", nextPracticeDate: dateAfter(1), focusNotes: "" };
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
  const [pieces, setPieces] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, performanceReady: 0, due: 0, totalSessions: 0, averageTempoProgress: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (genre) params.set("genre", genre);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, genre, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([request("/pieces" + (search ? "?" + search : "")), request("/pieces/stats")]);
      setPieces(rows);
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
      const payload = { ...form, currentBpm: Number(form.currentBpm), targetBpm: Number(form.targetBpm), plannedMinutes: Number(form.plannedMinutes) };
      await request("/pieces", { method: "POST", body: JSON.stringify(payload) });
      setForm(freshForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(piece, nextStatus) {
    try {
      await request("/pieces/" + piece._id + "/status", { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function logPractice(piece) {
    try {
      await request("/pieces/" + piece._id + "/practice", { method: "POST", body: "{}" });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(piece) {
    if (!window.confirm("Delete " + piece.practiceCode + "?")) return;
    try {
      await request("/pieces/" + piece._id, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero"><div><span className="eyebrow">Practice with direction</span><h1>TempoTrail</h1><p>Move every piece from the first careful notes to performance tempo.</p></div><div className="tempoMark" aria-hidden="true"><i></i><i></i><i></i><i></i></div></header>
      <section className="stats" aria-label="Practice summary"><article><span>Active pieces</span><strong>{stats.active}</strong></article><article><span>Due today</span><strong>{stats.due}</strong></article><article><span>Performance-ready</span><strong>{stats.performanceReady}</strong></article><article><span>Sessions logged</span><strong>{stats.totalSessions}</strong></article><article><span>Average tempo</span><strong>{stats.averageTempoProgress}%</strong></article></section>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New repertoire item</span><h2>Add a piece</h2>
          <div className="twoCol"><label>Practice code<input name="practiceCode" value={form.practiceCode} onChange={updateForm} pattern="[A-Za-z0-9-]{3,30}" maxLength="30" placeholder="PNO-014" required /></label><label>Instrument<input name="instrument" value={form.instrument} onChange={updateForm} minLength="2" maxLength="60" placeholder="Piano" required /></label></div>
          <label>Piece name<input name="pieceName" value={form.pieceName} onChange={updateForm} minLength="2" maxLength="120" placeholder="Prelude in C" required /></label>
          <div className="threeCol"><label>Genre<select name="genre" value={form.genre} onChange={updateForm}>{genres.map((value) => <option key={value}>{value}</option>)}</select></label><label>Current BPM<input name="currentBpm" type="number" min="20" max="300" value={form.currentBpm} onChange={updateForm} required /></label><label>Target BPM<input name="targetBpm" type="number" min="20" max="300" value={form.targetBpm} onChange={updateForm} required /></label></div>
          <div className="twoCol"><label>Session minutes<input name="plannedMinutes" type="number" min="5" max="480" value={form.plannedMinutes} onChange={updateForm} required /></label><label>Next practice<input name="nextPracticeDate" type="date" value={form.nextPracticeDate} onChange={updateForm} required /></label></div>
          <label>Focus notes<textarea name="focusNotes" value={form.focusNotes} onChange={updateForm} minLength="5" maxLength="400" rows="4" placeholder="Bars, technique, rhythm, or expression to work on" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Add piece"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Repertoire</span><h2>Practice trail</h2></div><strong>{pieces.length}</strong></div>
          <div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search piece, instrument, notes" aria-label="Search pieces" /><select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Genre"><option value="">All genres</option>{genres.map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></div>
          {loading ? <p className="empty">Loading repertoire...</p> : pieces.length === 0 ? <p className="empty">No pieces match this view.</p> : <div className="cards">{pieces.map((piece) => {
            const progress = Math.min(100, Math.round(piece.currentBpm / piece.targetBpm * 100));
            return <article className={"card " + piece.status} key={piece._id}>
              <div className="cardTop"><div><span className="code">{piece.practiceCode}</span><strong>{piece.pieceName}</strong></div><span className={"badge " + piece.status}>{piece.status}</span></div>
              <p>{piece.focusNotes}</p>
              <div className="progressLabel"><span>{piece.currentBpm} → {piece.targetBpm} BPM</span><strong>{progress}%</strong></div><div className="progress"><i style={{ width: progress + "%" }}></i></div>
              <dl><div><dt>Instrument</dt><dd>{piece.instrument}</dd></div><div><dt>Genre</dt><dd>{piece.genre}</dd></div><div><dt>Next practice</dt><dd>{displayDate(piece.nextPracticeDate)}</dd></div><div><dt>Plan</dt><dd>{piece.plannedMinutes} min</dd></div><div><dt>Sessions</dt><dd>{piece.sessionsCompleted}</dd></div></dl>
              <div className="actions"><button onClick={() => logPractice(piece)}>+ Log session</button><select value={piece.status} onChange={(event) => updateStatus(piece, event.target.value)} aria-label={"Status for " + piece.practiceCode}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="delete" onClick={() => remove(piece)}>Delete</button></div>
            </article>;
          })}</div>}
        </section>
      </section>
    </main>
  );
}
