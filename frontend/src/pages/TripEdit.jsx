import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";

import Layout from "../components/Layout";
import { getTrip, updateTrip } from "../services/api";

export default function TripEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTrip() {
      try {
        const trip = await getTrip(id);

        setForm({
          title: trip.title || "",
          destination: trip.destination || "",
          startLocation: trip.start_location,
          startDate: trip.start_date,
          endDate: trip.end_date,
          budget: trip.budget,
          travellers: trip.travellers,
          preferenceText: trip.preference_text,
        });
      } catch (err) {
        setError(err.message);
      }
    }

    loadTrip();
  }, [id]);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.endDate < form.startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    try {
      setSaving(true);

      await updateTrip(id, {
        title: form.title.trim(),
        destination: form.destination.trim(),
        startLocation: form.startLocation.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        travellers: Number(form.travellers),
        preferenceText: form.preferenceText.trim(),
      });

      navigate(`/trip/${id}`);
    } catch (err) {
      setError(err.message || "Unable to update the trip.");
    } finally {
      setSaving(false);
    }
  }

  if (form === null) {
    return (
      <Layout>
        <div className={error ? "error-card" : "state-card"}>
          <p>{error || "Loading trip..."}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Edit trip</p>
        <h1>Change your trip details</h1>
        <p>
          Changing the trip details clears the old itinerary and votes, so you can generate a new plan.
          Changing only the trip name keeps the itinerary.
        </p>
      </section>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: 24 }}>
          <label htmlFor="title">
            Trip name <span className="optional">Optional</span>
          </label>
          <input
            id="title"
            name="title"
            maxLength={120}
            placeholder='e.g. "Goa with college friends"'
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="destination">Destination</label>
            <div className="input-with-icon">
              <MapPin size={18} />
              <input id="destination" name="destination" value={form.destination} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="startLocation">Starting from</label>
            <div className="input-with-icon">
              <MapPin size={18} />
              <input id="startLocation" name="startLocation" required value={form.startLocation} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="startDate">Start date</label>
            <div className="input-with-icon">
              <CalendarDays size={18} />
              <input id="startDate" name="startDate" type="date" required value={form.startDate} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="endDate">End date</label>
            <div className="input-with-icon">
              <CalendarDays size={18} />
              <input id="endDate" name="endDate" type="date" required value={form.endDate} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="budget">Budget (₹)</label>
            <div className="input-with-icon">
              <Wallet size={18} />
              <input id="budget" name="budget" type="number" min="1" required value={form.budget} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="travellers">Number of travellers</label>
            <div className="input-with-icon">
              <Users size={18} />
              <input id="travellers" name="travellers" type="number" min="1" max="50" required value={form.travellers} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="field full-width">
          <label htmlFor="preferenceText">What are you looking for in this trip?</label>
          <textarea id="preferenceText" name="preferenceText" rows="6" required value={form.preferenceText} onChange={handleChange} />
        </div>

        {error && <div className="error-card">{error}</div>}

        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={() => navigate(`/trip/${id}`)}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </Layout>
  );
}
