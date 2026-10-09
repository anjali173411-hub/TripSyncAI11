import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";

import Layout from "../components/Layout";
import { createTrip } from "../services/api";

const initialForm = {
  title: "",
  destination: "",
  startLocation: "",
  startDate: "",
  endDate: "",
  budget: "",
  travellers: "",
  preferenceText: "",
  tripType: "solo",
};

export default function TripNew() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));

    setSubmitError("");
  }

  function validate() {
    const nextErrors = {};

    if (!form.startLocation.trim()) {
      nextErrors.startLocation =
        "Starting location is required.";
    }

    if (!form.startDate) {
      nextErrors.startDate = "Start date is required.";
    }

    if (!form.endDate) {
      nextErrors.endDate = "End date is required.";
    }

    if (
      form.startDate &&
      form.endDate &&
      form.endDate < form.startDate
    ) {
      nextErrors.endDate =
        "End date must be on or after the start date.";
    }

    if (!form.budget) {
      nextErrors.budget = "Budget is required.";
    } else if (Number(form.budget) <= 0) {
      nextErrors.budget =
        "Budget must be greater than 0.";
    }

    if (!form.travellers) {
      nextErrors.travellers =
        "Number of travellers is required.";
    } else if (
      Number(form.travellers) < 1 ||
      Number(form.travellers) > 50
    ) {
      nextErrors.travellers =
        "Travellers must be between 1 and 50.";
    }

    if (!form.preferenceText.trim()) {
      nextErrors.preferenceText =
        "Please enter your travel preferences.";
    } else if (
      form.preferenceText.trim().length < 10
    ) {
      nextErrors.preferenceText =
        "Please enter at least 10 characters.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      setSubmitError("");

      const trip = await createTrip({
        title: form.title.trim(),
        destination: form.destination.trim(),
        startLocation: form.startLocation.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        travellers: Number(form.travellers),
        preferenceText: form.preferenceText.trim(),
        tripType: form.tripType,
      });

      navigate(`/trip/${trip.id}`);
    } catch (err) {
      setSubmitError(
        err.message || "Unable to create the trip."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout step={1}>
      <section className="page-heading">
        <p className="eyebrow">Step 1 of 3</p>

        <h1>Tell us about your trip</h1>

        <p>
          Enter the basic details of your trip. You can
          refine your preferences in the next step.
        </p>
      </section>

      <form
        className="form-card"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="field" style={{ marginBottom: 24 }}>
          <label htmlFor="title">
            Trip name
            <span className="optional">Optional</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={120}
            placeholder='e.g. "Goa with college friends"'
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="destination">
              Destination
              <span className="optional">
                Optional
              </span>
            </label>

            <div className="input-with-icon">
              <MapPin size={18} />

              <input
                id="destination"
                name="destination"
                type="text"
                placeholder="Where would you like to go?"
                value={form.destination}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="startLocation">
              Starting from
              <span className="required">*</span>
            </label>

            <div className="input-with-icon">
              <MapPin size={18} />

              <input
                id="startLocation"
                name="startLocation"
                type="text"
                placeholder="City or location"
                value={form.startLocation}
                onChange={handleChange}
              />
            </div>

            {errors.startLocation && (
              <p className="field-error">
                {errors.startLocation}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="startDate">
              Start date
              <span className="required">*</span>
            </label>

            <div className="input-with-icon">
              <CalendarDays size={18} />

              <input
                id="startDate"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
              />
            </div>

            {errors.startDate && (
              <p className="field-error">
                {errors.startDate}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="endDate">
              End date
              <span className="required">*</span>
            </label>

            <div className="input-with-icon">
              <CalendarDays size={18} />

              <input
                id="endDate"
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
              />
            </div>

            {errors.endDate && (
              <p className="field-error">
                {errors.endDate}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="budget">
              Approximate budget
              <span className="required">*</span>
            </label>

            <div className="input-with-icon">
              <Wallet size={18} />

              <input
                id="budget"
                name="budget"
                type="number"
                min="1"
                placeholder="Enter your budget"
                value={form.budget}
                onChange={handleChange}
              />
            </div>

            {errors.budget && (
              <p className="field-error">
                {errors.budget}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="travellers">
              Number of travellers
              <span className="required">*</span>
            </label>

            <div className="input-with-icon">
              <Users size={18} />

              <input
                id="travellers"
                name="travellers"
                type="number"
                min="1"
                max="50"
                placeholder="Number of travellers"
                value={form.travellers}
                onChange={handleChange}
              />
            </div>

            {errors.travellers && (
              <p className="field-error">
                {errors.travellers}
              </p>
            )}
          </div>
        </div>

        <div className="field full-width">
          <label>Who is going?</label>
          <div className="chips">
            <button
              type="button"
              className={form.tripType === "solo" ? "chip on" : "chip"}
              onClick={() => setForm({ ...form, tripType: "solo" })}
            >
              Just me (solo)
            </button>
            <button
              type="button"
              className={form.tripType === "group" ? "chip on" : "chip"}
              onClick={() => setForm({ ...form, tripType: "group" })}
            >
              A group (invite friends next)
            </button>
          </div>
        </div>

        <div className="field full-width">
          <label htmlFor="preferenceText">
            What are you looking for in this trip? (your own preferences)
            <span className="required">*</span>
          </label>

          <textarea
            id="preferenceText"
            name="preferenceText"
            rows="6"
            placeholder="Tell us what you enjoy, for example the type of places, activities, pace, food, culture or experiences you prefer."
            value={form.preferenceText}
            onChange={handleChange}
          />

          {errors.preferenceText && (
            <p className="field-error">
              {errors.preferenceText}
            </p>
          )}
        </div>

        {submitError && (
          <div className="error-card">
            {submitError}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading
              ? "Creating trip..."
              : "Continue"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </div>
      </form>
    </Layout>
  );
}
