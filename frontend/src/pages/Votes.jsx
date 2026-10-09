import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Layout from "../components/Layout";
import TripNav from "../components/TripNav";
import api, { getErrorMessage } from "../services/api";

export default function Votes() {
  const { id } = useParams();

  const [trip, setTrip] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [isOrganiser, setIsOrganiser] = useState(false);
  const [customText, setCustomText] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const tripResponse = await api.get(`/trips/${id}`);
      setTrip(tripResponse.data);

      const response = await api.get(`/trips/${id}/votes`);
      setConflicts(response.data.conflicts);
      setIsOrganiser(response.data.is_organiser);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function run(action) {
    setError("");
    setMessage("");
    try {
      const response = await action();
      setMessage(response.data.message);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function vote(conflictId, option) {
    run(() => api.post(`/trips/${id}/votes/${conflictId}`, { option }));
  }

  function decide(conflictId, option) {
    const custom = customText[conflictId] || "";
    if (option === null && custom.trim() === "") {
      setError("Write your decision first.");
      return;
    }
    run(() => api.put(`/trips/${id}/votes/${conflictId}/resolve`, { option, custom: option === null ? custom : "" }));
  }

  if (!trip) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading..."}</div>
      </Layout>
    );
  }

  const open = conflicts.filter((c) => !c.resolved);
  const decided = conflicts.filter((c) => c.resolved);
  const tripStatus = trip.trip_status || trip.status;
  const planning = !["finalised", "completed"].includes(tripStatus);

  return (
    <Layout>
      <TripNav trip={trip} />

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}

      {conflicts.length === 0 && (
        <div className="card">
          <h2>No clashes</h2>
          <p className="muted">
            {trip.itinerary
              ? "Everyone's wishes fit together. The organiser can finalise the plan on the itinerary page."
              : "Clashes appear here after the organiser generates the itinerary."}
          </p>
        </div>
      )}

      {open.length > 0 && (
        <p className="muted" style={{ marginBottom: 16 }}>
          The AI kept these out of the plan because travellers' wishes clash. The people involved vote;
          when more than half agree, the choice is locked in. On a tie, the organiser decides.
        </p>
      )}

      {open.map((conflict) => (
        <section className="card" key={conflict._id}>
          <span className="badge orange">Needs a decision</span>
          <h2 style={{ marginTop: 10 }}>{conflict.description}</h2>
          <p className="muted">
            Involved: {conflict.affected_members.map((m) => m.name).join(", ")} ·{" "}
            {conflict.votes.length} of {conflict.affected_members.length} voted
          </p>
          <p className="muted"><strong>Why the AI flagged this:</strong> {conflict.reasoning}</p>

          <div className="options">
            {conflict.options.map((option, index) => {
              const votesForIt = conflict.votes.filter((v) => v.option === index);
              return (
                <div className={conflict.my_vote === index ? "option chosen" : "option"} key={index}>
                  <p className="eyebrow">Option {String.fromCharCode(65 + index)}</p>
                  <h4>{option.text}</h4>
                  <p className="muted">{option.rationale}</p>
                  {option.adds_activity && (
                    <p className="muted">
                      Adds: Day {option.day} · {option.time} · ₹{option.estimated_cost}
                    </p>
                  )}
                  <p className="muted">
                    {votesForIt.length} vote(s){votesForIt.length > 0 && ": " + votesForIt.map((v) => v.user.name).join(", ")}
                  </p>

                  {conflict.can_vote && planning && (
                    <button className="secondary-btn full-btn" onClick={() => vote(conflict._id, index)}>
                      {conflict.my_vote === index ? "Your vote" : "Vote for this"}
                    </button>
                  )}

                  {isOrganiser && planning && (
                    <button className="small-btn" style={{ marginTop: 8 }} onClick={() => decide(conflict._id, index)}>
                      Organiser: choose this
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {isOrganiser && planning && (
            <div className="row" style={{ marginTop: 16 }}>
              <input
                style={{ flex: 1 }}
                placeholder="Or write your own decision"
                value={customText[conflict._id] || ""}
                onChange={(e) => setCustomText({ ...customText, [conflict._id]: e.target.value })}
              />
              <button className="secondary-btn" onClick={() => decide(conflict._id, null)}>
                Save my decision
              </button>
            </div>
          )}
        </section>
      ))}

      {decided.length > 0 && (
        <section className="card">
          <h2>Decided</h2>
          {decided.map((conflict) => (
            <div className="list-row" key={conflict._id}>
              <span>
                <strong>{conflict.description}</strong>
                <br />
                <span className="muted">
                  {conflict.custom_resolution
                    ? conflict.custom_resolution
                    : conflict.options[conflict.selected_option].text}{" "}
                  · decided by {conflict.resolved_by === "vote" ? "majority vote" : "the organiser"}
                </span>
              </span>
              <span className="badge green">Decided</span>
            </div>
          ))}
        </section>
      )}

      {open.length === 0 && conflicts.length > 0 && planning && (
        <p className="muted">
          All clashes are decided. The organiser can now <Link to={`/trip/${id}/itinerary`}>finalise the plan</Link>.
        </p>
      )}
    </Layout>
  );
}
