import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";

import Layout from "../components/Layout";
import TripNav from "../components/TripNav";
import api, { getErrorMessage } from "../services/api";

const INTEREST_OPTIONS = ["Adventure", "Food", "Culture", "Nature", "Relaxation", "Nightlife", "Shopping"];
const PACE_OPTIONS = ["relaxed", "balanced", "packed"];

function textToList(text) {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export default function Preferences() {
  const { id } = useParams();

  const [trip, setTrip] = useState(null);
  const [people, setPeople] = useState([]);
  const [locked, setLocked] = useState(false);

  const [interests, setInterests] = useState([]);
  const [pace, setPace] = useState("balanced");
  const [budgetContribution, setBudgetContribution] = useState("");
  const [mustDo, setMustDo] = useState("");
  const [dealBreakers, setDealBreakers] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const tripResponse = await api.get(`/trips/${id}`);
      setTrip(tripResponse.data);

      const prefResponse = await api.get(`/trips/${id}/preferences`);
      setPeople(prefResponse.data.people);
      setLocked(prefResponse.data.locked);

      const me = prefResponse.data.people.find((person) => person.is_me);
      const mine = me ? me.preference : null;
      if (mine) {
  setInterests(mine.interests || []);
  setPace(mine.pace || "balanced");

  setBudgetContribution(
    mine.budget_contribution != null
      ? String(mine.budget_contribution)
      : ""
  );

  setMustDo((mine.must_do || []).join(", "));
  setDealBreakers((mine.deal_breakers || []).join(", "));
  setNotes(mine.notes || "");
}
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  function toggleInterest(name) {
    if (interests.includes(name)) {
      setInterests(interests.filter((item) => item !== name));
    } else {
      setInterests([...interests, name]);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await api.put(`/trips/${id}/preferences/me`, {
        interests: interests,
        pace: pace,
        budget_contribution: Number(budgetContribution) || 0,
        must_do: textToList(mustDo),
        deal_breakers: textToList(dealBreakers),
        notes: notes,
      });
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!trip) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading..."}</div>
      </Layout>
    );
  }

  const submittedCount = people.filter((p) => p.submitted).length;
  const percent = people.length > 0 ? Math.round((submittedCount / people.length) * 100) : 0;

  return (
    <Layout>
      <TripNav trip={trip} />

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}
      {locked && (
        <div className="success-card">The plan has been generated, so preferences are locked.</div>
      )}

      <div className="two-col">
        <form className="form-card" onSubmit={handleSave}>
          <div className="section-title">
            <Sparkles size={20} />
            <div>
              <h2>Your preferences</h2>
              <p>The AI combines everyone's preferences into one plan.</p>
            </div>
          </div>

          <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
            <div className="field full-width">
              <label>Interests</label>
              <div className="chips">
                {INTEREST_OPTIONS.map((name) => (
                  <button
                    type="button"
                    key={name}
                    className={interests.includes(name) ? "chip on" : "chip"}
                    onClick={() => toggleInterest(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 20 }}>
              <div className="field">
                <label htmlFor="pace">Pace</label>
                <select id="pace" value={pace} onChange={(e) => setPace(e.target.value)}>
                  {PACE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="budget">My budget contribution (₹)</label>
                <input id="budget" type="number" min="0" value={budgetContribution} onChange={(e) => setBudgetContribution(e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="mustDo">
                  Must-do activities <span className="optional">separate with commas</span>
                </label>
                <input id="mustDo" placeholder="e.g. sunrise trek, tea museum" value={mustDo} onChange={(e) => setMustDo(e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="avoid">
                  Things to avoid <span className="optional">separate with commas</span>
                </label>
                <input id="avoid" placeholder="e.g. adventure sports, long bus rides" value={dealBreakers} onChange={(e) => setDealBreakers(e.target.value)} />
              </div>
            </div>

            <div className="field full-width" style={{ marginTop: 20 }}>
              <label htmlFor="notes">Anything else, in your own words</label>
              <textarea id="notes" rows="4" placeholder="e.g. I want a relaxed trip with good food" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Saving..." : "Save preferences"}
              </button>
            </div>
          </fieldset>
        </form>

        <aside className="card">
          <h2>Group progress</h2>
          <p className="muted">{submittedCount} of {people.length} have added preferences</p>
          <div className="progress">
            <div className="progress-bar" style={{ width: percent + "%" }}></div>
          </div>

          {people.map((person) => (
            <div className="list-row" key={person.id}>
              <span>{person.name}</span>
              <span className={person.submitted ? "badge green" : "badge orange"}>
                {person.submitted ? "Submitted" : "Pending"}
              </span>
            </div>
          ))}

          {submittedCount === people.length && !locked && (
            <Link to={`/trip/${id}/itinerary`} className="primary-btn full-btn" style={{ marginTop: 16 }}>
              Go to itinerary
            </Link>
          )}
        </aside>
      </div>
    </Layout>
  );
}
