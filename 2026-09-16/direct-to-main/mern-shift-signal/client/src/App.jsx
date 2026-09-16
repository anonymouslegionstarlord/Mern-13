import { useCallback, useEffect, useMemo, useState } from 'react';

const statuses = ['open', 'acknowledged', 'resolved'];
const priorities = ['low', 'medium', 'high', 'critical'];
const categories = ['operations', 'customer', 'technical', 'safety', 'general'];
const shifts = ['morning', 'evening', 'night', 'weekend'];
const initialForm = {
  handoffCode: '', title: '', teamAlias: '', ownerAlias: '', fromShift: 'morning',
  priority: 'medium', category: 'operations', status: 'open',
  occurredAt: '', dueBy: '', summary: '',
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
  const [handoffs, setHandoffs] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, critical: 0, open: 0, acknowledged: 0, overdue: 0 });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
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
      const path = '/api/handoffs' + (query ? '?' + query : '');
      const [items, summary] = await Promise.all([api(path), api('/api/handoffs/metrics')]);
      setHandoffs(items);
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
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/handoffs', {
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

  async function changeStatus(id, status) {
    try {
      await api('/api/handoffs/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this handoff?')) return;
    try {
      await api('/api/handoffs/' + id, { method: 'DELETE' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <main>
    <header>
      <div><p className="kicker">Operational continuity</p><h1>ShiftSignal</h1><p>Turn scattered shift notes into owned, time-bound handoffs.</p></div>
      <div className="mark">SS</div>
    </header>
    <section className="metrics">
      {[
        ['Handoffs', metrics.total], ['Critical', metrics.critical], ['Open', metrics.open],
        ['Acknowledged', metrics.acknowledged], ['Overdue', metrics.overdue],
      ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="layout">
      <form className="panel form" onSubmit={submit}>
        <div><p className="kicker">New signal</p><h2>Record a handoff</h2></div>
        <div className="pair">
          <label>Handoff code<input required maxLength="24" name="handoffCode" value={form.handoffCode} onChange={updateForm} placeholder="OPS-104" /></label>
          <label>Title<input required minLength="3" maxLength="120" name="title" value={form.title} onChange={updateForm} /></label>
        </div>
        <div className="pair">
          <label>Team alias<input required minLength="2" maxLength="70" name="teamAlias" value={form.teamAlias} onChange={updateForm} /></label>
          <label>Owner alias<input required minLength="2" maxLength="60" name="ownerAlias" value={form.ownerAlias} onChange={updateForm} /></label>
        </div>
        <div className="triple">
          <label>From shift<select name="fromShift" value={form.fromShift} onChange={updateForm}>{shifts.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Priority<select name="priority" value={form.priority} onChange={updateForm}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Category<select name="category" value={form.category} onChange={updateForm}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="pair">
          <label>Occurred at<input required type="datetime-local" name="occurredAt" value={form.occurredAt} onChange={updateForm} /></label>
          <label>Due by<input required type="datetime-local" name="dueBy" value={form.dueBy} onChange={updateForm} /></label>
        </div>
        <label>Context and next action<textarea required minLength="10" maxLength="400" name="summary" value={form.summary} onChange={updateForm} placeholder="What happened, what was checked, and what must happen next…" /></label>
        <button disabled={busy}>{busy ? 'Saving…' : 'Add handoff'}</button>
      </form>
      <section className="panel board">
        <div><p className="kicker">Live queue</p><h2>Handoff board</h2></div>
        <div className="filters">
          <input aria-label="Search handoffs" placeholder="Search title, code, team…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <select aria-label="Filter status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Filter priority" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
        {busy && !handoffs.length && <p className="empty">Loading handoffs…</p>}
        {!busy && !handoffs.length && <p className="empty">No handoffs match this view.</p>}
        <div className="cards">{handoffs.map((handoff) => <article className={'card ' + (handoff.overdue ? 'late' : '')} key={handoff._id}>
          <div className="card-top"><span className={'priority ' + handoff.priority}>{handoff.priority}</span><code>{handoff.handoffCode}</code></div>
          <h3>{handoff.title}</h3>
          <p className="meta">{handoff.teamAlias} · {handoff.fromShift} shift · {handoff.category}</p>
          <p>{handoff.summary}</p>
          <div className="dates"><span>Owner {handoff.ownerAlias}</span><span>Due {new Date(handoff.dueBy).toLocaleString()}</span></div>
          {handoff.overdue && <p className="overdue">Action is overdue</p>}
          <div className="actions">
            <select aria-label={'Status for ' + handoff.title} value={handoff.status} onChange={(event) => changeStatus(handoff._id, event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
            <button className="danger" type="button" onClick={() => remove(handoff._id)}>Delete</button>
          </div>
        </article>)}</div>
      </section>
    </section>
  </main>;
}
