import { useCallback, useEffect, useMemo, useState } from 'react';

const statuses = ['dirty', 'cleaning', 'inspection', 'ready', 'blocked'];
const priorities = ['standard', 'early-arrival', 'vip'];
const initialForm = {
  roomCode: '', zone: '', attendantAlias: '', priority: 'standard', status: 'dirty',
  checkoutTime: '', targetReadyTime: '', notes: '',
};

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.details?.join(', ') || data.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function showTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
  const [turns, setTurns] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, ready: 0, active: 0, blocked: 0, overdue: 0, averageTurnMinutes: 0 });
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
      const [items, summary] = await Promise.all([
        api(`/api/turns${query ? `?${query}` : ''}`), api('/api/turns/metrics'),
      ]);
      setTurns(items);
      setMetrics(summary);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/turns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setForm(initialForm);
      await load();
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  }

  async function changeStatus(id, status) {
    try {
      await api(`/api/turns/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this room turn?')) return;
    try { await api(`/api/turns/${id}`, { method: 'DELETE' }); await load(); }
    catch (requestError) { setError(requestError.message); }
  }

  return (
    <main>
      <header><div><p className="kicker">Housekeeping command</p><h1>TurnReady</h1><p>From checkout to inspection, every room has a visible next move.</p></div><div className="key" aria-hidden="true">TR</div></header>
      <section className="metrics">
        {[
          ['All turns', metrics.total], ['Ready', metrics.ready], ['In progress', metrics.active],
          ['Blocked', metrics.blocked], ['Overdue', metrics.overdue], ['Avg minutes', metrics.averageTurnMinutes],
        ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <div><p className="kicker">New turnover</p><h2>Queue a room</h2></div>
          <div className="pair"><label>Room code<input required maxLength="16" name="roomCode" value={form.roomCode} onChange={updateForm} placeholder="EAST-204" /></label><label>Floor / zone<input required minLength="2" maxLength="40" name="zone" value={form.zone} onChange={updateForm} /></label></div>
          <div className="pair"><label>Staff alias<input required minLength="2" maxLength="60" name="attendantAlias" value={form.attendantAlias} onChange={updateForm} /></label><label>Priority<select name="priority" value={form.priority} onChange={updateForm}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <label>Checkout time<input required type="datetime-local" name="checkoutTime" value={form.checkoutTime} onChange={updateForm} /></label>
          <label>Target ready time<input required type="datetime-local" name="targetReadyTime" value={form.targetReadyTime} onChange={updateForm} /></label>
          <label>Turn notes<textarea required minLength="4" maxLength="280" name="notes" value={form.notes} onChange={updateForm} placeholder="Linen needs, maintenance flags, inspection focus…" /></label>
          <button disabled={busy}>{busy ? 'Saving…' : 'Add room turn'}</button>
        </form>

        <section className="panel board">
          <div><p className="kicker">Live floor</p><h2>Turnaround board</h2></div>
          <div className="filters"><input aria-label="Search room turns" placeholder="Search room, zone, staff…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select aria-label="Filter status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter priority" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></div>
          {busy && !turns.length && <p className="empty">Loading room turns…</p>}
          {!busy && !turns.length && <p className="empty">No room turns match this view.</p>}
          <div className="cards">
            {turns.map((turn) => <article className={`card ${turn.overdue ? 'late' : ''}`} key={turn._id}>
              <div className="card-top"><span className={`status ${turn.status}`}>{turn.status}</span><span className={`priority ${turn.priority}`}>{turn.priority}</span></div>
              <h3>{turn.roomCode}</h3><p className="meta">{turn.zone} · {turn.attendantAlias}</p><p>{turn.notes}</p>
              <dl><div><dt>Checkout</dt><dd>{showTime(turn.checkoutTime)}</dd></div><div><dt>Target</dt><dd>{showTime(turn.targetReadyTime)}</dd></div></dl>
              {turn.overdue && <p className="overdue">Past target-ready time</p>}
              {turn.turnaroundMinutes !== null && <p className="duration">Completed in {turn.turnaroundMinutes} minutes</p>}
              <div className="actions"><select aria-label={`Status for ${turn.roomCode}`} value={turn.status} onChange={(event) => changeStatus(turn._id, event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button type="button" className="danger" onClick={() => remove(turn._id)}>Delete</button></div>
            </article>)}
          </div>
        </section>
      </section>
    </main>
  );
}

