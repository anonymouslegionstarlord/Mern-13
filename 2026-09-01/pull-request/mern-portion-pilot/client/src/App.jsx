import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const categories = ["breakfast", "main", "bakery", "beverage", "snack", "other"];
const statuses = ["draft", "tested", "favorite"];
const units = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "piece"];

function freshForm() {
  return { name: "", category: "main", baseServings: "4", prepMinutes: "30", batchCost: "", notes: "", ingredients: [{ name: "", quantity: "", unit: "g" }] };
}

async function request(path, options = {}) {
  const response = await fetch(API + path, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function number(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

export default function App() {
  const [recipes, setRecipes] = useState([]);
  const [stats, setStats] = useState({ total: 0, tested: 0, favorites: 0, averageCostPerServing: 0 });
  const [form, setForm] = useState(freshForm);
  const [scales, setScales] = useState({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, category, status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, summary] = await Promise.all([request("/recipes" + (search ? "?" + search : "")), request("/recipes/stats")]);
      setRecipes(rows);
      setStats(summary);
      setScales((current) => Object.fromEntries(rows.map((row) => [row._id, current[row._id] || row.baseServings])));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateIngredient(index, field, value) {
    setForm((current) => ({ ...current, ingredients: current.ingredients.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row) }));
  }

  function addIngredient() {
    if (form.ingredients.length < 20) setForm((current) => ({ ...current, ingredients: [...current.ingredients, { name: "", quantity: "", unit: "g" }] }));
  }

  function removeIngredient(index) {
    if (form.ingredients.length > 1) setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_row, rowIndex) => rowIndex !== index) }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        baseServings: Number(form.baseServings),
        prepMinutes: Number(form.prepMinutes),
        batchCost: Number(form.batchCost),
        ingredients: form.ingredients.map((row) => ({ ...row, quantity: Number(row.quantity) })),
      };
      await request("/recipes", { method: "POST", body: JSON.stringify(payload) });
      setForm(freshForm());
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(recipe, nextStatus) {
    try {
      await request("/recipes/" + recipe._id + "/status", { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(recipe) {
    if (!window.confirm("Delete " + recipe.name + "?")) return;
    try {
      await request("/recipes/" + recipe._id, { method: "DELETE" });
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="shell">
      <header className="hero"><div><span className="eyebrow">Kitchen math, made calm</span><h1>PortionPilot</h1><p>Save tested recipes, scale every ingredient, and estimate batch cost in seconds.</p></div><div className="plate" aria-hidden="true"><span>×</span></div></header>
      <section className="stats" aria-label="Recipe summary">
        <article><span>Recipes</span><strong>{stats.total}</strong></article>
        <article><span>Tested</span><strong>{stats.tested}</strong></article>
        <article><span>Favorites</span><strong>{stats.favorites}</strong></article>
        <article><span>Average / serving</span><strong>₹{number(stats.averageCostPerServing)}</strong></article>
      </section>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="layout">
        <form className="panel form" onSubmit={submit}>
          <span className="eyebrow">Recipe notebook</span><h2>Add a base recipe</h2>
          <label>Recipe name<input name="name" value={form.name} onChange={updateForm} minLength="3" maxLength="100" placeholder="Roasted tomato soup" required /></label>
          <div className="twoCol"><label>Category<select name="category" value={form.category} onChange={updateForm}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Base servings<input name="baseServings" type="number" min="1" max="500" value={form.baseServings} onChange={updateForm} required /></label></div>
          <div className="twoCol"><label>Prep minutes<input name="prepMinutes" type="number" min="1" max="1440" value={form.prepMinutes} onChange={updateForm} required /></label><label>Batch cost (₹)<input name="batchCost" type="number" min="0" max="1000000" step="0.01" value={form.batchCost} onChange={updateForm} required /></label></div>
          <fieldset><legend>Ingredients</legend>{form.ingredients.map((ingredient, index) => <div className="ingredientRow" key={index}><input value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} minLength="2" maxLength="80" placeholder="Ingredient" aria-label={"Ingredient " + (index + 1)} required /><input type="number" min="0.01" max="100000" step="0.01" value={ingredient.quantity} onChange={(event) => updateIngredient(index, "quantity", event.target.value)} placeholder="Qty" aria-label={"Quantity " + (index + 1)} required /><select value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} aria-label={"Unit " + (index + 1)}>{units.map((value) => <option key={value}>{value}</option>)}</select><button type="button" onClick={() => removeIngredient(index)} disabled={form.ingredients.length === 1} aria-label={"Remove ingredient " + (index + 1)}>−</button></div>)}</fieldset>
          <button className="addRow" type="button" onClick={addIngredient} disabled={form.ingredients.length >= 20}>+ Add ingredient</button>
          <label>Method notes<textarea name="notes" value={form.notes} onChange={updateForm} minLength="5" maxLength="400" rows="4" placeholder="Key timing and preparation notes" required /></label>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Save recipe"}</button>
        </form>

        <section className="panel listPanel">
          <div className="sectionTitle"><div><span className="eyebrow">Scale station</span><h2>Recipe cards</h2></div><strong>{recipes.length}</strong></div>
          <div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes or ingredients" aria-label="Search recipes" /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category"><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></div>
          {loading ? <p className="empty">Loading recipes...</p> : recipes.length === 0 ? <p className="empty">No recipes match this view.</p> : <div className="cards">{recipes.map((recipe) => {
            const target = Math.max(1, Number(scales[recipe._id]) || recipe.baseServings);
            const ratio = target / recipe.baseServings;
            return <article className={"card " + recipe.status} key={recipe._id}>
              <div className="cardTop"><div><span className="category">{recipe.category}</span><strong>{recipe.name}</strong></div><span className={"badge " + recipe.status}>{recipe.status}</span></div>
              <p>{recipe.notes}</p>
              <div className="scaleBar"><label>Scale to <input type="number" min="1" max="10000" value={scales[recipe._id] || recipe.baseServings} onChange={(event) => setScales((current) => ({ ...current, [recipe._id]: event.target.value }))} aria-label={"Target servings for " + recipe.name} /> servings</label><strong>₹{number(recipe.batchCost * ratio)}</strong></div>
              <ul>{recipe.ingredients.map((ingredient, index) => <li key={ingredient.name + index}><span>{ingredient.name}</span><strong>{number(ingredient.quantity * ratio)} {ingredient.unit}</strong></li>)}</ul>
              <div className="meta"><span>{recipe.prepMinutes} min</span><span>Base: {recipe.baseServings}</span><span>₹{number(recipe.batchCost / recipe.baseServings)} / serving</span></div>
              <div className="actions"><select value={recipe.status} onChange={(event) => updateStatus(recipe, event.target.value)} aria-label={"Status for " + recipe.name}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="delete" onClick={() => remove(recipe)}>Delete</button></div>
            </article>;
          })}</div>}
        </section>
      </section>
    </main>
  );
}
