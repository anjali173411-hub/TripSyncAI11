import { useEffect, useState } from "react";

import Layout from "../components/Layout";
import api, { getErrorMessage } from "../services/api";

const EMPTY_PLACE = { name: "", region: "", description: "", average_cost: "", cost_tier: "mid-range", images: "" };
const COST_TIERS = ["budget", "mid-range", "luxury"];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripSearch, setTripSearch] = useState("");
  const [tripStatus, setTripStatus] = useState("all");
  const [destinations, setDestinations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [place, setPlace] = useState(EMPTY_PLACE);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      setStats((await api.get("/admin/stats")).data);
      setUsers((await api.get("/admin/users")).data);
      setTrips((await api.get("/admin/trips")).data);
      setDestinations((await api.get("/destinations")).data);
      setReviews((await api.get("/admin/reviews")).data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function run(action) {
    setError("");
    setMessage("");
    try {
      const response = await action();
      setMessage(response.data.message || "Saved.");
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function savePlace(event) {
    event.preventDefault();
    if (editingId) {
      await run(() => api.put(`/admin/destinations/${editingId}`, place));
    } else {
      await run(() => api.post("/admin/destinations", place));
    }
    setPlace(EMPTY_PLACE);
    setEditingId(null);
  }

  function editPlace(d) {
    setEditingId(d._id);
    setPlace({
      name: d.name,
      region: d.region || "",
      description: d.description || "",
      average_cost: d.average_cost,
      cost_tier: d.cost_tier || "mid-range",
      images: (d.images || []).join("\n"),
    });
  }

  const search = tripSearch.trim().toLowerCase();
  const shownTrips = trips.filter((t) => {
    if (tripStatus !== "all" && t.status !== tripStatus) return false;
    if (!search) return true;
    return [t.title, t.destination, t.start_location, t.organiser.name, t.organiser.email]
      .some((value) => String(value || "").toLowerCase().includes(search));
  });
  const statuses = [...new Set(trips.map((t) => t.status))];

  if (!stats) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>{error || "Loading..."}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Admin panel</h1>
        <p>Platform statistics, users, trips, destinations and reviews.</p>
      </section>

      {error && <div className="error-card">{error}</div>}
      {message && <div className="success-card">{message}</div>}

      <div className="stats">
        <div className="stat"><span>Registered users</span><strong>{stats.total_users}</strong></div>
        <div className="stat"><span>Active users</span><strong>{stats.active_users}</strong></div>
        <div className="stat"><span>Total trips</span><strong>{stats.total_trips}</strong></div>
        <div className="stat"><span>Solo / group trips</span><strong>{stats.solo_trips} / {stats.group_trips}</strong></div>
        <div className="stat"><span>Average group size</span><strong>{stats.average_group_size}</strong></div>
        <div className="stat"><span>Reviews</span><strong>{stats.total_reviews}</strong></div>
      </div>

      <section className="card">
        <h2>Most popular destinations</h2>
        {stats.popular_destinations.length === 0 && <p className="muted">No trips yet.</p>}
        {stats.popular_destinations.map((d) => (
          <div className="list-row" key={d.name}><span>{d.name}</span><strong>{d.count} trip(s)</strong></div>
        ))}
      </section>

      <section className="card">
        <h2>Users</h2>
        <div className="table-scroll">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Trips (organised)</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{String(u.created_at).slice(0, 10)}</td>
                <td>{u.trip_count} ({u.organised_count})</td>
                <td>
                  <span className={u.isActive ? "badge green" : "badge orange"}>{u.isActive ? "active" : "inactive"}</span>
                </td>
                <td>
                  {u.role !== "admin" && (
                    <button
                      className={u.isActive ? "small-btn danger" : "small-btn"}
                      onClick={() => run(() => api.put(`/admin/users/${u.id}/active`, { isActive: !u.isActive }))}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <section className="card">
        <h2>Trips</h2>
        <div className="admin-filters">
          <input
            type="search"
            placeholder="Search trip name, destination, start or organiser"
            value={tripSearch}
            onChange={(e) => setTripSearch(e.target.value)}
          />
          <select value={tripStatus} onChange={(e) => setTripStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <p className="muted">Showing {shownTrips.length} of {trips.length} trips.</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Destination</th><th>Dates</th><th>Organiser</th><th>Type</th>
                <th>Members</th><th>Budget</th><th>Itinerary</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shownTrips.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.title && <><strong>{t.title}</strong><br /></>}
                    {t.title ? t.destination || "No destination yet" : <strong>{t.destination || "Not chosen"}</strong>}
                    <br />
                    <span className="muted">from {t.start_location}</span>
                  </td>
                  <td>{t.start_date} → {t.end_date}</td>
                  <td>
                    {t.organiser.name}
                    <br />
                    <span className="muted">{t.organiser.email}</span>
                  </td>
                  <td>{t.type}</td>
                  <td>{t.member_count}</td>
                  <td>₹{t.budget.toLocaleString("en-IN")}</td>
                  <td>{t.has_itinerary ? "Yes" : "No"}</td>
                  <td><span className="badge">{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Destinations</h2>
          {destinations.map((d) => (
            <div className="list-row" key={d._id}>
              <span>
                <strong>{d.name}</strong>{" "}
                <span className={`badge tier-${d.cost_tier}`}>{d.cost_tier}</span>{" "}
                <span className="muted">· {d.region} · ₹{d.average_cost} · {(d.images || []).length} picture(s)</span>
              </span>
              <div className="row">
                <button className="small-btn" onClick={() => editPlace(d)}>Edit</button>
                <button
                  className="small-btn danger"
                  onClick={() => {
                    if (window.confirm(`Delete ${d.name} and its reviews?`)) {
                      run(() => api.delete(`/admin/destinations/${d._id}`));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>

        <form className="card" onSubmit={savePlace}>
          <h2>{editingId ? "Edit destination" : "Add destination"}</h2>
          <div className="field"><label>Name</label><input required value={place.name} onChange={(e) => setPlace({ ...place, name: e.target.value })} /></div>
          <div className="field" style={{ marginTop: 10 }}><label>Region</label><input value={place.region} onChange={(e) => setPlace({ ...place, region: e.target.value })} /></div>
          <div className="field" style={{ marginTop: 10 }}><label>Average cost per person (₹)</label><input type="number" min="0" value={place.average_cost} onChange={(e) => setPlace({ ...place, average_cost: e.target.value })} /></div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Cost tier</label>
            <select value={place.cost_tier} onChange={(e) => setPlace({ ...place, cost_tier: e.target.value })}>
              {COST_TIERS.map((tier) => (
                <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>
              Picture links <span className="optional">one per line, up to 6</span>
            </label>
            <textarea
              rows="3"
              placeholder="https://example.com/photo.jpg"
              value={place.images}
              onChange={(e) => setPlace({ ...place, images: e.target.value })}
            />
          </div>
          <div className="field" style={{ marginTop: 10 }}><label>Description</label><textarea rows="3" value={place.description} onChange={(e) => setPlace({ ...place, description: e.target.value })} /></div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="submit" className="primary-btn">{editingId ? "Save" : "Add"}</button>
            {editingId && <button type="button" className="secondary-btn" onClick={() => { setEditingId(null); setPlace(EMPTY_PLACE); }}>Cancel</button>}
          </div>
        </form>
      </div>

      <section className="card">
        <h2>Reviews</h2>
        {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        {reviews.map((r) => (
          <div className="list-row" key={r._id}>
            <span>
              <strong>{r.destination?.name}</strong> · {r.rating}★ by {r.user?.name}
              <br />
              <span className="muted">{r.comment}</span>
            </span>
            <button
              className={r.visible ? "small-btn danger" : "small-btn"}
              onClick={() => run(() => api.put(`/admin/reviews/${r._id}/visible`, { visible: !r.visible }))}
            >
              {r.visible ? "Hide" : "Show"}
            </button>
          </div>
        ))}
      </section>
    </Layout>
  );
}
