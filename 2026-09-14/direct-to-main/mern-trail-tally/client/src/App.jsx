import { useCallback, useEffect, useMemo, useState } from 'react';

const statuses = ['open', 'caution', 'maintenance', 'closed'];
const difficulties = ['easy', 'moderate', 'hard', 'expert'];
const surfaces = ['paved', 'gravel', 'earth', 'rock', 'mixed'];
const initialForm = {
  trailCode: '', name: '', region: '', inspectorAlias: '', distanceKm: 1,
  difficulty: 'easy', surface: 'earth', status: 'open', inspectedOn: '', reviewBy: '', conditionNote: '',
};

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.details?.join(', ') || data.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [trails, setTrails] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, caution: 0, unavailable: 0, overdue: 0, kilometres: 0 });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', status: '', difficulty: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [items, summary] = await Promise.all([api(`/api/trails${query ? `?${query}` : ''}`), api('/api/trails/metrics')]);
      setTrails(items); setMetrics(summary);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'distanceKm' ? Number(value) : value }));
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('/api/trails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setForm(initialForm); await load();
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  }

  async function changeStatus(id, status) {
    try {
      await api(`/api/trails/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this trail report?')) return;
    try { await api(`/api/trails/${id}`, { method: 'DELETE' }); await load(); }
    catch (requestError) { setError(requestError.message); }
  }

  return <main>
    <header><div><p className="kicker">Field conditions</p><h1>TrailTally</h1><p>One clear board for inspections, cautions, and the next review.</p></div><div className="mark">TT</div></header>
    <section className="metrics">{[
      ['Reports', metrics.total], ['Caution', metrics.caution], ['Unavailable', metrics.unavailable], ['Reviews due', metrics.overdue], ['Kilometres', metrics.kilometres],
    ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</section>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="layout">
      <form className="panel form" onSubmit={submit}>
        <div><p className="kicker">New inspection</p><h2>Record a trail</h2></div>
        <div className="pair"><label>Trail code<input required maxLength="20" name="trailCode" value={form.trailCode} onChange={updateForm} placeholder="RIDGE-07" /></label><label>Trail name<input required minLength="3" maxLength="100" name="name" value={form.name} onChange={updateForm} /></label></div>
        <div className="pair"><label>Region<input required minLength="2" maxLength="70" name="region" value={form.region} onChange={updateForm} /></label><label>Inspector alias<input required minLength="2" maxLength="60" name="inspectorAlias" value={form.inspectorAlias} onChange={updateForm} /></label></div>
        <div className="triple"><label>Distance km<input required type="number" min="0.1" max="500" step="0.1" name="distanceKm" value={form.distanceKm} onChange={updateForm} /></label><label>Difficulty<select name="difficulty" value={form.difficulty} onChange={updateForm}>{difficulties.map((value) => <option key={value}>{value}</option>)}</select></label><label>Surface<select name="surface" value={form.surface} onChange={updateForm}>{surfaces.map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <div className="pair"><label>Inspected on<input required type="date" name="inspectedOn" value={form.inspectedOn} onChange={updateForm} /></label><label>Review by<input required type="date" name="reviewBy" value={form.reviewBy} onChange={updateForm} /></label></div>
        <label>Condition note<textarea required minLength="8" maxLength="320" name="conditionNote" value={form.conditionNote} onChange={updateForm} placeholder="Surface, signage, drainage, or access observations…" /></label>
        <button disabled={busy}>{busy ? 'Saving…' : 'Add trail report'}</button>
      </form>
      <section className="panel board"><div><p className="kicker">Current network</p><h2>Condition board</h2></div>
        <div className="filters"><input aria-label="Search trails" placeholder="Search trail, code, region…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select aria-label="Filter status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter difficulty" value={filters.difficulty} onChange={(event) => setFilters({ ...filters, difficulty: event.target.value })}><option value="">All difficulty</option>{difficulties.map((value) => <option key={value}>{value}</option>)}</select></div>
        {busy && !trails.length && <p className="empty">Loading trail reports…</p>}{!busy && !trails.length && <p className="empty">No trails match this view.</p>}
        <div className="cards">{trails.map((trail) => <article className={`card ${trail.reviewOverdue ? 'late' : ''}`} key={trail._id}>
          <div className="card-top"><span className={`status ${trail.status}`}>{trail.status}</span><code>{trail.trailCode}</code></div><h3>{trail.name}</h3><p className="meta">{trail.region} · {trail.distanceKm} km · {trail.difficulty} · {trail.surface}</p><p>{trail.conditionNote}</p>
          <div className="dates"><span>Inspected {new Date(trail.inspectedOn).toLocaleDateString()}</span><span>Review {new Date(trail.reviewBy).toLocaleDateString()}</span></div>{trail.reviewOverdue && <p className="overdue">Review is overdue</p>}
          <div className="actions"><select aria-label={`Status for ${trail.name}`} value={trail.status} onChange={(event) => changeStatus(trail._id, event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="danger" type="button" onClick={() => remove(trail._id)}>Delete</button></div>
        </article>)}</div>
      </section>
    </section>
  </main>;
}
