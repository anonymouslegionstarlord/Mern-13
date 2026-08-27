import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const today = new Date().toISOString().slice(0, 10);
const emptyForm = { bookTitle: "", borrower: "", borrowerEmail: "", checkedOutAt: today, dueDate: "" };

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function displayStatus(loan) {
  if (loan.status === "returned") return "returned";
  return new Date(loan.dueDate).getTime() < Date.now() ? "overdue" : "active";
}

export default function App() {
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({ active: 0, overdue: 0, returned: 0, dueSoon: 0 });
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    return params.toString();
  }, [query, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [items, summary] = await Promise.all([
        request(`/loans${search ? `?${search}` : ""}`),
        request("/loans/stats"),
      ]);
      setLoans(items);
      setStats(summary);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search]);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/loans", { method: "POST", body: JSON.stringify(form) });
      setForm({ ...emptyForm, checkedOutAt: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function returnBook(loan) {
    try {
      await request(`/loans/${loan._id}/return`, { method: "PATCH" });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function removeLoan(loan) {
    if (!window.confirm(`Delete the loan for “${loan.bookTitle}”?`)) return;
    try {
      await request(`/loans/${loan._id}`, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div><span className="eyebrow">Circulation desk</span><h1>LibraryLoop</h1><p>Keep every borrowed book moving back to the shelf.</p></div>
        <div className="bookMark"><span></span><span></span><span></span></div>
      </header>

      <section className="stats" aria-label="Loan summary">
        <article><span>Active loans</span><strong>{stats.active}</strong></article>
        <article><span>Overdue</span><strong>{stats.overdue}</strong></article>
        <article><span>Due in 3 days</span><strong>{stats.dueSoon}</strong></article>
        <article><span>Returned</span><strong>{stats.returned}</strong></article>
      </section>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">New checkout</span><h2>Lend a book</h2>
          <label>Book title<input name="bookTitle" value={form.bookTitle} onChange={updateForm} maxLength="120" required /></label>
          <label>Borrower<input name="borrower" value={form.borrower} onChange={updateForm} maxLength="80" required /></label>
          <label>Email<input name="borrowerEmail" value={form.borrowerEmail} onChange={updateForm} type="email" maxLength="120" required /></label>
          <div className="twoCol">
            <label>Checked out<input name="checkedOutAt" value={form.checkedOutAt} onChange={updateForm} type="date" required /></label>
            <label>Due date<input name="dueDate" value={form.dueDate} onChange={updateForm} type="date" min={form.checkedOutAt} required /></label>
          </div>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Create loan"}</button>
        </form>

        <section className="panel loanPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Current ledger</span><h2>Book loans</h2></div><strong>{loans.length}</strong></div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search book, borrower, or email" aria-label="Search loans" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Loan status"><option value="">All statuses</option><option>active</option><option>overdue</option><option>returned</option></select>
          </div>
          {loading ? <p className="empty">Loading loans...</p> : loans.length === 0 ? <p className="empty">No loans match this view.</p> : (
            <div className="loanList">
              {loans.map((loan) => {
                const state = displayStatus(loan);
                return <article className={`loan ${state}`} key={loan._id}>
                  <div className="loanTop"><div><strong>{loan.bookTitle}</strong><span>{loan.borrower} · {loan.borrowerEmail}</span></div><span className={`badge ${state}`}>{state}</span></div>
                  <div className="dates"><span>Out {new Date(loan.checkedOutAt).toLocaleDateString()}</span><span>Due {new Date(loan.dueDate).toLocaleDateString()}</span></div>
                  <div className="actions">{loan.status === "active" && <button className="return" onClick={() => returnBook(loan)}>Mark returned</button>}<button className="delete" onClick={() => removeLoan(loan)}>Delete</button></div>
                </article>;
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

