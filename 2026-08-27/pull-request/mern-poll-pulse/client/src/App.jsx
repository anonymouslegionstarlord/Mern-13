import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function futureLocalInput(days = 2) {
  const value = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

const initialForm = () => ({ question: "", description: "", createdBy: "", closesAt: futureLocalInput(), optionsText: "" });

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function pollState(poll) {
  return poll.status === "closed" || new Date(poll.closesAt).getTime() <= Date.now() ? "closed" : "open";
}

export default function App() {
  const [polls, setPolls] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, closed: 0, votes: 0 });
  const [form, setForm] = useState(initialForm);
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
        request(`/polls${search ? `?${search}` : ""}`),
        request("/polls/stats"),
      ]);
      setPolls(items);
      setStats(summary);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search]);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const options = form.optionsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      await request("/polls", {
        method: "POST",
        body: JSON.stringify({
          question: form.question,
          description: form.description,
          createdBy: form.createdBy,
          closesAt: new Date(form.closesAt).toISOString(),
          options,
        }),
      });
      setForm(initialForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function vote(pollId, optionId) {
    try {
      await request(`/polls/${pollId}/votes`, { method: "POST", body: JSON.stringify({ optionId }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function closePoll(pollId) {
    try {
      await request(`/polls/${pollId}/status`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function removePoll(poll) {
    if (!window.confirm(`Delete “${poll.question}”?`)) return;
    try {
      await request(`/polls/${poll._id}`, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Decide together</span><h1>PollPulse</h1><p>Turn “what do you think?” into a visible decision.</p></div>
        <div className="bars"><i></i><i></i><i></i></div>
      </header>

      <section className="stats" aria-label="Poll summary">
        <article><span>Total polls</span><strong>{stats.total}</strong></article>
        <article><span>Open</span><strong>{stats.open}</strong></article>
        <article><span>Closed</span><strong>{stats.closed}</strong></article>
        <article><span>Votes cast</span><strong>{stats.votes}</strong></article>
      </section>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New decision</span><h2>Create a poll</h2>
          <label>Question<input name="question" value={form.question} onChange={updateForm} minLength="5" maxLength="180" required /></label>
          <label>Description<textarea name="description" value={form.description} onChange={updateForm} rows="3" maxLength="500" /></label>
          <label>Options, one per line<textarea name="optionsText" value={form.optionsText} onChange={updateForm} rows="5" placeholder={'Option A\nOption B'} required /></label>
          <div className="twoCol"><label>Created by<input name="createdBy" value={form.createdBy} onChange={updateForm} maxLength="80" required /></label><label>Closes at<input name="closesAt" value={form.closesAt} onChange={updateForm} type="datetime-local" required /></label></div>
          <button className="primary" disabled={saving}>{saving ? "Creating..." : "Publish poll"}</button>
        </form>

        <section className="panel pollPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Decision board</span><h2>Polls</h2></div><strong>{polls.length}</strong></div>
          <div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search polls" aria-label="Search polls" /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Poll status"><option value="">All statuses</option><option>open</option><option>closed</option></select></div>
          {loading ? <p className="empty">Loading polls...</p> : polls.length === 0 ? <p className="empty">No polls match this view.</p> : (
            <div className="pollList">{polls.map((poll) => {
              const state = pollState(poll);
              const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
              return <article className="poll" key={poll._id}>
                <div className="pollTop"><div><strong>{poll.question}</strong><span>By {poll.createdBy} · closes {new Date(poll.closesAt).toLocaleString()}</span></div><span className={`badge ${state}`}>{state}</span></div>
                {poll.description && <p>{poll.description}</p>}
                <div className="options">{poll.options.map((option) => {
                  const percent = total ? Math.round(option.votes / total * 100) : 0;
                  return <button key={option._id} disabled={state === "closed"} onClick={() => vote(poll._id, option._id)}><span><b>{option.label}</b><em>{option.votes} · {percent}%</em></span><i style={{ width: `${percent}%` }}></i></button>;
                })}</div>
                <div className="actions"><span>{total} total votes</span>{state === "open" && <button onClick={() => closePoll(poll._id)}>Close poll</button>}<button className="delete" onClick={() => removePoll(poll)}>Delete</button></div>
              </article>;
            })}</div>
          )}
        </section>
      </section>
    </main>
  );
}

