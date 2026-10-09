import { useState } from "react";

import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api, { getErrorMessage } from "../services/api";

const INTEREST_OPTIONS = ["Adventure", "Food", "Culture", "Nature", "Relaxation", "Nightlife", "Shopping"];

export default function Profile() {
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user.name);
  const [interests, setInterests] = useState(user.defaultPreferences?.interests || []);
  const [pace, setPace] = useState(user.defaultPreferences?.pace || "balanced");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggleInterest(item) {
    if (interests.includes(item)) {
      setInterests(interests.filter((x) => x !== item));
    } else {
      setInterests([...interests, item]);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await api.put("/auth/me", { name, interests, pace });
      setUser(response.data.user);
      setMessage("Profile saved.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Profile</p>
        <h1>Your profile</h1>
        <p>Your default interests and pace fill in the preference form for every new trip.</p>
      </section>

      <form className="form-card" onSubmit={handleSubmit}>
        {error && <div className="error-card">{error}</div>}
        {message && <div className="success-card">{message}</div>}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label>Email</label>
            <input value={user.email} disabled />
          </div>
        </div>

        <div className="field full-width" style={{ marginTop: 20 }}>
          <label>Default interests</label>
          <div className="chips">
            {INTEREST_OPTIONS.map((item) => (
              <button
                type="button"
                key={item}
                className={interests.includes(item) ? "chip on" : "chip"}
                onClick={() => toggleInterest(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 20, maxWidth: 300 }}>
          <label htmlFor="pace">Default pace</label>
          <select id="pace" value={pace} onChange={(e) => setPace(e.target.value)}>
            <option value="relaxed">relaxed</option>
            <option value="balanced">balanced</option>
            <option value="packed">packed</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" className="primary-btn">Save profile</button>
        </div>
      </form>
    </Layout>
  );
}
