import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star } from "lucide-react";

import Layout from "../components/Layout";
import api, { getErrorMessage } from "../services/api";

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDestinations(text, costTier) {
    try {
      setLoading(true);
      const response = await api.get("/destinations", { params: { search: text, tier: costTier || undefined } });
      setDestinations(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDestinations("", "");
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    loadDestinations(search, tier);
  }

  function changeTier(event) {
    setTier(event.target.value);
    loadDestinations(search, event.target.value);
  }

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Explore</p>
        <h1>Destinations</h1>
        <p>Ideas for your next trip, with ratings from travellers who have been there.</p>
      </section>

      <form className="row" onSubmit={handleSearch} style={{ marginBottom: 20 }}>
        <input style={{ flex: 1 }} placeholder="Search a place, e.g. Munnar" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ width: "auto" }} value={tier} onChange={changeTier} aria-label="Cost tier">
          <option value="">All budgets</option>
          <option value="budget">Budget</option>
          <option value="mid-range">Mid-range</option>
          <option value="luxury">Luxury</option>
        </select>
        <button type="submit" className="primary-btn">Search</button>
      </form>

      {error && <div className="error-card">{error}</div>}
      {loading && <div className="state-card">Loading...</div>}
      {!loading && destinations.length === 0 && <div className="state-card">No destinations found.</div>}

      <section className="trip-grid">
        {destinations.map((d) => (
          <Link to={`/destinations/${d._id}`} className="trip-card dest-card" key={d._id}>
            {d.images.length > 0 && <img src={d.images[0]} alt={d.name} />}
            <h3>
              {d.name} <span className={`badge tier-${d.cost_tier}`}>{d.cost_tier}</span>
            </h3>
            <div className="trip-info">
              <div><MapPin size={16} /><span>{d.region}</span></div>
              <div><Star size={16} /><span>{d.average_rating ? `${d.average_rating} / 5` : "No ratings yet"}</span></div>
            </div>
            <p className="muted">{d.description}</p>
            <p className="muted">About ₹{Number(d.average_cost).toLocaleString()} per person</p>
          </Link>
        ))}
      </section>
    </Layout>
  );
}
