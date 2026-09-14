import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const departments = ["General", "Dental", "Pediatrics", "Orthopedics", "Dermatology"];
const statuses = ["booked", "checked-in", "in-consultation", "completed", "cancelled", "no-show"];
const nextStatus = { booked: "checked-in", "checked-in": "in-consultation", "in-consultation": "completed" };
const emptyForm = { patientName: "", department: "General", appointmentTime: "", reason: "", priority: "routine" };

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function localDateTime(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function App() {
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ booked: 0, waiting: 0, consulting: 0, completed: 0 });
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (query.trim()) value.set("q", query.trim());
    if (status) value.set("status", status);
    if (department) value.set("department", department);
    return value.toString();
  }, [query, status, department]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [items, metrics] = await Promise.all([
        request(`/appointments${params ? `?${params}` : ""}`),
        request("/appointments/stats"),
      ]);
      setAppointments(items);
      setStats(metrics);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [params]);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/appointments", {
        method: "POST",
        body: JSON.stringify({ ...form, appointmentTime: new Date(form.appointmentTime).toISOString() }),
      });
      setForm(emptyForm);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function changeStatus(id, next) {
    try {
      await request(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function removeAppointment(item) {
    if (!window.confirm(`Delete ${item.patientName}'s appointment?`)) return;
    try {
      await request(`/appointments/${item._id}`, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Outpatient flow</span><h1>ClinicQ</h1><p>A calmer queue for reception, clinicians, and patients.</p></div>
        <div className="pulse"><span></span></div>
      </header>

      <section className="stats" aria-label="Queue metrics">
        <article><span>Booked</span><strong>{stats.booked}</strong></article>
        <article><span>Waiting</span><strong>{stats.waiting}</strong></article>
        <article><span>Consulting</span><strong>{stats.consulting}</strong></article>
        <article><span>Completed today</span><strong>{stats.completed}</strong></article>
      </section>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New arrival</span><h2>Book appointment</h2>
          <label>Patient name<input name="patientName" value={form.patientName} onChange={updateForm} maxLength="80" required /></label>
          <div className="twoCol">
            <label>Department<select name="department" value={form.department} onChange={updateForm}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Priority<select name="priority" value={form.priority} onChange={updateForm}><option>routine</option><option>urgent</option></select></label>
          </div>
          <label>Appointment time<input name="appointmentTime" value={form.appointmentTime} onChange={updateForm} type="datetime-local" required /></label>
          <label>Reason<textarea name="reason" value={form.reason} onChange={updateForm} maxLength="300" rows="4" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Booking..." : "Add to ClinicQ"}</button>
        </form>

        <section className="panel queue">
          <div className="sectionTitle"><div><span className="eyebrow">Live desk</span><h2>Appointment queue</h2></div><strong>{appointments.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or reason" aria-label="Search queue" />
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Department"><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          {loading ? <p className="empty">Loading the queue...</p> : appointments.length === 0 ? <p className="empty">No appointments match this view.</p> : (
            <div className="cards">
              {appointments.map((item) => (
                <article className={`appointment ${item.priority}`} key={item._id}>
                  <div className="appointmentTop"><div><strong>{item.patientName}</strong><span>{item.department} · {localDateTime(item.appointmentTime)}</span></div><span className={`badge ${item.status}`}>{item.status}</span></div>
                  <p>{item.reason}</p>
                  <div className="actions">
                    {nextStatus[item.status] && <button className="advance" onClick={() => changeStatus(item._id, nextStatus[item.status])}>{nextStatus[item.status].replaceAll("-", " ")}</button>}
                    {["booked", "checked-in"].includes(item.status) && <button onClick={() => changeStatus(item._id, "cancelled")}>Cancel</button>}
                    {item.status === "booked" && <button onClick={() => changeStatus(item._id, "no-show")}>No-show</button>}
                    <button className="delete" onClick={() => removeAppointment(item)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
