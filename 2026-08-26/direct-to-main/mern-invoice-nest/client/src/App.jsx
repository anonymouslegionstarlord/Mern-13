import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const emptyForm = {
  invoiceNumber: "",
  client: "",
  amount: "",
  dueDate: "",
  status: "draft",
  notes: "",
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({ billed: 0, collected: 0, outstanding: 0, overdue: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    return params.toString();
  }, [query, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [invoiceData, summaryData] = await Promise.all([
        request(`/invoices${searchParams ? `?${searchParams}` : ""}`),
        request("/invoices/summary"),
      ]);
      setInvoices(invoiceData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [searchParams]);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const path = editingId ? `/invoices/${editingId}` : "/invoices";
      await request(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editInvoice(invoice) {
    setEditingId(invoice._id);
    setForm({
      invoiceNumber: invoice.invoiceNumber,
      client: invoice.client,
      amount: String(invoice.amount),
      dueDate: invoice.dueDate.slice(0, 10),
      status: invoice.status,
      notes: invoice.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeInvoice(invoice) {
    if (!window.confirm(`Delete ${invoice.invoiceNumber}?`)) return;
    try {
      await request(`/invoices/${invoice._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Freelance finance</span>
          <h1>InvoiceNest</h1>
          <p>Know what is billed, paid, and overdue without spreadsheet archaeology.</p>
        </div>
        <div className="heroMark">IN</div>
      </header>

      <section className="stats" aria-label="Invoice summary">
        <article><span>Billed</span><strong>{money.format(summary.billed)}</strong></article>
        <article><span>Collected</span><strong>{money.format(summary.collected)}</strong></article>
        <article><span>Outstanding</span><strong>{money.format(summary.outstanding)}</strong></article>
        <article><span>Overdue</span><strong>{summary.overdue}</strong></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}

      <section className="workspace">
        <form className="panel form" onSubmit={submit}>
          <div className="panelTitle">
            <div><span className="eyebrow">{editingId ? "Update record" : "New record"}</span><h2>{editingId ? "Edit invoice" : "Add invoice"}</h2></div>
            {editingId && <button className="textButton" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}
          </div>
          <label>Invoice number<input name="invoiceNumber" value={form.invoiceNumber} onChange={updateForm} placeholder="INV-1042" required /></label>
          <label>Client<input name="client" value={form.client} onChange={updateForm} maxLength="80" required /></label>
          <div className="formRow">
            <label>Amount<input name="amount" value={form.amount} onChange={updateForm} type="number" min="0.01" step="0.01" required /></label>
            <label>Due date<input name="dueDate" value={form.dueDate} onChange={updateForm} type="date" required /></label>
          </div>
          <label>Status<select name="status" value={form.status} onChange={updateForm}><option>draft</option><option>sent</option><option>paid</option><option>overdue</option></select></label>
          <label>Notes<textarea name="notes" value={form.notes} onChange={updateForm} maxLength="500" rows="3" /></label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create invoice"}</button>
        </form>

        <section className="panel listPanel">
          <div className="panelTitle"><div><span className="eyebrow">Receivables</span><h2>Invoices</h2></div><span className="count">{invoices.length}</span></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client or invoice" aria-label="Search invoices" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option>draft</option><option>sent</option><option>paid</option><option>overdue</option></select>
          </div>
          {loading ? <p className="empty">Loading invoices...</p> : invoices.length === 0 ? <p className="empty">No invoices match this view.</p> : (
            <div className="invoiceList">
              {invoices.map((invoice) => (
                <article className="invoice" key={invoice._id}>
                  <div className="invoiceTop"><div><strong>{invoice.client}</strong><span>{invoice.invoiceNumber}</span></div><span className={`badge ${invoice.status}`}>{invoice.status}</span></div>
                  <div className="invoiceMeta"><strong>{money.format(invoice.amount)}</strong><span>Due {new Date(invoice.dueDate).toLocaleDateString()}</span></div>
                  {invoice.notes && <p>{invoice.notes}</p>}
                  <div className="actions"><button onClick={() => editInvoice(invoice)}>Edit</button><button className="danger" onClick={() => removeInvoice(invoice)}>Delete</button></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

