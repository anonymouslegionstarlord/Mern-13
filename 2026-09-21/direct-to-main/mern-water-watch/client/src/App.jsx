import { useCallback, useEffect, useState } from 'react';

const initialForm = {
  sampleCode: '', siteAlias: '', collectorAlias: '', source: 'tap', sampledAt: '',
  ph: '7', turbidityNtu: '0.5', chlorineMgL: '1', temperatureC: '22', notes: '',
};

async function api(path, options) {
  const response = await fetch(path, options);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({ error: 'Invalid server response' }));
  if (!response.ok) throw new Error(data.details?.join(', ') || data.error || 'Request failed');
  return data;
}

export default function App() {
  const [samples, setSamples] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, safe: 0, attention: 0, unsafe: 0, averageTurbidity: 0 });
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', classification: '', source: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const [items, totals] = await Promise.all([
        api('/api/samples?' + params), api('/api/samples/metrics'),
      ]);
      setSamples(items);
      setMetrics(totals);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    try {
      await api('/api/samples', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, ph: Number(form.ph), turbidityNtu: Number(form.turbidityNtu),
          chlorineMgL: Number(form.chlorineMgL), temperatureC: Number(form.temperatureC),
        }),
      });
      setForm(initialForm);
      setMessage('Sample saved.');
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function editNotes(sample) {
    const notes = window.prompt('Update sample notes', sample.notes);
    if (notes === null || notes === sample.notes) return;
    try {
      await api('/api/samples/' + sample._id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }),
      });
      setMessage('Notes updated.');
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function remove(sample) {
    if (!window.confirm('Delete sample ' + sample.sampleCode + '?')) return;
    try {
      await api('/api/samples/' + sample._id, { method: 'DELETE' });
      setMessage('Sample deleted.');
      await load();
    } catch (error) { setMessage(error.message); }
  }

  const field = (name, label, type = 'text', extra = {}) => (
    <label>{label}<input type={type} value={form[name]} required onChange={(event) => setForm({ ...form, [name]: event.target.value })} {...extra} /></label>
  );

  return <main>
    <header><div><span className="eyebrow">FIELD QUALITY DASHBOARD</span><h1>WaterWatch</h1><p>Turn water sample readings into clear, reviewable signals.</p></div><div className="drop">H₂O</div></header>
    <section className="metrics">
      {Object.entries(metrics).map(([key, value]) => <article key={key}><strong>{value}</strong><span>{key.replace(/([A-Z])/g, ' $1')}</span></article>)}
    </section>
    {message && <p className="message" role="status">{message}</p>}
    <section className="panel">
      <div><span className="eyebrow">NEW READING</span><h2>Log a sample</h2></div>
      <form onSubmit={submit}>
        {field('sampleCode', 'Sample code')}{field('siteAlias', 'Site alias')}{field('collectorAlias', 'Collector alias')}
        <label>Source<select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>{['tap', 'well', 'river', 'lake', 'storage', 'other'].map((item) => <option key={item}>{item}</option>)}</select></label>
        {field('sampledAt', 'Sampled at', 'datetime-local')}{field('ph', 'pH', 'number', { min: 0, max: 14, step: 0.01 })}
        {field('turbidityNtu', 'Turbidity (NTU)', 'number', { min: 0, max: 1000, step: 0.01 })}
        {field('chlorineMgL', 'Chlorine (mg/L)', 'number', { min: 0, max: 20, step: 0.01 })}
        {field('temperatureC', 'Temperature °C', 'number', { min: -10, max: 60, step: 0.1 })}
        <label className="wide">Notes<textarea value={form.notes} minLength="5" maxLength="300" required onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <button type="submit">Save reading</button>
      </form>
    </section>
    <section className="panel">
      <div className="toolbar"><div><span className="eyebrow">SAMPLE LOG</span><h2>Recent readings</h2></div><div className="filters">
        <input aria-label="Search" placeholder="Search code or alias" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select aria-label="Classification" value={filters.classification} onChange={(event) => setFilters({ ...filters, classification: event.target.value })}><option value="">All signals</option><option>safe</option><option>attention</option><option>unsafe</option></select>
        <select aria-label="Source" value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}><option value="">All sources</option>{['tap', 'well', 'river', 'lake', 'storage', 'other'].map((item) => <option key={item}>{item}</option>)}</select>
      </div></div>
      {loading ? <p>Loading readings…</p> : samples.length === 0 ? <p>No samples match these filters.</p> : <div className="cards">{samples.map((sample) => <article className="sample" key={sample._id}>
        <div className="cardtop"><span className={'badge ' + sample.classification}>{sample.classification}</span><strong>{sample.sampleCode}</strong></div>
        <h3>{sample.siteAlias}</h3><p>{sample.source} · {new Date(sample.sampledAt).toLocaleString()}</p>
        <div className="readings"><span>pH <b>{sample.ph}</b></span><span>NTU <b>{sample.turbidityNtu}</b></span><span>Cl₂ <b>{sample.chlorineMgL}</b></span><span>°C <b>{sample.temperatureC}</b></span></div>
        <p>{sample.notes}</p><small>Collector: {sample.collectorAlias}</small>
        <div className="actions"><button onClick={() => editNotes(sample)}>Edit notes</button><button className="danger" onClick={() => remove(sample)}>Delete</button></div>
      </article>)}</div>}
    </section>
  </main>;
}

