import { useEffect, useMemo, useState } from "react";

const categories = ["Health", "Learning", "Work", "Mindfulness", "Other"];

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(", ") || data.message || "Request failed");
  return data;
}

export default function App() {
  const [habits, setHabits] = useState([]);
  const [form, setForm] = useState({ name: "", category: "Health", targetDays: 7 });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadHabits = async () => {
    setLoading(true);
    try {
      setHabits(await api(`/api/habits${filter ? `?category=${encodeURIComponent(filter)}` : ""}`));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHabits();
  }, [filter]);

  const completedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return habits.filter((habit) => habit.completedDates.some((date) => date.slice(0, 10) === today)).length;
  }, [habits]);

  const createHabit = async (event) => {
    event.preventDefault();
    try {
      await api("/api/habits", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", category: "Health", targetDays: 7 });
      await loadHabits();
    } catch (err) {
      setError(err.message);
    }
  };

  const complete = async (id) => {
    try {
      await api(`/api/habits/${id}/complete`, { method: "POST" });
      await loadHabits();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this habit?")) return;
    try {
      await api(`/api/habits/${id}`, { method: "DELETE" });
      await loadHabits();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">DAILY MOMENTUM</p>
        <h1>HabitHeat</h1>
        <p>Small actions, visible progress.</p>
      </header>

      <section className="stats" aria-label="Habit statistics">
        <div><strong>{habits.length}</strong><span>visible habits</span></div>
        <div><strong>{completedToday}</strong><span>done today</span></div>
        <div><strong>{habits.reduce((sum, habit) => sum + habit.completedDates.length, 0)}</strong><span>total check-ins</span></div>
      </section>

      <form className="habit-form" onSubmit={createHabit}>
        <input
          aria-label="Habit name"
          placeholder="Read for 20 minutes"
          minLength="2"
          maxLength="60"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <input
          aria-label="Target days per week"
          type="number"
          min="1"
          max="7"
          value={form.targetDays}
          onChange={(event) => setForm({ ...form, targetDays: Number(event.target.value) })}
        />
        <button type="submit">Add habit</button>
      </form>

      <nav className="filters" aria-label="Category filters">
        {["", ...categories].map((category) => (
          <button className={filter === category ? "active" : ""} key={category || "All"} onClick={() => setFilter(category)}>
            {category || "All"}
          </button>
        ))}
      </nav>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading habits...</p> : (
        <section className="grid">
          {habits.map((habit) => (
            <article key={habit._id}>
              <span className="tag">{habit.category}</span>
              <h2>{habit.name}</h2>
              <p>{habit.completedDates.length} check-ins · {habit.targetDays} day weekly goal</p>
              <div className="actions">
                <button onClick={() => complete(habit._id)}>Complete today</button>
                <button className="danger" onClick={() => remove(habit._id)}>Delete</button>
              </div>
            </article>
          ))}
          {!habits.length && <p>No habits yet. Add your first one above.</p>}
        </section>
      )}
    </main>
  );
}

