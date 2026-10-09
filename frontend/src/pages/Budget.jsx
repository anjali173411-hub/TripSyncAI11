import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Check, Sparkles } from "lucide-react";

import Layout from "../components/Layout";
import TripNav from "../components/TripNav";
import api, { getErrorMessage } from "../services/api";

const EMPTY_FORM = { category: "food", amount: "", kind: "actual", paid_by: "", description: "" };

function rupees(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

export default function Budget() {
  const { id } = useParams();

  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [tips, setTips] = useState(null);
  const [applied, setApplied] = useState([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const tripResponse = await api.get(`/trips/${id}`);
      setTrip(tripResponse.data);

      const response = await api.get(`/trips/${id}/budget`);
      setExpenses(response.data.expenses);
      setSummary(response.data.summary);
      setCategories(response.data.categories);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      if (editingId) {
        await api.put(`/trips/${id}/expenses/${editingId}`, form);
        setMessage("Expense updated.");
      } else {
        await api.post(`/trips/${id}/expenses`, form);
        setMessage("Expense added.");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function startEdit(expense) {
    setEditingId(expense._id);
    setForm({
      category: expense.category,
      amount: expense.amount,
      kind: expense.kind,
      paid_by: expense.paid_by ? expense.paid_by.id : "",
      description: expense.description,
    });
  }

  async function deleteExpense(expense) {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await api.delete(`/trips/${id}/expenses/${expense._id}`);
      setMessage("Expense deleted.");
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function getTips() {
    setError("");
    setMessage("");
    setLoadingTips(true);
    try {
      const response = await api.post(`/trips/${id}/budget/tips`);
      setTips(response.data);
      setApplied([]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingTips(false);
    }
  }

  async function applyTip(tip, index) {
    const change = tip.change;
    const ok = window.confirm(
      `Replace "${change.current_title}" (${rupees(change.current_cost)}) with ` +
        `"${change.new_title}" (${rupees(change.new_cost)}) in the itinerary?`
    );
    if (!ok) return;

    setError("");
    setMessage("");
    try {
      const response = await api.post(`/trips/${id}/budget/apply`, change);
      setMessage(response.data.message);
      setApplied([...applied, index]);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!trip || !summary) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading budget..."}</div>
      </Layout>
    );
  }

  const tripStatus = trip.trip_status || trip.status;
  const canApply = trip.is_organiser && !["finalised", "completed"].includes(tripStatus);
  const warnAt = summary.warning_percent;

  return (
    <Layout>
      <TripNav trip={trip} />

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}

      <div className="stats">
        <div className="stat"><span>Total budget</span><strong>{rupees(summary.total_budget)}</strong></div>
        <div className="stat"><span>Planned expenses</span><strong>{rupees(summary.planned)}</strong></div>
        <div className="stat">
          <span>Planned budget left</span>
          <strong className={summary.planned_remaining < 0 ? "over" : ""}>{rupees(summary.planned_remaining)}</strong>
        </div>
        <div className="stat"><span>Actual spent</span><strong>{rupees(summary.actual)}</strong></div>
        <div className="stat">
          <span>Actual budget left</span>
          <strong className={summary.actual_remaining < 0 ? "over" : ""}>{rupees(summary.actual_remaining)}</strong>
        </div>
      </div>

      <div className="card">
        <p className="muted budget-bar-label">
          Planned: {summary.planned_percent}% of the budget
          <span>itinerary {rupees(summary.plan_total)} + planned expenses {rupees(summary.planned_extras)}</span>
        </p>
        <div className="progress">
          <div
            className={summary.planned_percent >= warnAt ? "progress-bar warn" : "progress-bar"}
            style={{ width: Math.min(summary.planned_percent, 100) + "%" }}
          ></div>
        </div>

        <p className="muted budget-bar-label" style={{ marginTop: 14 }}>
          Actually spent: {summary.actual_percent}% of the budget
        </p>
        <div className="progress">
          <div
            className={summary.actual_percent >= warnAt ? "progress-bar warn" : "progress-bar"}
            style={{ width: Math.min(summary.actual_percent, 100) + "%" }}
          ></div>
        </div>

        {summary.planned_overrun > 0 && (
          <div className="budget-alert over">
            <AlertTriangle size={17} /> The plan exceeds the budget by <strong>{rupees(summary.planned_overrun)}</strong>.
          </div>
        )}
        {summary.actual_overrun > 0 && (
          <div className="budget-alert over">
            <AlertTriangle size={17} /> Spending exceeds the budget by <strong>{rupees(summary.actual_overrun)}</strong>.
          </div>
        )}
        {summary.near_limit && summary.planned_overrun === 0 && summary.actual_overrun === 0 && (
          <div className="budget-alert">
            <AlertTriangle size={17} /> You're above {warnAt}% of the budget.
          </div>
        )}

        {summary.near_limit ? (
          <button className="secondary-btn" style={{ marginTop: 14 }} onClick={getTips} disabled={loadingTips}>
            <Sparkles size={16} /> {loadingTips ? "Thinking..." : tips ? "Get new saving tips" : "Get AI saving tips"}
          </button>
        ) : (
          <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
            AI saving tips appear once planned or actual spending reaches {warnAt}% of the budget.
          </p>
        )}

        {tips && (
          <div className="tips">
            <p className="muted">{tips.summary}</p>
            {tips.suggestions.map((tip, index) => (
              <div className="tip" key={index}>
                <div>
                  <p className="tip-text">
                    {tip.suggestion} <span className="badge">{tip.category}</span>
                  </p>
                  {tip.change && (
                    <p className="muted tip-change">
                      Day {tip.change.day}: "{tip.change.current_title}" {rupees(tip.change.current_cost)} → "
                      {tip.change.new_title}" {rupees(tip.change.new_cost)}
                    </p>
                  )}
                </div>
                <div className="tip-side">
                  <strong>save ~{rupees(tip.estimated_saving)}</strong>
                  {tip.change && canApply && !applied.includes(index) && (
                    <button className="small-btn" onClick={() => applyTip(tip, index)}>Apply</button>
                  )}
                  {applied.includes(index) && (
                    <span className="badge green"><Check size={13} /> Applied</span>
                  )}
                </div>
              </div>
            ))}
            <p className="muted tip-note">
              These are estimates, not live prices or bookings.
              {!canApply && " Only the organiser can apply a suggestion, while the trip is still being planned."}
            </p>
          </div>
        )}
      </div>

      <div className="two-col">
        <div>
          <section className="card">
            <h2>Spending breakdown</h2>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>From itinerary</th>
                    <th>Planned expenses</th>
                    <th>Total planned</th>
                    <th>Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.by_category).map(([name, values]) => (
                    <tr key={name}>
                      <td style={{ textTransform: "capitalize" }}>{name}</td>
                      <td>{rupees(values.plan)}</td>
                      <td>{rupees(values.planned)}</td>
                      <td><strong>{rupees(values.plan + values.planned)}</strong></td>
                      <td>{rupees(values.actual)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total</td>
                    <td>{rupees(summary.plan_total)}</td>
                    <td>{rupees(summary.planned_extras)}</td>
                    <td>{rupees(summary.planned)}</td>
                    <td>{rupees(summary.actual)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {trip.type === "group" && (
            <section className="card">
              <h2>Member contributions</h2>
              <p className="muted">
                Contributions come from each person's Preferences. They're shown separately from what people
                paid, so no amount is counted twice.
              </p>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Contribution</th><th>Paid</th><th>Fair share</th><th>Balance</th></tr>
                  </thead>
                  <tbody>
                    {summary.by_member.map((m) => (
                      <tr key={m.id}>
                        <td>{m.name}</td>
                        <td>{rupees(m.contribution)}</td>
                        <td>{rupees(m.paid)}</td>
                        <td>{rupees(m.fair_share)}</td>
                        <td>{m.balance >= 0 ? `gets back ${rupees(m.balance)}` : `owes ${rupees(-m.balance)}`}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td>Group total</td>
                      <td>{rupees(summary.total_contributions)}</td>
                      <td>{rupees(summary.actual)}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card">
            <h2>Expenses</h2>
            {expenses.length === 0 && <p className="muted">Nothing added yet.</p>}
            {expenses.map((expense) => (
              <div className="list-row" key={expense._id}>
                <span>
                  <strong>{rupees(expense.amount)}</strong> ·{" "}
                  <span style={{ textTransform: "capitalize" }}>{expense.category}</span>{" "}
                  <span className={expense.kind === "actual" ? "badge green" : "badge"}>
                    {expense.kind === "actual" ? "spent" : "planned"}
                  </span>
                  <br />
                  <span className="muted">
                    {expense.description} {expense.paid_by && `· paid by ${expense.paid_by.name}`}
                  </span>
                </span>
                <div className="row">
                  <button className="small-btn" onClick={() => startEdit(expense)}>Edit</button>
                  <button className="small-btn danger" onClick={() => deleteExpense(expense)}>Delete</button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit expense" : "Add expense"}</h2>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" value={form.category} onChange={handleChange}>
              {categories.map((name) => (
                <option key={name} value={name}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="amount">Amount (₹)</label>
            <input id="amount" name="amount" type="number" min="1" required value={form.amount} onChange={handleChange} />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="kind">Type</label>
            <select id="kind" name="kind" value={form.kind} onChange={handleChange}>
              <option value="actual">Actual expense (already spent)</option>
              <option value="planned">Planned expense (not in the itinerary)</option>
            </select>
          </div>

          {trip.type === "group" && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="paid_by">Paid by</label>
              <select id="paid_by" name="paid_by" value={form.paid_by} onChange={handleChange}>
                <option value="">Me</option>
                {trip.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="description">Description</label>
            <input id="description" name="description" placeholder="e.g. Lunch" value={form.description} onChange={handleChange} />
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" className="primary-btn">{editingId ? "Save" : "Add expense"}</button>
            {editingId && (
              <button type="button" className="secondary-btn" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
