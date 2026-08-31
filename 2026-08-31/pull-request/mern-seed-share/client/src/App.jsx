import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const seedTypes = ["vegetable", "herb", "flower", "native", "fruit", "other"];
const currentYear = new Date().getFullYear();

function freshForm() {
  return { plantName: "", variety: "", seedType: "vegetable", quantityPackets: "1", harvestYear: String(currentYear), pickupArea: "", contactAlias: "", notes: "" };
}

async function request(path, options = {}) {
  const response = await fetch(API + path, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

export default function App() {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ total: 0, availableListings: 0, availablePackets: 0, reserved: 0, shared: 0 });
  const [form, setForm] = useState(freshForm);
  const [query, setQuery] = useState("");
  const [seedType, setSeedType] = useState("");
  const [status, setStatus] = useState("available");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (seedType) params.set("seedType", seedType);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, seedType, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([
        request("/listings" + (search ? "?" + search : "")),
        request("/listings/stats"),
      ]);
      setListings(rows);
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
      await request("/listings", {
        method: "POST",
        body: JSON.stringify({ ...form, quantityPackets: Number(form.quantityPackets), harvestYear: Number(form.harvestYear) }),
      });
      setForm(freshForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(listing, nextStatus) {
    try {
      await request("/listings/" + listing._id, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(listing) {
    if (!window.confirm("Delete the " + listing.plantName + " listing?")) return;
    try {
      await request("/listings/" + listing._id, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Grow and give</span><h1>SeedShare</h1><p>Help good seeds find another patch of soil.</p></div>
        <div className="sprout" aria-hidden="true"><i></i><span></span><b></b></div>
      </header>

      <section className="stats" aria-label="Seed exchange summary">
        <article><span>Total listings</span><strong>{stats.total}</strong></article>
        <article><span>Available listings</span><strong>{stats.availableListings}</strong></article>
        <article><span>Available packets</span><strong>{stats.availablePackets}</strong></article>
        <article><span>Reserved / shared</span><strong>{stats.reserved} / {stats.shared}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}
      <p className="notice"><strong>Share responsibly:</strong> label varieties accurately and check local restrictions before arranging an exchange.</p>

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New listing</span><h2>Offer seed packets</h2>
          <div className="twoCol">
            <label>Plant<input name="plantName" value={form.plantName} onChange={updateForm} minLength="2" maxLength="100" placeholder="Tomato" required /></label>
            <label>Variety<input name="variety" value={form.variety} onChange={updateForm} maxLength="80" placeholder="Cherry red" /></label>
          </div>
          <div className="twoCol">
            <label>Seed type<select name="seedType" value={form.seedType} onChange={updateForm}>{seedTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Packets<input name="quantityPackets" type="number" min="1" max="500" value={form.quantityPackets} onChange={updateForm} required /></label>
          </div>
          <label>Harvest year<input name="harvestYear" type="number" min={currentYear - 10} max={currentYear} value={form.harvestYear} onChange={updateForm} required /></label>
          <label>Pickup area<input name="pickupArea" value={form.pickupArea} onChange={updateForm} minLength="2" maxLength="100" placeholder="Central community garden" required /></label>
          <label>Contact alias<input name="contactAlias" value={form.contactAlias} onChange={updateForm} pattern="[A-Za-z0-9_-]{3,60}" maxLength="60" placeholder="garden-club-5" required /></label>
          <label>Growing notes<textarea name="notes" value={form.notes} onChange={updateForm} minLength="10" maxLength="400" rows="4" placeholder="Climate, germination, treatment, and storage details" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Publishing..." : "Publish listing"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Community seed box</span><h2>Seed listings</h2></div><strong>{listings.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plant, variety, area, notes" aria-label="Search seed listings" />
            <select value={seedType} onChange={(event) => setSeedType(event.target.value)} aria-label="Seed type"><option value="">All seed types</option>{seedTypes.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Listing status"><option value="">All statuses</option><option>available</option><option>reserved</option><option>shared</option></select>
          </div>
          {loading ? <p className="empty">Loading seed listings...</p> : listings.length === 0 ? <p className="empty">No listings match this view.</p> : (
            <div className="cards">{listings.map((listing) => (
              <article className={"card " + listing.status} key={listing._id}>
                <div className="cardTop"><div><span className="type">{listing.seedType}</span><strong>{listing.plantName}{listing.variety ? " · " + listing.variety : ""}</strong></div><span className={"badge " + listing.status}>{listing.status}</span></div>
                <p>{listing.notes}</p>
                <dl><div><dt>Packets</dt><dd>{listing.quantityPackets}</dd></div><div><dt>Harvest</dt><dd>{listing.harvestYear}</dd></div><div><dt>Pickup area</dt><dd>{listing.pickupArea}</dd></div><div><dt>Contact</dt><dd>{listing.contactAlias}</dd></div></dl>
                <div className="actions">
                  {listing.status === "available" && <button onClick={() => updateStatus(listing, "reserved")}>Reserve</button>}
                  {listing.status !== "shared" && <button onClick={() => updateStatus(listing, "shared")}>Mark shared</button>}
                  {listing.status !== "available" && <button onClick={() => updateStatus(listing, "available")}>Reopen</button>}
                  <button className="delete" onClick={() => remove(listing)}>Delete</button>
                </div>
              </article>
            ))}</div>
          )}
        </section>
      </section>
    </main>
  );
}

