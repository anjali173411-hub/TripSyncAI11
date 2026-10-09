import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { getErrorMessage } from "../services/api";

export default function Invitations() {
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function loadInvitations() {
    try {
      setError("");
      const response = await api.get("/trips/invitations");
      setInvitations(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvitations();
  }, []);

  async function respond(tripId, action) {
    setError("");
    setMessage("");
    setBusyId(tripId);

    try {
      const response = await api.put(
        `/trips/${tripId}/invitation`,
        { action }
      );

      setMessage(response.data.message);
      await loadInvitations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Layout>
      <section className="form-card">
        <h1>My invitations</h1>
        <p className="muted">
          Accept an invitation to join a group trip.
        </p>

        {error && <div className="error-card">{error}</div>}
        {message && <div className="success-card">{message}</div>}

        {loading ? (
          <p>Loading invitations...</p>
        ) : invitations.length === 0 ? (
          <p className="muted" style={{ marginTop: 20 }}>
            You don't have any pending invitations.
          </p>
        ) : (
          invitations.map((invitation) => (
            <article
              className="card"
              key={invitation.id}
              style={{ marginTop: 16 }}
            >
              <h2>
                {invitation.title || invitation.destination || "Group trip"}
              </h2>

              <p>
                Organiser: {invitation.owner?.name || "Unknown"}
              </p>
              <p>
                Starting from: {invitation.start_location}
              </p>
              <p>
                Dates: {invitation.start_date} to {invitation.end_date}
              </p>

              <div className="row" style={{ marginTop: 16 }}>
                <button
                  className="primary-btn"
                  disabled={Boolean(busyId)}
                  onClick={() => respond(invitation.id, "accept")}
                >
                  {busyId === invitation.id
                    ? "Please wait..."
                    : "Accept"}
                </button>

                <button
                  className="secondary-btn"
                  disabled={Boolean(busyId)}
                  onClick={() => respond(invitation.id, "decline")}
                >
                  Decline
                </button>
              </div>
            </article>
          ))
        )}

        <div style={{ marginTop: 24 }}>
          <Link to="/trips">Back to my trips</Link>
        </div>
      </section>
    </Layout>
  );
}
