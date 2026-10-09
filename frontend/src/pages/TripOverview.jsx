import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Layout from "../components/Layout";
import TripNav from "../components/TripNav";
import api, { getErrorMessage } from "../services/api";

export default function TripOverview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadTrip() {
    try {
      const response = await api.get(`/trips/${id}`);
      setTrip(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadTrip();
  }, [id]);

  async function run(action) {
    setError("");
    setMessage("");
    try {
      const response = await action();
      setMessage(response.data.message || "Done.");
      loadTrip();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function handleInvite(event) {
    event.preventDefault();
    run(() => api.post(`/trips/${id}/invite`, { email: inviteEmail }));
    setInviteEmail("");
  }

  function removeMember(member) {
    if (window.confirm(`Remove ${member.name} from this trip?`)) {
      run(() => api.delete(`/trips/${id}/members/${member.id}`));
    }
  }

  async function deleteTrip() {
    if (!window.confirm("Delete this trip? This can't be undone.")) return;
    try {
      await api.delete(`/trips/${id}`);
      navigate("/trips");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!trip) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading trip..."}</div>
      </Layout>
    );
  }

  const organiser = trip.is_organiser;
  const tripStatus = trip.trip_status || trip.status;
  const planning = !["finalised", "completed"].includes(tripStatus);
  const canInvite = organiser && trip.type === "group" && planning && !trip.itinerary;
  const pending = trip.invitations.filter((i) => i.status === "pending");

  return (
    <Layout>
      <TripNav trip={trip} />

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}

      <div className="two-col">
        <div>
          <section className="card">
            <h2>Trip details</h2>
            <div className="list-row"><span>Starting from</span><strong>{trip.start_location}</strong></div>
            <div className="list-row"><span>Destination</span><strong>{trip.destination || "Not chosen"}</strong></div>
            <div className="list-row"><span>Dates</span><strong>{trip.start_date} → {trip.end_date}</strong></div>
            <div className="list-row"><span>Travellers</span><strong>{trip.travellers}</strong></div>
            <div className="list-row"><span>Budget</span><strong>₹{Number(trip.budget).toLocaleString()}</strong></div>
            <div className="list-row"><span>Organiser</span><strong>{trip.owner.name}</strong></div>

            {organiser && (
              <div className="row" style={{ marginTop: 16 }}>
                {planning && <Link to={`/trip/${id}/edit`} className="secondary-btn">Edit trip</Link>}
                {tripStatus === "finalised" && (
                  <button className="primary-btn" onClick={() => run(() => api.put(`/trips/${id}/complete`))}>
                    Mark trip as completed
                  </button>
                )}
                <button className="small-btn danger" onClick={deleteTrip}>Delete trip</button>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Next steps</h2>
            <p className="muted">
              1. Everyone adds their <Link to={`/trip/${id}/preferences`}>preferences</Link>.<br />
              2. The organiser generates the <Link to={`/trip/${id}/itinerary`}>itinerary</Link>.<br />
              {trip.type === "group" && (
                <>3. The group <Link to={`/trip/${id}/votes`}>votes</Link> on any clashes.<br /></>
              )}
              {trip.type === "group" ? "4" : "3"}. The organiser finalises the plan, then you track the{" "}
              <Link to={`/trip/${id}/budget`}>budget</Link>.
            </p>
          </section>
        </div>

        <aside className="card">
          <h2>Travellers ({trip.members.length})</h2>

          {trip.members.map((member) => (
            <div className="list-row" key={member.id}>
              <span>
                {member.name}
                {member.id === trip.owner.id && <span className="muted"> (organiser)</span>}
              </span>
              {organiser && planning && member.id !== trip.owner.id && (
                <button className="small-btn danger" onClick={() => removeMember(member)}>Remove</button>
              )}
            </div>
          ))}

          {organiser && pending.length > 0 && (
            <p className="muted">Waiting to accept: {pending.map((i) => i.user.name).join(", ")}</p>
          )}

          {canInvite && (
            <form onSubmit={handleInvite} style={{ marginTop: 14 }}>
              <div className="field">
                <label htmlFor="invite">Invite a friend by email</label>
                <input
                  id="invite"
                  type="email"
                  required
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="primary-btn full-btn" style={{ marginTop: 10 }}>
                Send invitation
              </button>
            </form>
          )}

          {trip.type === "solo" && <p className="muted">This is a solo trip.</p>}
        </aside>
      </div>
    </Layout>
  );
}
