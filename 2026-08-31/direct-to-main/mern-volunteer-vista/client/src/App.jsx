import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const causes = ["education", "environment", "health", "community", "animals", "other"];

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function freshForm() {
  return { title: "", cause: "education", activityDate: dateAfter(7), hours: "", participants: "1", organizerAlias: "", notes: "" };
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
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ total: 0, planned: 0, completed: 0, completedHours: 0, participantsReached: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [cause, setCause] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (cause) params.set("cause", cause);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, cause, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([
        request("/activities" + (search ? "?" + search : "")),
        request("/activities/stats"),
      ]);
      setActivities(rows);
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
      await request("/activities", {
        method: "POST",
        body: JSON.stringify({ ...form, hours: Number(form.hours), participants: Number(form.participants) }),
      });
      setForm(freshForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(activity, nextStatus) {
    try {
      await request("/activities/" + activity._id, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(activity) {
    if (!window.confirm("Delete " + activity.title + "?")) return;
    try {
      await request("/activities/" + activity._id, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Community effort</span><h1>VolunteerVista</h1><p>Plan the work, record the time, and see the shared impact.</p></div>
        <div className="sun" aria-hidden="true"><span>+</span></div>
      </header>

      <section className="stats" aria-label="Volunteer summary">
        <article><span>Activities</span><strong>{stats.total}</strong></article>
        <article><span>Planned / completed</span><strong>{stats.planned} / {stats.completed}</strong></article>
        <article><span>Completed hours</span><strong>{stats.completedHours}</strong></article>
        <article><span>Participant reach</span><strong>{stats.participantsReached}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="privacy"><strong>Privacy first:</strong> track team-level impact without storing volunteer or beneficiary identities.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New activity</span><h2>Plan community work</h2>
          <label>Activity title<input name="title" value={form.title} onChange={updateForm} minLength="3" maxLength="120" placeholder="Community garden cleanup" required /></label>
          <div className="twoCol">
            <label>Cause<select name="cause" value={form.cause} onChange={updateForm}>{causes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Date<input name="activityDate" type="date" value={form.activityDate} onChange={updateForm} required /></label>
          </div>
          <div className="twoCol">
            <label>Hours<input name="hours" type="number" min="0.5" max="1000" step="0.5" value={form.hours} onChange={updateForm} required /></label>
            <label>Participants<input name="participants" type="number" min="1" max="10000" value={form.participants} onChange={updateForm} required /></label>
          </div>
          <label>Organizer alias<input name="organizerAlias" value={form.organizerAlias} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,60}" maxLength="60" placeholder="green-team-4" required /></label>
          <label>Activity notes<textarea name="notes" value={form.notes} onChange={updateForm} minLength="10" maxLength="400" rows="4" placeholder="Goal, resources, meeting point, and expected outcome" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Add activity"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Impact log</span><h2>Volunteer activities</h2></div><strong>{activities.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, organizer, notes" aria-label="Search activities" />
            <select value={cause} onChange={(event) => setCause(event.target.value)} aria-label="Cause"><option value="">All causes</option>{causes.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">All statuses</option><option>planned</option><option>completed</option><option>cancelled</option></select>
          </div>
          {loading ? <p className="empty">Loading activities...</p> : activities.length === 0 ? <p className="empty">No activities match this view.</p> : (
            <div className="cards">{activities.map((activity) => (
              <article className={"card " + activity.status} key={activity._id}>
                <div className="cardTop"><div><span className="cause">{activity.cause}</span><strong>{activity.title}</strong></div><span className={"badge " + activity.status}>{activity.status}</span></div>
                <p>{activity.notes}</p>
                <dl><div><dt>Date</dt><dd>{displayDate(activity.activityDate)}</dd></div><div><dt>Hours</dt><dd>{activity.hours}</dd></div><div><dt>Participants</dt><dd>{activity.participants}</dd></div><div><dt>Organizer</dt><dd>{activity.organizerAlias}</dd></div></dl>
                <div className="actions">
                  {activity.status !== "completed" && <button onClick={() => updateStatus(activity, "completed")}>Mark completed</button>}
                  {activity.status === "planned" && <button onClick={() => updateStatus(activity, "cancelled")}>Cancel</button>}
                  {activity.status !== "planned" && <button onClick={() => updateStatus(activity, "planned")}>Reopen</button>}
                  <button className="delete" onClick={() => remove(activity)}>Delete</button>
                </div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}

