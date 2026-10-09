import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, Plus, Users } from "lucide-react";

import Layout from "../components/Layout";
import api, { getErrorMessage } from "../services/api";

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const tripsResponse = await api.get("/trips");
      setTrips(tripsResponse.data);

      const invitationsResponse = await api.get("/trips/invitations");
      setInvitations(invitationsResponse.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function answer(tripId, action) {
    try {
      await api.put(`/trips/${tripId}/invitation`, { action });
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Layout>
      <section className="hero">
        <div>
          <p className="eyebrow">My trips</p>
          <h1>Plan one trip that works for everyone</h1>
          <p className="hero-text">
            Create a trip, invite your friends, and TripSync AI combines everyone's wishes into one plan.
          </p>
        </div>

        <Link to="/trip/new" className="primary-btn">
          <Plus size={18} />
          Create trip plan
        </Link>
      </section>

      {error && <div className="error-card">{error}</div>}

      {invitations.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <h2>Invitations</h2>
          {invitations.map((trip) => (
            <div className="list-row" key={trip.id}>
              <span>
                <strong>{trip.owner.name}</strong> invited you to{" "}
                {trip.title || trip.destination || "a trip from " + trip.start_location} ({trip.start_date})
              </span>
              <div className="row">
                <button className="small-btn" onClick={() => answer(trip.id, "accept")}>Accept</button>
                <button className="small-btn danger" onClick={() => answer(trip.id, "decline")}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {loading && <div className="state-card" style={{ marginTop: 24 }}>Loading your trips...</div>}

      {!loading && (
        <section className="trip-grid">
          <Link to="/trip/new" className="new-trip-card">
            <div className="new-trip-icon">
              <Plus size={28} />
            </div>
            <h3>New trip</h3>
            <p>Start planning your next adventure.</p>
          </Link>

          {trips.map((trip) => (
            <article className="trip-card" key={trip.id}>
              <div className="trip-card-top">
                <span className="badge blue">{trip.trip_status || trip.status}</span>
              </div>

              <h3>{trip.title || trip.destination || "Trip without destination"}</h3>
              {trip.title && trip.destination && <p className="muted trip-subtitle">{trip.destination}</p>}

              <div className="trip-info">
                <div>
                  <MapPin size={16} />
                  <span>{trip.start_location}</span>
                </div>
                <div>
                  <CalendarDays size={16} />
                  <span>{trip.start_date} → {trip.end_date}</span>
                </div>
                <div>
                  <Users size={16} />
                  <span>{trip.type === "group" ? `Group · ${trip.members.length} members` : "Solo"}</span>
                </div>
              </div>

              <Link to={`/trip/${trip.id}`} className="trip-link">
                Open trip
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </section>
      )}
    </Layout>
  );
}
