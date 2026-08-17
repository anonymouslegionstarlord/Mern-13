import { useEffect, useMemo, useState } from "react";

const categories = ["Food", "Travel", "Home", "Entertainment", "Other"];
const initialForm = { description: "", amount: "", paidBy: "", participants: "", category: "Food" };

async function request(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(", ") || data.message || "Request failed");
  return data;
}

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [items, summary] = await Promise.all([
        request(`/api/expenses${filter ? `?category=${encodeURIComponent(filter)}` : ""}`),
        request("/api/expenses/summary/balances"),
      ]);
      setExpenses(items);
      setBalances(summary);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);

  const addExpense = async (event) => {
    event.preventDefault();
    const participants = form.participants.split(",").map((name) => name.trim()).filter(Boolean);
    try {
      await request("/api/expenses", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount), participants }) });
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await request(`/api/expenses/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="shell">
      <header><span>SHARED MONEY, CLEARLY</span><h1>SplitSmart</h1><p>Track group expenses without the awkward maths.</p></header>

      <section className="overview">
        <div><strong>₹{total.toFixed(2)}</strong><small>visible spending</small></div>
        <div><strong>{expenses.length}</strong><small>expenses</small></div>
        <div><strong>{balances.length}</strong><small>people</small></div>
      </section>

      <form onSubmit={addExpense} className="expense-form">
        <input required minLength="2" maxLength="80" placeholder="Dinner" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input required type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input required minLength="2" placeholder="Paid by" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} />
        <input required placeholder="Participants: Ana, Dev" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <button>Add expense</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="layout">
        <div>
          <nav className="filters">{["", ...categories].map((item) => <button className={filter === item ? "active" : ""} key={item || "All"} onClick={() => setFilter(item)}>{item || "All"}</button>)}</nav>
          {loading ? <p>Loading expenses…</p> : expenses.map((expense) => (
            <article key={expense._id}>
              <div><span className="tag">{expense.category}</span><h2>{expense.description}</h2><p>Paid by {expense.paidBy} · split between {expense.participants.join(", ")}</p></div>
              <div className="amount"><strong>₹{expense.amount.toFixed(2)}</strong><button onClick={() => removeExpense(expense._id)}>Delete</button></div>
            </article>
          ))}
          {!loading && !expenses.length && <p>No expenses found.</p>}
        </div>
        <aside><h2>Balances</h2><p className="hint">Positive means should receive; negative means owes.</p>{balances.map((item) => <div className="balance" key={item.name}><span>{item.name}</span><strong className={item.balance < 0 ? "negative" : "positive"}>₹{item.balance.toFixed(2)}</strong></div>)}</aside>
      </section>
    </main>
  );
}

