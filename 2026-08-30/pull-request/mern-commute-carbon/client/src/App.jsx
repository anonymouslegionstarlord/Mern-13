import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const modes = [
  ["car-petrol", "Petrol car"], ["car-diesel", "Diesel car"], ["motorbike", "Motorbike"],
  ["bus", "Bus"], ["metro", "Metro"], ["train", "Train"], ["bicycle", "Bicycle"], ["walk", "Walk"],
];
const labels = Object.fromEntries(modes);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function freshForm() {
  return { mode: "metro", distanceKm: "", passengers: "1", tripDate: today(), purpose: "", notes: "" };
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
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({ totalTrips: 0, totalDistance: 0, emissionsKg: 0, savingsKg: 0, reviewedTrips: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (mode) params.set("mode", mode);
    return params.toString();
  }, [query, mode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([
        request("/trips" + (search ? "?" + search : "")),
        request("/trips/stats"),
      ]);
      setTrips(rows);
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
      await request("/trips", {
        method: "POST",
        body: JSON.stringify({ ...form, distanceKm: Number(form.distanceKm), passengers: Number(form.passengers) }),
      });
      setForm(freshForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleReviewed(trip) {
    try {
      await request("/trips/" + trip._id, { method: "PATCH", body: JSON.stringify({ reviewed: !trip.reviewed }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(trip) {
    if (!window.confirm("Delete this " + labels[trip.mode] + " trip?")) return;
    try {
      await request("/trips/" + trip._id, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Travel with context</span><h1>CommuteCarbon</h1><p>See how everyday transport choices shape an emissions estimate.</p></div>
        <div className="globe" aria-hidden="true"><span>↗</span></div>
      </header>

      <section className="stats" aria-label="Commute summary">
        <article><span>Trips / reviewed</span><strong>{stats.totalTrips} / {stats.reviewedTrips}</strong></article>
        <article><span>Total distance</span><strong>{stats.totalDistance} km</strong></article>
        <article><span>Estimated emissions</span><strong>{stats.emissionsKg} kg</strong></article>
        <article><span>Vs petrol-car baseline</span><strong>{stats.savingsKg} kg saved</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="notice"><strong>Estimate only:</strong> factors are illustrative and can vary by vehicle, occupancy, energy mix, and methodology.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New journey</span><h2>Record a trip</h2>
          <label>Transport mode<select name="mode" value={form.mode} onChange={updateForm}>{modes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <div className="twoCol">
            <label>Distance (km)<input name="distanceKm" type="number" min="0.1" max="2000" step="0.1" value={form.distanceKm} onChange={updateForm} required /></label>
            <label>Travellers<input name="passengers" type="number" min="1" max="8" value={form.passengers} onChange={updateForm} required /></label>
          </div>
          <label>Trip date<input name="tripDate" type="date" max={today()} value={form.tripDate} onChange={updateForm} required /></label>
          <label>Purpose<input name="purpose" value={form.purpose} onChange={updateForm} minLength="2" maxLength="100" placeholder="Office commute" required /></label>
          <label>Notes<textarea name="notes" value={form.notes} onChange={updateForm} rows="3" maxLength="300" placeholder="Optional route or context" /></label>
          <button className="primary" disabled={saving}>{saving ? "Calculating..." : "Save trip estimate"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Trip ledger</span><h2>Recent journeys</h2></div><strong>{trips.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search purpose or notes" aria-label="Search trips" />
            <select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Transport mode"><option value="">All modes</option>{modes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          </div>
          {loading ? <p className="empty">Loading trips...</p> : trips.length === 0 ? <p className="empty">No trips match this view.</p> : (
            <div className="cards">{trips.map((trip) => (
              <article className={"card " + (trip.reviewed ? "reviewed" : "")} key={trip._id}>
                <div className="cardTop"><div><span className="mode">{labels[trip.mode]}</span><strong>{trip.purpose}</strong></div><span className={"badge " + (trip.reviewed ? "done" : "")}>{trip.reviewed ? "reviewed" : "draft"}</span></div>
                <dl><div><dt>Date</dt><dd>{displayDate(trip.tripDate)}</dd></div><div><dt>Distance</dt><dd>{trip.distanceKm} km</dd></div><div><dt>CO2e estimate</dt><dd>{trip.emissionsKg} kg</dd></div><div><dt>Estimated saving</dt><dd>{trip.savingsKg} kg</dd></div></dl>
                {trip.notes && <p>{trip.notes}</p>}
                <div className="actions"><button onClick={() => toggleReviewed(trip)}>{trip.reviewed ? "Return to draft" : "Mark reviewed"}</button><button className="delete" onClick={() => remove(trip)}>Delete</button></div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}

