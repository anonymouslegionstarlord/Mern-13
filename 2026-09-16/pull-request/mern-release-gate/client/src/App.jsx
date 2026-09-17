import { useCallback, useEffect, useMemo, useState } from 'react';

const statuses = ['not-started', 'running', 'passed', 'failed', 'waived'];
const severities = ['blocker', 'high', 'medium', 'low'];
const types = ['regression', 'security', 'performance', 'accessibility', 'documentation', 'deployment'];
const initialForm = {
  gateCode: '', title: '', releaseName: '', serviceAlias: '', ownerAlias: '',
  checkType: 'regression', severity: 'medium', status: 'not-started',
  targetDate: '', evidenceUrl: '', notes: '', waiverReason: '',
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
  const [checks, setChecks] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, blockers: 0, failed: 0, passed: 0, overdue: 0, ready: false });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', status: '', severity: '' });
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
      const path = '/api/checks' + (query ? '?' + query : '');
      const [items, summary] = await Promise.all([api(path), api('/api/checks/metrics')]);
      setChecks(items);
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
      await api('/api/checks', {
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
    let waiverReason = '';
    if (status === 'waived') {
      waiverReason = window.prompt('Waiver reason (at least 8 characters):') || '';
      if (waiverReason.length < 8) return;
    }
    try {
      await api('/api/checks/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, waiverReason }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this release check?')) return;
    try {
      await api('/api/checks/' + id, { method: 'DELETE' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <main>
    <header>
      <div><p className="kicker">Release confidence</p><h1>ReleaseGate</h1><p>Keep quality evidence, owners, blockers, and go-live readiness in one view.</p></div>
      <div className={'readiness ' + (metrics.ready ? 'ready' : '')}>{metrics.ready ? 'GO' : 'HOLD'}</div>
    </header>
    <section className="metrics">
      {[
        ['Checks', metrics.total], ['Blockers', metrics.blockers], ['Failed', metrics.failed],
        ['Passed', metrics.passed], ['Overdue', metrics.overdue],
      ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="layout">
      <form className="panel form" onSubmit={submit}>
        <div><p className="kicker">New gate</p><h2>Add a release check</h2></div>
        <div className="pair">
          <label>Gate code<input required maxLength="24" name="gateCode" value={form.gateCode} onChange={updateForm} placeholder="REL-SEC-04" /></label>
          <label>Check title<input required minLength="3" maxLength="120" name="title" value={form.title} onChange={updateForm} /></label>
        </div>
        <div className="pair">
          <label>Release name<input required minLength="2" maxLength="80" name="releaseName" value={form.releaseName} onChange={updateForm} /></label>
          <label>Service alias<input required minLength="2" maxLength="70" name="serviceAlias" value={form.serviceAlias} onChange={updateForm} /></label>
        </div>
        <div className="triple">
          <label>Owner alias<input required minLength="2" maxLength="60" name="ownerAlias" value={form.ownerAlias} onChange={updateForm} /></label>
          <label>Type<select name="checkType" value={form.checkType} onChange={updateForm}>{types.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Severity<select name="severity" value={form.severity} onChange={updateForm}>{severities.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label>Target date<input required type="date" name="targetDate" value={form.targetDate} onChange={updateForm} /></label>
        <label>Evidence URL (optional)<input type="url" maxLength="300" name="evidenceUrl" value={form.evidenceUrl} onChange={updateForm} placeholder="https://…" /></label>
        <label>Acceptance criteria / notes<textarea required minLength="8" maxLength="400" name="notes" value={form.notes} onChange={updateForm} /></label>
        <button disabled={busy}>{busy ? 'Saving…' : 'Add release check'}</button>
      </form>
      <section className="panel board">
        <div><p className="kicker">Quality gates</p><h2>Readiness board</h2></div>
        <div className="filters">
          <input aria-label="Search checks" placeholder="Search check, release, service…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <select aria-label="Filter status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Filter severity" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}><option value="">All severities</option>{severities.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
        {busy && !checks.length && <p className="empty">Loading release checks…</p>}
        {!busy && !checks.length && <p className="empty">No checks match this view.</p>}
        <div className="cards">{checks.map((check) => <article className={'card ' + (check.overdue ? 'late' : '')} key={check._id}>
          <div className="card-top"><span className={'severity ' + check.severity}>{check.severity}</span><code>{check.gateCode}</code></div>
          <h3>{check.title}</h3>
          <p className="meta">{check.releaseName} · {check.serviceAlias} · {check.checkType}</p>
          <p>{check.notes}</p>
          {check.evidenceUrl && <a href={check.evidenceUrl} target="_blank" rel="noreferrer">Open evidence</a>}
          {check.waiverReason && <p className="waiver">Waiver: {check.waiverReason}</p>}
          <div className="dates"><span>Owner {check.ownerAlias}</span><span>Target {new Date(check.targetDate).toLocaleDateString()}</span></div>
          {check.overdue && <p className="overdue">Gate is overdue</p>}
          <div className="actions">
            <select aria-label={'Status for ' + check.title} value={check.status} onChange={(event) => changeStatus(check._id, event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
            <button className="danger" type="button" onClick={() => remove(check._id)}>Delete</button>
          </div>
        </article>)}</div>
      </section>
    </section>
  </main>;
}

