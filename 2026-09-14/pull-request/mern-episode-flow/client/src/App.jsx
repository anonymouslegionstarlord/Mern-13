import { useCallback, useEffect, useMemo, useState } from 'react';

const stages = ['pitch', 'scripting', 'recording', 'editing', 'scheduled', 'published'];
const formats = ['solo', 'interview', 'panel', 'narrative', 'news'];
const initialForm = {
  episodeCode: '', title: '', showAlias: '', ownerAlias: '', guestAlias: '',
  episodeNumber: 1, format: 'solo', stage: 'pitch', durationMinutes: 30,
  recordingDate: '', releaseDate: '', productionNote: '',
};

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.details?.join(', ') || data.error || 'Request failed (' + response.status + ')');
  }
  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [episodes, setEpisodes] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, active: 0, scheduled: 0, published: 0, minutes: 0 });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', stage: '', format: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const path = '/api/episodes' + (query ? '?' + query : '');
      const [items, summary] = await Promise.all([api(path), api('/api/episodes/metrics')]);
      setEpisodes(items);
      setMetrics(summary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  function updateForm(event) {
    const { name, value } = event.target;
    const numeric = ['episodeNumber', 'durationMinutes'].includes(name);
    setForm((current) => ({ ...current, [name]: numeric ? Number(value) : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm(initialForm);
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function changeStage(id, stage) {
    try {
      await api('/api/episodes/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this episode plan?')) return;
    try {
      await api('/api/episodes/' + id, { method: 'DELETE' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <main>
    <header>
      <div><p className="kicker">Podcast production</p><h1>EpisodeFlow</h1><p>Move every episode from pitch to publish with one calm production board.</p></div>
      <div className="mark">EF</div>
    </header>
    <section className="metrics">
      {[
        ['Episodes', metrics.total], ['In production', metrics.active],
        ['Scheduled', metrics.scheduled], ['Published', metrics.published],
        ['Planned minutes', metrics.minutes],
      ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="layout">
      <form className="panel form" onSubmit={submit}>
        <div><p className="kicker">New production</p><h2>Plan an episode</h2></div>
        <div className="pair">
          <label>Episode code<input required maxLength="24" name="episodeCode" value={form.episodeCode} onChange={updateForm} placeholder="SHOW-042" /></label>
          <label>Episode title<input required minLength="3" maxLength="120" name="title" value={form.title} onChange={updateForm} /></label>
        </div>
        <div className="pair">
          <label>Show alias<input required minLength="2" maxLength="70" name="showAlias" value={form.showAlias} onChange={updateForm} /></label>
          <label>Owner alias<input required minLength="2" maxLength="60" name="ownerAlias" value={form.ownerAlias} onChange={updateForm} /></label>
        </div>
        <div className="triple">
          <label>Episode no.<input required type="number" min="1" max="99999" name="episodeNumber" value={form.episodeNumber} onChange={updateForm} /></label>
          <label>Format<select name="format" value={form.format} onChange={updateForm}>{formats.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Minutes<input required type="number" min="1" max="480" name="durationMinutes" value={form.durationMinutes} onChange={updateForm} /></label>
        </div>
        <label>Guest alias (optional)<input maxLength="80" name="guestAlias" value={form.guestAlias} onChange={updateForm} /></label>
        <div className="pair">
          <label>Recording date<input required type="date" name="recordingDate" value={form.recordingDate} onChange={updateForm} /></label>
          <label>Release date<input required type="date" name="releaseDate" value={form.releaseDate} onChange={updateForm} /></label>
        </div>
        <label>Production note<textarea required minLength="8" maxLength="320" name="productionNote" value={form.productionNote} onChange={updateForm} placeholder="Research, audio, artwork, or publishing notes…" /></label>
        <button disabled={busy}>{busy ? 'Saving…' : 'Add episode'}</button>
      </form>
      <section className="panel board">
        <div><p className="kicker">Production queue</p><h2>Episode board</h2></div>
        <div className="filters">
          <input aria-label="Search episodes" placeholder="Search title, code, show…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <select aria-label="Filter stage" value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><option value="">All stages</option>{stages.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Filter format" value={filters.format} onChange={(event) => setFilters({ ...filters, format: event.target.value })}><option value="">All formats</option>{formats.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
        {busy && !episodes.length && <p className="empty">Loading episode plans…</p>}
        {!busy && !episodes.length && <p className="empty">No episodes match this view.</p>}
        <div className="cards">
          {episodes.map((episode) => <article className={'card ' + (episode.releaseOverdue ? 'late' : '')} key={episode._id}>
            <div className="card-top"><span className={'status ' + episode.stage}>{episode.stage}</span><code>{episode.episodeCode}</code></div>
            <h3>{episode.title}</h3>
            <p className="meta">#{episode.episodeNumber} · {episode.showAlias} · {episode.format} · {episode.durationMinutes} min</p>
            <p>{episode.productionNote}</p>
            {episode.guestAlias && <p className="guest">Guest: {episode.guestAlias}</p>}
            <div className="dates"><span>Record {new Date(episode.recordingDate).toLocaleDateString()}</span><span>Release {new Date(episode.releaseDate).toLocaleDateString()}</span></div>
            {episode.releaseOverdue && <p className="overdue">Release date has passed</p>}
            <div className="actions">
              <select aria-label={'Stage for ' + episode.title} value={episode.stage} onChange={(event) => changeStage(episode._id, event.target.value)}>{stages.map((value) => <option key={value}>{value}</option>)}</select>
              <button className="danger" type="button" onClick={() => remove(episode._id)}>Delete</button>
            </div>
          </article>)}
        </div>
      </section>
    </section>
  </main>;
}

