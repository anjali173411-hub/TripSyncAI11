import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import TripNav from "../components/TripNav";
import api, { getErrorMessage } from "../services/api";

export default function Members() {
  const { id } = useParams();

  const [trip, setTrip] = useState(null);
  const [people, setPeople] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState("");

  async function loadData() {
    try {
      setError("");

      const tripResponse = await api.get(`/trips/${id}`);
      setTrip(tripResponse.data);

      const preferenceResponse = await api.get(
        `/trips/${id}/preferences`
      );

      setPeople(preferenceResponse.data.people || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleInvite(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setSending(true);

    try {
      const response = await api.post(`/trips/${id}/invite`, {
        email: email.trim(),
      });

      setMessage(
        response.data.message || "Invitation sent successfully!"
      );
      setEmail("");

      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleRemoveMember(person) {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${person.name} from this trip?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setRemovingId(String(person.id));

    try {
      const response = await api.delete(
        `/trips/${id}/members/${person.id}`
      );

      setMessage(response.data.message || "Member removed successfully.");

      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingId("");
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="state-card">Loading members...</div>
      </Layout>
    );
  }

  if (!trip) {
    return (
      <Layout>
        <div className="error-card">
          {error || "Trip could not be loaded."}
        </div>
      </Layout>
    );
  }

  const isOrganiser = Boolean(trip.is_organiser);
  const invitations = trip.invitations || [];

  return (
    <Layout>
      <TripNav trip={trip} />

      <section className="form-card">
        <h1>Trip members</h1>

        <p className="muted">
          Manage your group and invite registered TripSync AI users.
        </p>

        {error && <div className="error-card">{error}</div>}
        {message && <div className="success-card">{message}</div>}

        {trip.type === "group" && isOrganiser && (
          <form onSubmit={handleInvite} style={{ marginTop: 20 }}>
            <div className="field">
              <label htmlFor="memberEmail">Invite by email</label>

              <input
                id="memberEmail"
                type="email"
                placeholder="traveller@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <p className="muted">
                The person must already have a TripSync AI account.
              </p>
            </div>

            <button
              className="primary-btn"
              type="submit"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send invitation"}
            </button>
          </form>
        )}

        {trip.type !== "group" && (
          <p className="muted" style={{ marginTop: 16 }}>
            This is a solo trip. Edit the trip and select Group if you
            want to invite other travellers.
          </p>
        )}

        {trip.type === "group" && !isOrganiser && (
          <p className="muted" style={{ marginTop: 16 }}>
            Only the trip organiser can invite or remove members.
          </p>
        )}

        <hr style={{ margin: "24px 0" }} />

        <h2>Current members</h2>

        {people.length === 0 ? (
          <p className="muted">No members found.</p>
        ) : (
          people.map((person) => (
            <div
              className="list-row"
              key={person.id}
              style={{
                padding: "14px 0",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{person.name}</strong>

                {person.is_me && (
                  <span className="muted"> (You)</span>
                )}

                {person.email && (
                  <p className="muted">{person.email}</p>
                )}

                <p className="muted">
                  {person.preference?.notes || "No notes added"}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className={
                    person.submitted ? "badge green" : "badge orange"
                  }
                >
                  {person.submitted
                    ? "Preferences submitted"
                    : "Pending"}
                </span>

                {isOrganiser &&
                  !person.is_me &&
                  trip.type === "group" && (
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={Boolean(removingId)}
                      onClick={() => handleRemoveMember(person)}
                    >
                      {removingId === String(person.id)
                        ? "Removing..."
                        : "Remove"}
                    </button>
                  )}
              </div>
            </div>
          ))
        )}

        <hr style={{ margin: "24px 0" }} />

        <h2>Invitations</h2>

        {invitations.length === 0 ? (
          <p className="muted">No invitations have been sent yet.</p>
        ) : (
          invitations.map((invitation, index) => (
            <div
              className="list-row"
              key={invitation.user?.id || index}
              style={{ padding: "12px 0" }}
            >
              <div>
                <strong>
                  {invitation.user?.name || "Unknown user"}
                </strong>

                <p className="muted">
                  {invitation.user?.email || ""}
                </p>
              </div>

              <span className="badge orange">
                {invitation.status}
              </span>
            </div>
          ))
        )}

        <div style={{ marginTop: 24 }}>
          <Link to={`/trip/${id}/preferences`}>
            Go to preferences
          </Link>
        </div>
      </section>
    </Layout>
  );
}
