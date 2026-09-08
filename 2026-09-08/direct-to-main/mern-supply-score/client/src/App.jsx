import { useCallback, useEffect, useMemo, useState } from 'react';

const categories = ['materials', 'logistics', 'software', 'facilities', 'professional-services', 'other'];
const statuses = ['active', 'approved', 'watch', 'paused'];
const risks = ['low', 'medium', 'high'];
const initialForm = {
  vendorCode: '', vendorAlias: '', category: 'materials', deliveryScore: 3,
  qualityScore: 3, communicationScore: 3, riskLevel: 'low', status: 'active',
  reviewDate: '', summary: '',
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
  const [reviews, setReviews] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, watch: 0, highRisk: 0, delivery: 0, quality: 0, communication: 0 });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', category: '', riskLevel: '' });
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
        api(`/api/reviews${query ? `?${query}` : ''}`), api('/api/reviews/metrics'),
      ]);
      setReviews(items);
      setMetrics(summary);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  function updateForm(event) {
    const { name, value } = event.target;
    const numeric = ['deliveryScore', 'qualityScore', 'communicationScore'].includes(name);
    setForm((current) => ({ ...current, [name]: numeric ? Number(value) : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setForm(initialForm);
      await load();
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  }

  async function changeStatus(id, status) {
    try {
      await api(`/api/reviews/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this vendor review?')) return;
    try { await api(`/api/reviews/${id}`, { method: 'DELETE' }); await load(); }
    catch (requestError) { setError(requestError.message); }
  }

  return (
    <main>
      <header><div><p className="kicker">Operational clarity</p><h1>SupplyScore</h1><p className="intro">A calm, evidence-led view of vendor performance and risk.</p></div><div className="signal">SS</div></header>
      <section className="metrics">
        {[
          ['Reviews', metrics.total], ['Watch list', metrics.watch], ['High risk', metrics.highRisk],
          ['Delivery avg', metrics.delivery], ['Quality avg', metrics.quality], ['Comms avg', metrics.communication],
        ].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <div><p className="kicker">New assessment</p><h2>Record a review</h2></div>
          <div className="pair"><label>Vendor code<input required maxLength="20" name="vendorCode" value={form.vendorCode} onChange={updateForm} placeholder="VND-104" /></label><label>Vendor alias<input required minLength="2" maxLength="80" name="vendorAlias" value={form.vendorAlias} onChange={updateForm} /></label></div>
          <div className="pair"><label>Category<select name="category" value={form.category} onChange={updateForm}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Risk level<select name="riskLevel" value={form.riskLevel} onChange={updateForm}>{risks.map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <div className="scores">
            {['deliveryScore', 'qualityScore', 'communicationScore'].map((name) => <label key={name}>{name.replace('Score', '')}<input type="number" min="1" max="5" name={name} value={form[name]} onChange={updateForm} /></label>)}
          </div>
          <label>Review date<input required type="date" name="reviewDate" value={form.reviewDate} onChange={updateForm} /></label>
          <label>Evidence summary<textarea required minLength="8" maxLength="320" name="summary" value={form.summary} onChange={updateForm} placeholder="Describe observed delivery and quality patterns…" /></label>
          <button disabled={busy}>{busy ? 'Saving…' : 'Add review'}</button>
        </form>

        <section className="panel board">
          <div><p className="kicker">Portfolio</p><h2>Vendor review board</h2></div>
          <div className="filters">
            <input aria-label="Search vendors" placeholder="Search code or alias…" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select aria-label="Filter category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter risk" value={filters.riskLevel} onChange={(event) => setFilters({ ...filters, riskLevel: event.target.value })}><option value="">All risk levels</option>{risks.map((value) => <option key={value}>{value}</option>)}</select>
          </div>
          {busy && !reviews.length && <p className="empty">Loading reviews…</p>}
          {!busy && !reviews.length && <p className="empty">No reviews match this view.</p>}
          <div className="cards">
            {reviews.map((review) => <article className="card" key={review._id}>
              <div className="card-top"><span className={`risk ${review.riskLevel}`}>{review.riskLevel} risk</span><code>{review.vendorCode}</code></div>
              <h3>{review.vendorAlias}</h3><p className="meta">{review.category} · reviewed {new Date(review.reviewDate).toLocaleDateString()}</p>
              <div className="score"><strong>{review.averageScore}</strong><span>/ 5 average</span></div>
              <p>{review.summary}</p>
              <div className="actions"><select aria-label={`Status for ${review.vendorAlias}`} value={review.status} onChange={(event) => changeStatus(review._id, event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="danger" type="button" onClick={() => remove(review._id)}>Delete</button></div>
            </article>)}
          </div>
        </section>
      </section>
    </main>
  );
}

