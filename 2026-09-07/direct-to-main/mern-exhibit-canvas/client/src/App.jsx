import { useCallback, useEffect, useMemo, useState } from 'react';

const initialForm = {
  exhibitCode: '', title: '', galleryZone: '', curatorAlias: '', medium: 'painting',
  itemCount: 1, installationDate: '', openingDate: '', closingDate: '',
  accessibilityNotes: '', status: 'planned',
};
const statuses = { planned: 'Planned', installing: 'Installing', open: 'Open', closed: 'Closed' };
const media = ['painting', 'sculpture', 'photography', 'digital', 'mixed', 'other'];

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.details?.join(', ') || payload.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [exhibits, setExhibits] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, open: 0, installing: 0, upcoming: 0, items: 0 });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', status: '', medium: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const [list, summary] = await Promise.all([
        api(`/api/exhibits${query ? `?${query}` : ''}`),
        api('/api/exhibits/metrics'),
      ]);
      setExhibits(list);
      setMetrics(summary);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'itemCount' ? Number(value) : value }));
  }

  async function addExhibit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api('/api/exhibits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setForm(initialForm);
      await load();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  async function changeStatus(id, status) {
    setMessage('');
    try {
      await api(`/api/exhibits/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this exhibition plan?')) return;
    try {
      await api(`/api/exhibits/${id}`, { method: 'DELETE' });
      await load();
    } catch (error) { setMessage(error.message); }
  }

  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">Gallery operations</p><h1>ExhibitCanvas</h1><p>Shape every show from first installation to final closing.</p></div>
        <div className="monogram" aria-hidden="true">EC</div>
      </header>

      <section className="metrics" aria-label="Exhibition metrics">
        {[
          ['All plans', metrics.total], ['Open now', metrics.open], ['Installing', metrics.installing],
          ['Upcoming', metrics.upcoming], ['Items planned', metrics.items],
        ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
      </section>

      {message && <p className="error" role="alert">{message}</p>}

      <section className="workspace">
        <form className="panel form" onSubmit={addExhibit}>
          <div className="heading"><p className="eyebrow">New plan</p><h2>Prepare a show</h2></div>
          <label>Exhibit code<input required name="exhibitCode" maxLength="24" value={form.exhibitCode} onChange={updateForm} placeholder="AUTUMN-26" /></label>
          <label>Public title<input required name="title" minLength="3" maxLength="120" value={form.title} onChange={updateForm} /></label>
          <div className="pair">
            <label>Gallery zone<input required name="galleryZone" minLength="2" maxLength="60" value={form.galleryZone} onChange={updateForm} /></label>
            <label>Curator alias<input required name="curatorAlias" minLength="2" maxLength="60" value={form.curatorAlias} onChange={updateForm} /></label>
          </div>
          <div className="pair">
            <label>Medium<select name="medium" value={form.medium} onChange={updateForm}>{media.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Item count<input required type="number" min="1" max="10000" name="itemCount" value={form.itemCount} onChange={updateForm} /></label>
          </div>
          <label>Installation date<input required type="date" name="installationDate" value={form.installationDate} onChange={updateForm} /></label>
          <div className="pair">
            <label>Opening date<input required type="date" name="openingDate" value={form.openingDate} onChange={updateForm} /></label>
            <label>Closing date<input required type="date" name="closingDate" value={form.closingDate} onChange={updateForm} /></label>
          </div>
          <label>Accessibility notes<textarea required minLength="5" maxLength="300" name="accessibilityNotes" value={form.accessibilityNotes} onChange={updateForm} placeholder="Step-free route, captions, seating…" /></label>
          <button disabled={busy}>{busy ? 'Saving…' : 'Add exhibition'}</button>
        </form>

        <section className="panel board">
          <div className="heading"><p className="eyebrow">Programme</p><h2>Exhibition board</h2></div>
          <div className="filters">
            <input aria-label="Search exhibitions" placeholder="Search title, code, zone…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select aria-label="Filter by medium" value={filters.medium} onChange={(event) => setFilters({ ...filters, medium: event.target.value })}><option value="">All media</option>{media.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          {busy && !exhibits.length && <p className="empty">Loading exhibition plans…</p>}
          {!busy && !exhibits.length && <p className="empty">No exhibitions match this view.</p>}
          <div className="cards">
            {exhibits.map((exhibit) => (
              <article className="card" key={exhibit._id}>
                <div className="card-top"><span className={`badge ${exhibit.status}`}>{statuses[exhibit.status]}</span><code>{exhibit.exhibitCode}</code></div>
                <h3>{exhibit.title}</h3>
                <p className="meta">{exhibit.galleryZone} · {exhibit.medium} · {exhibit.itemCount} items</p>
                <p>{exhibit.accessibilityNotes}</p>
                <dl>
                  <div><dt>Install</dt><dd>{new Date(exhibit.installationDate).toLocaleDateString()}</dd></div>
                  <div><dt>Open</dt><dd>{new Date(exhibit.openingDate).toLocaleDateString()}</dd></div>
                  <div><dt>Close</dt><dd>{new Date(exhibit.closingDate).toLocaleDateString()}</dd></div>
                </dl>
                <div className="actions">
                  <select aria-label={`Status for ${exhibit.title}`} value={exhibit.status} onChange={(event) => changeStatus(exhibit._id, event.target.value)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <button className="danger" type="button" onClick={() => remove(exhibit._id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

